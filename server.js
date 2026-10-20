const http = require("node:http");
const fs = require("node:fs/promises");
const path = require("node:path");
const { randomUUID } = require("node:crypto");

const port = Number(process.env.PORT) || 3000;
const dataFile = path.join(__dirname, "data", "store.json");
const maxRequestSize = 1024 * 1024;
let updateQueue = Promise.resolve();

async function readData() {
  try {
    return JSON.parse(await fs.readFile(dataFile, "utf8"));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    return { forms: [], responses: [] };
  }
}

function updateData(callback) {
  const update = updateQueue.then(async () => {
    const data = await readData();
    const result = await callback(data);
    await fs.mkdir(path.dirname(dataFile), { recursive: true });
    const tempFile = `${dataFile}.${randomUUID()}.tmp`;
    await fs.writeFile(tempFile, JSON.stringify(data, null, 2), "utf8");
    await fs.rename(tempFile, dataFile);
    return result;
  });
  updateQueue = update.catch(() => {});
  return update;
}

function readJson(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
      if (Buffer.byteLength(body) > maxRequestSize) {
        reject(Object.assign(new Error("Запрос больше 1 МБ."), { status: 413 }));
        request.destroy();
      }
    });
    request.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(Object.assign(new Error("Некорректный JSON."), { status: 400 }));
      }
    });
    request.on("error", reject);
  });
}

function sendJson(response, status, value) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  response.end(JSON.stringify(value));
}

function text(value, max = 500) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function prepareForm(input) {
  const title = text(input.title, 120);
  if (!title) throw Object.assign(new Error("Укажите название формы."), { status: 400 });
  if (!Array.isArray(input.fields) || input.fields.length < 1 || input.fields.length > 30) {
    throw Object.assign(new Error("Добавьте от 1 до 30 вопросов."), { status: 400 });
  }
  const fields = input.fields.map((field) => {
    const label = text(field.label, 120);
    const type = ["text", "email", "textarea"].includes(field.type) ? field.type : "";
    if (!label || !type) {
      throw Object.assign(new Error("Укажите название и тип каждого вопроса."), { status: 400 });
    }
    return {
      id: /^[0-9a-f-]{36}$/i.test(field.id || "") ? field.id : randomUUID(),
      label,
      type,
      required: Boolean(field.required),
    };
  });
  return { title, description: text(input.description), fields };
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character]);
}

const pageStyle = `
  *{box-sizing:border-box}body{margin:0;background:#f5f6fa;color:#24263a;font:15px Arial,sans-serif}
  button,input,textarea,select{font:inherit}button{cursor:pointer}
  header{background:#fff;border-bottom:1px solid #e7e8ef;padding:17px 24px;display:flex;align-items:center;justify-content:space-between}
  header a{color:#574bd6;text-decoration:none;font-size:20px;font-weight:bold}
  main{max-width:900px;margin:32px auto;padding:0 18px}
  h1{font-size:27px;margin:0 0 8px}h2{font-size:20px;margin:0 0 15px}p{color:#717487;line-height:1.5}
  .top{display:flex;align-items:center;justify-content:space-between;margin-bottom:22px}.top p{margin:0}
  .button{border:0;border-radius:7px;padding:11px 16px;background:#6255dc;color:#fff;font-weight:bold}
  .button:hover{background:#5144cb}.button:disabled{opacity:.6;cursor:wait}
  .secondary{background:#fff;border:1px solid #dfe0e8;color:#414356}.secondary:hover{background:#f4f3ff;color:#594bd3}
  .card{background:#fff;border:1px solid #e7e8ef;border-radius:10px;padding:18px;margin-bottom:12px}
  .form-card{display:flex;align-items:center;gap:14px}.form-card .details{flex:1}.form-card h3{margin:0 0 5px;font-size:16px}
  .form-card p{font-size:13px;margin:0}.badge{font-size:12px;border-radius:12px;padding:5px 9px;background:#fff3dc;color:#8a6320}
  .badge.live{background:#e6f7ef;color:#227b58}.actions{display:flex;gap:8px}
  .empty{text-align:center;padding:40px 20px}.empty p{margin:8px auto 18px;max-width:400px}
  label{display:block;font-size:13px;font-weight:bold;margin:14px 0 6px}
  input[type=text],input[type=email],textarea,select{width:100%;border:1px solid #dfe0e8;border-radius:6px;padding:10px;color:#282a3d;background:#fff}
  textarea{resize:vertical}input:focus,textarea:focus,select:focus{outline:2px solid #ddd9ff;border-color:#7568e8}
  .hint{font-size:12px;color:#858799;margin-top:5px}.builder{display:none}.question{display:grid;grid-template-columns:1fr 160px auto;gap:8px;align-items:center;margin:10px 0}
  .question input[type=text],.question select{margin:0}.question .required{font-size:12px;font-weight:normal;display:flex;align-items:center;gap:4px}
  .remove{border:0;background:transparent;color:#bd4c5b;font-size:20px}
  .builder-actions{display:flex;justify-content:space-between;gap:8px;margin-top:18px}
  .response{margin:12px 0;padding:14px 0;border-top:1px solid #eee}.response time{font-size:12px;color:#858799}
  .answer{margin-top:9px;font-size:14px}.answer strong{display:block;color:#74778a;font-size:12px;margin-bottom:3px}
  .public{max-width:580px;margin:55px auto;padding:0 16px}.public .card{padding:28px}.public h1{font-size:25px}
  .error{color:#bb3549;font-size:13px;min-height:18px}.success{text-align:center;padding:45px 24px}
  @media(max-width:600px){header{padding:14px 16px}.top{align-items:flex-start;gap:12px}.form-card{flex-wrap:wrap}.form-card .details{min-width:60%}.actions{width:100%}.actions button{flex:1}.question{grid-template-columns:1fr 125px auto}.public .card{padding:20px}}
`;

