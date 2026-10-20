import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateAnswers } from "../functions/forms.mjs";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const dataFile = process.env.DATA_FILE || path.join(projectRoot, "data", "store.json");
let updateQueue = Promise.resolve();

async function readData() {
  try {
    return JSON.parse(await readFile(dataFile, "utf8"));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    return { forms: [], responses: [] };
  }
}

function changeData(callback) {
  const update = updateQueue.then(async () => {
    const data = await readData();
    const result = await callback(data);
    await mkdir(path.dirname(dataFile), { recursive: true });
    const tempFile = `${dataFile}.${randomUUID()}.tmp`;
    await writeFile(tempFile, JSON.stringify(data, null, 2), "utf8");
    await rename(tempFile, dataFile);
    return result;
  });
  updateQueue = update.catch(() => {});
  return update;
}

export async function listForms() {
  const data = await readData();
  return data.forms.map((form) => ({
    ...form,
    responseCount: data.responses.filter((response) => response.formId === form.id).length,
  }));
}

export async function getForm(id) {
  const data = await readData();
  return data.forms.find((form) => form.id === id) || null;
}

export function createForm(values) {
  return changeData((data) => {
    const now = new Date().toISOString();
    const form = {
      id: randomUUID(),
      ...values,
      status: "draft",
      createdAt: now,
      updatedAt: now,
    };
    data.forms.unshift(form);
    return form;
  });
}

export function updateForm(id, values) {
  return changeData((data) => {
    const form = data.forms.find((item) => item.id === id);
    if (!form) return null;
    Object.assign(form, values, { updatedAt: new Date().toISOString() });
    return form;
  });
}

export function publishForm(id) {
  return changeData((data) => {
    const form = data.forms.find((item) => item.id === id);
    if (!form) return null;
    form.status = "published";
    form.updatedAt = new Date().toISOString();
    return form;
  });
}

export async function getResponses(formId) {
  const data = await readData();
  const form = data.forms.find((item) => item.id === formId);
  if (!form) return null;
  const responses = data.responses
    .filter((response) => response.formId === formId)
    .sort((first, second) => second.createdAt.localeCompare(first.createdAt));
  return { form, responses };
}

export function addResponse(formId, input) {
  return changeData((data) => {
    const form = data.forms.find((item) => item.id === formId && item.status === "published");
    if (!form) return null;
    const response = {
      id: randomUUID(),
      formId,
      answers: validateAnswers(form, input),
      createdAt: new Date().toISOString(),
    };
    data.responses.push(response);
    return response;
  });
}
