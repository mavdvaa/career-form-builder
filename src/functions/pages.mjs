import { escapeHtml } from "./forms.mjs";

const styles = `
*{box-sizing:border-box}body{margin:0;background:#f5f6fa;color:#24263a;font:15px Arial,sans-serif}
button,input,textarea,select{font:inherit}button{cursor:pointer}header{background:#fff;border-bottom:1px solid #e7e8ef;padding:16px 22px;display:flex;justify-content:space-between}
header a{color:#584bd6;text-decoration:none;font-size:20px;font-weight:bold}main{max-width:850px;margin:30px auto;padding:0 16px}
h1{font-size:26px;margin:0 0 7px}h2{font-size:19px;margin:0 0 14px}h3{font-size:16px;margin:0 0 5px}p{color:#727587;line-height:1.5}
.top{display:flex;justify-content:space-between;align-items:center;margin-bottom:20px}.top p{margin:0}
.button{border:0;border-radius:6px;padding:10px 14px;background:#6255dc;color:#fff;font-weight:bold}.button:hover{background:#5144cb}
.secondary{background:white;border:1px solid #ddd;color:#434558}.secondary:hover{background:#f3f1ff;color:#5547cf}
.card{background:white;border:1px solid #e5e6ed;border-radius:9px;padding:17px;margin-bottom:12px}.form-card{display:flex;align-items:center;gap:12px}
.details{flex:1}.details p{font-size:13px;margin:0}.badge{padding:5px 8px;border-radius:12px;background:#fff3dc;color:#815f23;font-size:12px}.live{background:#e7f7ef;color:#277959}
.actions{display:flex;gap:7px}.actions button{font-size:12px}.empty{text-align:center;padding:35px 18px}
label{display:block;font-size:13px;font-weight:bold;margin:13px 0 6px}input[type=text],input[type=email],textarea,select{width:100%;padding:9px;border:1px solid #d9dae3;border-radius:6px}
textarea{resize:vertical}.builder,.inbox{display:none}.question{display:grid;grid-template-columns:1fr 150px auto;gap:8px;align-items:center;margin:9px 0}
.question input[type=text],.question select{margin:0}.question label{font-size:12px;font-weight:normal;white-space:nowrap}.remove{border:0;background:transparent;color:#b44;font-size:20px}
.builder-actions{display:flex;justify-content:space-between;margin-top:17px}.response{padding:13px 0;border-top:1px solid #eee}.response time{color:#858799;font-size:12px}
.answer{margin-top:8px;font-size:14px}.answer strong{display:block;color:#737588;font-size:12px;margin-bottom:3px}
.public{max-width:560px;margin:48px auto;padding:0 16px}.public .card{padding:25px}.public label{margin-top:15px}.error{min-height:18px;color:#bb3549;font-size:13px}
.success{text-align:center;padding:35px 18px}.success h1{color:#277959}
@media(max-width:600px){.top{align-items:flex-start;gap:10px}.form-card{flex-wrap:wrap}.details{min-width:60%}.actions{width:100%}.actions button{flex:1}.question{grid-template-columns:1fr 115px auto}.public .card{padding:18px}}
`;

function page(title, body, script = "") {
  return `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title><style>${styles}</style></head><body>${body}${script ? `<script>${script}</script>` : ""}</body></html>`;
}