function htmlPage(title, body, script = "") {
  return `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title><style>${pageStyle}</style></head><body>${body}${script ? `<script>${script}</script>` : ""}</body></html>`;
}

function adminPage() {
  const body = `<header><a href="/admin">CareerForm</a><span>Конструктор форм</span></header>
    <main><section id="list">
      <div class="top"><div><h1>Формы отклика</h1><p>Создавайте формы и получайте ответы студентов.</p></div><button class="button" onclick="newForm()">+ Новая форма</button></div>
      <div id="forms"></div>
    </section>
    <section id="editor" class="builder">
      <div class="top"><div><h1 id="editor-heading">Новая форма</h1><p>Добавьте вопросы, которые увидят студенты.</p></div><button class="button secondary" onclick="showList()">← Назад</button></div>
      <div class="card"><label for="title">Название формы</label><input id="title" type="text" maxlength="120" placeholder="Например, Стажировка в команде продукта">
        <label for="description">Описание</label><textarea id="description" rows="3" placeholder="Расскажите о стажировке или мероприятии"></textarea>
      </div>
      <div class="card"><h2>Вопросы</h2><div id="questions"></div><button class="button secondary" onclick="addQuestion()">+ Добавить вопрос</button>
        <div class="builder-actions"><button class="button secondary" onclick="save(false)">Сохранить черновик</button><button class="button" onclick="save(true)">Опубликовать</button></div>
      </div>
    </section>
    <section id="inbox" class="builder"><div class="top"><div><h1 id="inbox-title">Отклики</h1><p>Ответы студентов на вашу форму.</p></div><button class="button secondary" onclick="showList()">← Назад</button></div><div class="card" id="responses"></div></section>
    </main>`;
  const script = `
    let forms=[], editing=null;
    const $=id=>document.getElementById(id);
    const esc=value=>String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
    async function request(url,options={}){const r=await fetch(url,{...options,headers:{"Content-Type":"application/json",...options.headers}});const data=await r.json();if(!r.ok)throw Error(data.error||"Ошибка запроса");return data}
    function show(section){["list","editor","inbox"].forEach(id=>$(id).style.display=id===section?"block":"none")}
    function showList(){editing=null;show("list");load()}
    async function load(){try{forms=(await request("/api/forms")).forms;$("forms").innerHTML=forms.length?forms.map(f=>'<article class="card form-card"><div class="details"><h3>'+esc(f.title)+'</h3><p>'+esc(f.description||"Без описания")+' · '+f.fields.length+' вопросов · '+f.responseCount+' откликов</p></div><span class="badge '+(f.status==="published"?"live":"")+'">'+(f.status==="published"?"Опубликована":"Черновик")+'</span><div class="actions">'+(f.status==="published"?'<button class="button secondary" onclick="copyLink(\\''+f.id+'\\')">Ссылка</button><button class="button secondary" onclick="openResponses(\\''+f.id+'\\')">Отклики</button>':'<button class="button secondary" onclick="editForm(\\''+f.id+'\\')">Изменить</button>')+'</div></article>').join(""):'<div class="card empty"><h2>Пока нет форм</h2><p>Создайте форму отклика и отправьте ссылку студентам.</p><button class="button" onclick="newForm()">Создать первую форму</button></div>'}catch(e){$("forms").innerHTML='<div class="card">'+esc(e.message)+'</div>'}}
    function newForm(){editing={title:"",description:"",fields:[{id:crypto.randomUUID(),label:"Как вас зовут?",type:"text",required:true},{id:crypto.randomUUID(),label:"Электронная почта",type:"email",required:true},{id:crypto.randomUUID(),label:"Почему вам интересна эта возможность?",type:"textarea",required:false}]};drawEditor()}
    async function editForm(id){try{editing=(await request("/api/forms/"+id)).form;drawEditor()}catch(e){alert(e.message)}}
    function drawEditor(){show("editor");$("editor-heading").textContent=editing.id?"Изменить форму":"Новая форма";$("title").value=editing.title;$("description").value=editing.description;drawQuestions()}
    function drawQuestions(){$("questions").innerHTML=editing.fields.map((f,i)=>'<div class="question" data-id="'+f.id+'"><input type="text" placeholder="Название вопроса" value="'+esc(f.label)+'"><select>'+[['text','Короткий текст'],['email','Электронная почта'],['textarea','Развёрнутый ответ']].map(([v,l])=>'<option value="'+v+'" '+(f.type===v?'selected':'')+'>'+l+'</option>').join("")+'</select><label class="required"><input type="checkbox" '+(f.required?'checked':'')+'> Обязательный</label><button class="remove" title="Удалить" onclick="removeQuestion(\\''+f.id+'\\')">×</button></div>').join("")}
    function addQuestion(){if(editing.fields.length>=30)return alert("Не более 30 вопросов.");editing.fields.push({id:crypto.randomUUID(),label:"",type:"text",required:false});drawQuestions()}
    function removeQuestion(id){editing.fields=editing.fields.filter(f=>f.id!==id);drawQuestions()}
    function formValues(){editing.title=$("title").value.trim();editing.description=$("description").value.trim();editing.fields=[...document.querySelectorAll(".question")].map(row=>({id:row.dataset.id,label:row.querySelector('input[type="text"]').value.trim(),type:row.querySelector("select").value,required:row.querySelector('input[type="checkbox"]').checked}));return editing}
    async function save(publish){try{const form=formValues();if(!form.title)throw Error("Введите название формы.");if(!form.fields.length)throw Error("Добавьте хотя бы один вопрос.");const saved=await request(form.id?"/api/forms/"+form.id:"/api/forms",{method:form.id?"PUT":"POST",body:JSON.stringify(form)});editing=saved.form;if(publish){const result=await request("/api/forms/"+editing.id+"/publish",{method:"POST",body:"{}"});await load();show("list");alert("Форма опубликована. Ссылка скопирована.");await navigator.clipboard?.writeText(location.origin+result.url)}else{await load();show("list");alert("Черновик сохранён.")}}catch(e){alert(e.message)}}
    async function copyLink(id){try{await navigator.clipboard.writeText(location.origin+"/f/"+id);alert("Ссылка скопирована.")}catch{prompt("Скопируйте ссылку:",location.origin+"/f/"+id)}}
    async function openResponses(id){try{const result=await request("/api/forms/"+id+"/responses");$("inbox-title").textContent=result.form.title+" — отклики";$("responses").innerHTML=result.responses.length?result.responses.map(r=>'<div class="response"><time>'+new Date(r.createdAt).toLocaleString("ru-RU")+'</time>'+result.form.fields.map(f=>'<div class="answer"><strong>'+esc(f.label)+'</strong>'+esc(r.answers[f.id]||"—")+'</div>').join("")+'</div>').join(""):'<p>Пока нет откликов.</p>';show("inbox")}catch(e){alert(e.message)}}
    load();
  `;
  return htmlPage("CareerForm — формы отклика", body, script);
}

