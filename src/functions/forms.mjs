import { randomUUID } from "node:crypto";

const fieldTypes = new Set(["text", "email", "textarea"]);

export function prepareForm(input) {
  const title = typeof input.title === "string" ? input.title.trim().slice(0, 120) : "";
  if (!title) throw Object.assign(new Error("Укажите название формы."), { statusCode: 400 });
  if (!Array.isArray(input.fields) || input.fields.length < 1 || input.fields.length > 30) {
    throw Object.assign(new Error("Добавьте от 1 до 30 вопросов."), { statusCode: 400 });
  }

  const fields = input.fields.map((field) => {
    const label = typeof field.label === "string" ? field.label.trim().slice(0, 120) : "";
    if (!label || !fieldTypes.has(field.type)) {
      throw Object.assign(new Error("Укажите название и тип каждого вопроса."), { statusCode: 400 });
    }
    return {
      id: typeof field.id === "string" && /^[0-9a-f-]{36}$/i.test(field.id) ? field.id : randomUUID(),
      label,
      type: field.type,
      required: Boolean(field.required),
    };
  });

  return {
    title,
    description: typeof input.description === "string" ? input.description.trim().slice(0, 500) : "",
    fields,
  };
}

export function validateAnswers(form, input) {
  const answers = {};
  for (const field of form.fields) {
    const value = input?.[field.id];
    const answer = typeof value === "string" ? value.trim().slice(0, 5000) : "";
    if (field.required && !answer) {
      throw Object.assign(new Error(`Заполните поле «${field.label}».`), { statusCode: 400 });
    }
    if (field.type === "email" && answer && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(answer)) {
      throw Object.assign(new Error(`Проверьте электронную почту в поле «${field.label}».`), { statusCode: 400 });
    }
    answers[field.id] = answer;
  }
  return answers;
}

export function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character]);
}
