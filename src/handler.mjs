import {
  addResponse,
  createForm,
  getForm,
  getResponses,
  listForms,
  publishForm,
  updateForm,
} from "./db/db.mjs";
import { prepareForm } from "./functions/forms.mjs";
import { adminPage, publicPage } from "./functions/pages.mjs";

function json(statusCode, value) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
    body: JSON.stringify(value),
  };
}

function html(statusCode, body) {
  return {
    statusCode,
    headers: { "Content-Type": "text/html; charset=utf-8" },
    body,
  };
}

function readPayload(body) {
  try {
    return body ? JSON.parse(body) : {};
  } catch {
    throw Object.assign(new Error("Некорректный JSON."), { statusCode: 400 });
  }
}

function notFound() {
  return json(404, { error: "Маршрут не найден." });
}

export async function handler(event) {
  try {
    const { httpMethod, path } = event;
    const formPath = path.match(/^\/api\/forms\/([0-9a-f-]{36})$/i);
    const publishPath = path.match(/^\/api\/forms\/([0-9a-f-]{36})\/publish$/i);
    const responsesPath = path.match(/^\/api\/forms\/([0-9a-f-]{36})\/responses$/i);
    const publicPath = path.match(/^\/f\/([0-9a-f-]{36})$/i);

    if (httpMethod === "GET" && (path === "/" || path === "/admin")) {
      return html(200, adminPage());
    }

    if (httpMethod === "GET" && path === "/api/forms") {
      return json(200, { forms: await listForms() });
    }

    if (httpMethod === "POST" && path === "/api/forms") {
      const form = await createForm(prepareForm(readPayload(event.body)));
      return json(201, { form });
    }

    if (httpMethod === "GET" && formPath) {
      const form = await getForm(formPath[1]);
      return form ? json(200, { form }) : json(404, { error: "Форма не найдена." });
    }

    if (httpMethod === "PUT" && formPath) {
      const form = await updateForm(formPath[1], prepareForm(readPayload(event.body)));
      return form ? json(200, { form }) : json(404, { error: "Форма не найдена." });
    }

    if (httpMethod === "POST" && publishPath) {
      const form = await publishForm(publishPath[1]);
      return form
        ? json(200, { form, url: `/f/${form.id}` })
        : json(404, { error: "Форма не найдена." });
    }

    if (httpMethod === "GET" && responsesPath) {
      const result = await getResponses(responsesPath[1]);
      return result ? json(200, result) : json(404, { error: "Форма не найдена." });
    }

    if (httpMethod === "POST" && responsesPath) {
      const submission = await addResponse(responsesPath[1], readPayload(event.body).answers || {});
      return submission
        ? json(201, { response: submission })
        : json(404, { error: "Опубликованная форма не найдена." });
    }

    if (httpMethod === "GET" && publicPath) {
      const form = await getForm(publicPath[1]);
      return html(form?.status === "published" ? 200 : 404, publicPage(form?.status === "published" ? form : null));
    }

    return notFound();
  } catch (error) {
    if (error.statusCode) return json(error.statusCode, { error: error.message });
    console.error(error);
    return json(500, { error: "Внутренняя ошибка сервера." });
  }
}