export function adminPage() {
  const body = `<header><a href="/admin">CareerForm</a><span>Формы отклика</span></header>
<main><section id="list"><div class="top"><div><h1>Мои формы</h1><p>Создавайте формы и смотрите ответы студентов.</p></div><button class="button" onclick="newForm()">+ Создать форму</button></div><div id="forms"></div></section>
<section id="editor" class="builder"><div class="top"><div><h1 id="editor-title">Новая форма</h1><p>Добавьте вопросы для студентов.</p></div><button class="button secondary" onclick="showList()">Назад</button></div>
<div class="card"><label for="title">Название формы</label><input id="title" type="text" maxlength="120" placeholder="Например, Стажировка в команде продукта"><label for="description">Описание</label><textarea id="description" rows="3" placeholder="Коротко расскажите о возможности"></textarea></div>
<div class="card"><h2>Вопросы</h2><div id="questions"></div><button class="button secondary" onclick="addQuestion()">+ Добавить вопрос</button><div class="builder-actions"><button class="button secondary" onclick="save(false)">Сохранить черновик</button><button class="button" onclick="save(true)">Опубликовать</button></div></div></section>
<section id="inbox" class="inbox"><div class="top"><div><h1 id="inbox-title">Отклики</h1><p>Ответы на форму.</p></div><button class="button secondary" onclick="showList()">Назад</button></div><div class="card" id="responses"></div></section></main>`;
  const script = `
let forms=[],editing=null;const $=id=>document.getElementById(id);
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
async function api(url,options={}){const r=await fetch(url,{...options,headers:{"Content-Type":"application/json",...options.headers}});const d=await r.json();if(!r.ok)throw Error(d.error||"Ошибка запроса");return d}
function show(id){["list","editor","inbox"].forEach(s=>$(s).style.display=s===id?"block":"none")}
function showList(){editing=null;show("list");load()}
async function load(){try{forms=(await api("/api/forms")).forms;$("forms").innerHTML=forms.length?forms.map(f=>'<article class="card form-card"><div class="details"><h3>'+esc(f.title)+'</h3><p>'+esc(f.description||"Без описания")+' · '+f.fields.length+' вопросов · '+f.responseCount+' откликов</p></div><span class="badge '+(f.status==="published"?"live":"")+'">'+(f.status==="published"?"Опубликована":"Черновик")+'</span><div class="actions">'+(f.status==="published"?'<button class="button secondary" onclick="copyLink(\\''+f.id+'\\')">Ссылка</button><button class="button secondary" onclick="openResponses(\\''+f.id+'\\')">Отклики</button>':'<button class="button secondary" onclick="editForm(\\''+f.id+'\\')">Изменить</button>')+'</div></article>').join(""):'<div class="card empty"><h2>Пока нет форм</h2><p>Создайте форму и отправьте ссылку студентам.</p><button class="button" onclick="newForm()">Создать первую форму</button></div>'}catch(e){$("forms").textContent=e.message}}
function newForm(){editing={title:"",description:"",fields:[{id:crypto.randomUUID(),label:"Как вас зовут?",type:"text",required:true},{id:crypto.randomUUID(),label:"Электронная почта",type:"email",required:true},{id:crypto.randomUUID(),label:"Почему вам интересна эта возможность?",type:"textarea",required:false}]};draw()}
async function editForm(id){try{editing=(await api("/api/forms/"+id)).form;draw()}catch(e){alert(e.message)}}
function draw(){show("editor");$("editor-title").textContent=editing.id?"Изменить форму":"Новая форма";$("title").value=editing.title;$("description").value=editing.description;drawQuestions()}
function drawQuestions(){$("questions").innerHTML=editing.fields.map(f=>'<div class="question" data-id="'+f.id+'"><input type="text" placeholder="Название вопроса" value="'+esc(f.label)+'"><select>'+[['text','Короткий текст'],['email','Электронная почта'],['textarea','Развёрнутый ответ']].map(([v,l])=>'<option value="'+v+'" '+(f.type===v?'selected':'')+'>'+l+'</option>').join("")+'</select><label><input type="checkbox" '+(f.required?'checked':'')+'> Обязательное</label><button class="remove" onclick="removeQuestion(\\''+f.id+'\\')">×</button></div>').join("")}
function addQuestion(){if(editing.fields.length>=30)return alert("Не более 30 вопросов.");editing.fields.push({id:crypto.randomUUID(),label:"",type:"text",required:false});drawQuestions()}
function removeQuestion(id){editing.fields=editing.fields.filter(f=>f.id!==id);drawQuestions()}
function values(){editing.title=$("title").value.trim();editing.description=$("description").value.trim();editing.fields=[...document.querySelectorAll(".question")].map(row=>({id:row.dataset.id,label:row.querySelector('input[type="text"]').value.trim(),type:row.querySelector("select").value,required:row.querySelector('input[type="checkbox"]').checked}));return editing}
async function save(publish){try{const f=values();if(!f.title)throw Error("Введите название формы.");if(!f.fields.length)throw Error("Добавьте хотя бы один вопрос.");const result=await api(f.id?"/api/forms/"+f.id:"/api/forms",{method:f.id?"PUT":"POST",body:JSON.stringify(f)});editing=result.form;if(publish){const published=await api("/api/forms/"+editing.id+"/publish",{method:"POST",body:"{}"});await load();show("list");const link=location.origin+published.url;try{await navigator.clipboard.writeText(link);alert("Форма опубликована. Ссылка скопирована.")}catch{prompt("Ссылка на форму:",link)}}else{await load();show("list");alert("Черновик сохранён.")}}catch(e){alert(e.message)}}
async function copyLink(id){const link=location.origin+"/f/"+id;try{await navigator.clipboard.writeText(link);alert("Ссылка скопирована.")}catch{prompt("Ссылка на форму:",link)}}
async function openResponses(id){try{const result=await api("/api/forms/"+id+"/responses");$("inbox-title").textContent=result.form.title+" — отклики";$("responses").innerHTML=result.responses.length?result.responses.map(r=>'<div class="response"><time>'+new Date(r.createdAt).toLocaleString("ru-RU")+'</time>'+result.form.fields.map(f=>'<div class="answer"><strong>'+esc(f.label)+'</strong>'+esc(r.answers[f.id]||"—")+'</div>').join("")+'</div>').join(""):'<p>Пока нет откликов.</p>';show("inbox")}catch(e){alert(e.message)}}
load();`;
  return page("CareerForm — админка", body, script);
}

export function publicPage(form) {
  if (!form) {
    return page("Форма не найдена", `<header><a href="/admin">CareerForm</a></header><main class="public"><div class="card"><h1>Форма не найдена</h1><p>Ссылка устарела или форма ещё не опубликована.</p></div></main>`);
  }
  const fields = form.fields.map((field) => `<label for="${field.id}">${escapeHtml(field.label)}${field.required ? " *" : ""}</label>${field.type === "textarea"
    ? `<textarea id="${field.id}" rows="4" ${field.required ? "required" : ""}></textarea>`
    : `<input id="${field.id}" type="${field.type === "email" ? "email" : "text"}" ${field.required ? "required" : ""}>`}`).join("");
  const body = `<header><a href="/admin">CareerForm</a><span>Форма отклика</span></header><main class="public"><div class="card"><h1>${escapeHtml(form.title)}</h1><p>${escapeHtml(form.description)}</p><form id="apply">${fields}<p id="error" class="error"></p><button class="button">Отправить отклик</button></form></div></main>`;
  const values = form.fields.map((field) => `answers[${JSON.stringify(field.id)}]=document.getElementById(${JSON.stringify(field.id)}).value;`).join("");
  const script = `document.getElementById("apply").addEventListener("submit",async event=>{event.preventDefault();const answers={};${values}try{const r=await fetch("/api/forms/${form.id}/responses",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({answers})});const result=await r.json();if(!r.ok)throw Error(result.error);document.querySelector("main").innerHTML='<div class="card success"><h1>Спасибо!</h1><p>Ваш отклик отправлен.</p></div>'}catch(error){document.getElementById("error").textContent=error.message}});`;
  return page(form.title, body, script);
}