function publicPage(id, form) {
  if (!form) {
    return htmlPage("Форма не найдена", `<header><a href="/admin">CareerForm</a></header><main class="public"><div class="card"><h1>Форма не найдена</h1><p>Ссылка устарела или форма ещё не опубликована.</p></div></main>`);
  }
  const fields = form.fields.map((field) => {
    const required = field.required ? "required" : "";
    const type = field.type === "email" ? "email" : "text";
    const control = field.type === "textarea"
      ? `<textarea id="${field.id}" rows="4" ${required}></textarea>`
      : `<input id="${field.id}" type="${type}" ${required}>`;
    return `<label for="${field.id}">${escapeHtml(field.label)}${field.required ? " *" : ""}</label>${control}`;
  }).join("");
  const body = `<header><a href="/admin">CareerForm</a><span>Форма отклика</span></header><main class="public"><div class="card"><h1>${escapeHtml(form.title)}</h1><p>${escapeHtml(form.description)}</p><form id="apply">${fields}<p id="error" class="error"></p><button class="button">Отправить отклик</button></form></div></main>`;
  const script = `
    document.getElementById("apply").addEventListener("submit",async event=>{event.preventDefault();const answers={};${form.fields.map((field) => `answers[${JSON.stringify(field.id)}]=document.getElementById(${JSON.stringify(field.id)}).value;`).join("")}try{const response=await fetch("/api/forms/${id}/responses",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({answers})});const result=await response.json();if(!response.ok)throw Error(result.error);document.querySelector("main").innerHTML='<div class="card success"><h1>Спасибо!</h1><p>Ваш отклик отправлен.</p></div>'}catch(error){document.getElementById("error").textContent=error.message}});
  `;
  return htmlPage(escapeHtml(form.title), body, script);
}

