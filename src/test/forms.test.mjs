import test from "node:test";
import assert from "node:assert/strict";
import { prepareForm, validateAnswers } from "../functions/forms.mjs";

test("form builder accepts supported question types", () => {
  const form = prepareForm({
    title: "Стажировка",
    fields: [{ label: "Почта", type: "email", required: true }],
  });
  assert.equal(form.title, "Стажировка");
  assert.equal(form.fields[0].type, "email");
  assert.equal(form.fields[0].required, true);
});

test("form builder rejects forms without questions", () => {
  assert.throws(() => prepareForm({ title: "Пустая форма", fields: [] }), {
    message: "Добавьте от 1 до 30 вопросов.",
    statusCode: 400,
  });
});

test("required email answers are validated", () => {
  const form = prepareForm({
    title: "Отклик",
    fields: [{ id: "b4b0e7b9-a278-4fb7-8b0e-82d370d8305c", label: "Почта", type: "email", required: true }],
  });
  assert.throws(() => validateAnswers(form, { [form.fields[0].id]: "not-an-email" }), {
    message: "Проверьте электронную почту в поле «Почта».",
    statusCode: 400,
  });
  assert.equal(validateAnswers(form, { [form.fields[0].id]: "student@example.com" })[form.fields[0].id], "student@example.com");
});