async function handle(request, response) {
  const url = new URL(request.url, `http://${request.headers.host || "localhost"}`);
  const route = url.pathname;
  if (request.method === "GET" && (route === "/" || route === "/admin")) {
    response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    response.end(adminPage());
    return;
  }

  const publicRoute = route.match(/^\/f\/([0-9a-f-]{36})$/i);
  if (request.method === "GET" && publicRoute) {
    const data = await readData();
    const form = data.forms.find((item) => item.id === publicRoute[1] && item.status === "published");
    response.writeHead(form ? 200 : 404, { "Content-Type": "text/html; charset=utf-8" });
    response.end(publicPage(publicRoute[1], form));
    return;
  }

  if (request.method === "GET" && route === "/api/forms") {
    const data = await readData();
    const forms = data.forms.map((form) => ({
      ...form,
      responseCount: data.responses.filter((item) => item.formId === form.id).length,
    }));
    sendJson(response, 200, { forms });
    return;
  }

  const formRoute = route.match(/^\/api\/forms\/([0-9a-f-]{36})$/i);
  if (request.method === "POST" && route === "/api/forms") {
    const form = await updateData(async (data) => {
      const created = {
        id: randomUUID(), ...prepareForm(await readJson(request)),
        status: "draft", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      };
      data.forms.unshift(created);
      return created;
    });
    sendJson(response, 201, { form });
    return;
  }
  if (request.method === "PUT" && formRoute) {
    const input = await readJson(request);
    const form = await updateData((data) => {
      const current = data.forms.find((item) => item.id === formRoute[1]);
      if (!current) throw Object.assign(new Error("Форма не найдена."), { status: 404 });
      Object.assign(current, prepareForm(input), { updatedAt: new Date().toISOString() });
      return current;
    });
    sendJson(response, 200, { form });
    return;
  }
  if (request.method === "GET" && formRoute) {
    const data = await readData();
    const form = data.forms.find((item) => item.id === formRoute[1]);
    if (!form) return sendJson(response, 404, { error: "Форма не найдена." });
    sendJson(response, 200, { form });
    return;
  }

  const publishRoute = route.match(/^\/api\/forms\/([0-9a-f-]{36})\/publish$/i);
  if (request.method === "POST" && publishRoute) {
    const form = await updateData((data) => {
      const current = data.forms.find((item) => item.id === publishRoute[1]);
      if (!current) throw Object.assign(new Error("Форма не найдена."), { status: 404 });
      current.status = "published";
      current.updatedAt = new Date().toISOString();
      return current;
    });
    sendJson(response, 200, { form, url: `/f/${form.id}` });
    return;
  }

  const responseRoute = route.match(/^\/api\/forms\/([0-9a-f-]{36})\/responses$/i);
  if (responseRoute && request.method === "GET") {
    const data = await readData();
    const form = data.forms.find((item) => item.id === responseRoute[1]);
    if (!form) return sendJson(response, 404, { error: "Форма не найдена." });
    const responses = data.responses.filter((item) => item.formId === form.id);
    sendJson(response, 200, { form, responses });
    return;
  }
  if (responseRoute && request.method === "POST") {
    const input = await readJson(request);
    const submission = await updateData((data) => {
      const form = data.forms.find((item) => item.id === responseRoute[1] && item.status === "published");
      if (!form) throw Object.assign(new Error("Опубликованная форма не найдена."), { status: 404 });
      const answers = {};
      for (const field of form.fields) {
        const answer = text(input.answers?.[field.id], 5000);
        if (field.required && !answer) {
          throw Object.assign(new Error(`Заполните поле «${field.label}».`), { status: 400 });
        }
        if (field.type === "email" && answer && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(answer)) {
          throw Object.assign(new Error(`Проверьте электронную почту в поле «${field.label}».`), { status: 400 });
        }
        answers[field.id] = answer;
      }
      const result = { id: randomUUID(), formId: form.id, answers, createdAt: new Date().toISOString() };
      data.responses.push(result);
      return result;
    });
    sendJson(response, 201, { response: submission });
    return;
  }
  sendJson(response, 404, { error: "Маршрут не найден." });
}

http.createServer((request, response) => {
  handle(request, response).catch((error) => {
    console.error(error);
    if (!response.headersSent) {
      sendJson(response, error.status || 500, { error: error.status ? error.message : "Внутренняя ошибка сервера." });
    } else {
      response.destroy(error);
    }
  });
}).listen(port, "0.0.0.0", () => {
  console.log(`Откройте http://localhost:${port}/admin`);
});
