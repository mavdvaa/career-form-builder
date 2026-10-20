import { createServer } from "node:http";
import { handler } from "./handler.mjs";

const port = Number(process.env.PORT) || 3000;
const maxBodySize = 1024 * 1024;

function readBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
      if (Buffer.byteLength(body) > maxBodySize) {
        reject(Object.assign(new Error("Запрос больше 1 МБ."), { statusCode: 413 }));
        request.destroy();
      }
    });
    request.on("end", () => resolve(body));
    request.on("error", reject);
  });
}

createServer(async (request, response) => {
  try {
    const body = ["POST", "PUT", "PATCH"].includes(request.method)
      ? await readBody(request)
      : "";
    const result = await handler({
      httpMethod: request.method,
      path: new URL(request.url, `http://${request.headers.host || "localhost"}`).pathname,
      body,
    });
    response.writeHead(result.statusCode, result.headers);
    response.end(result.body);
  } catch (error) {
    console.error(error);
    if (!response.headersSent) {
      response.writeHead(error.statusCode || 500, { "Content-Type": "application/json; charset=utf-8" });
      response.end(JSON.stringify({ error: error.statusCode ? error.message : "Внутренняя ошибка сервера." }));
    } else {
      response.destroy(error);
    }
  }
}).listen(port, "0.0.0.0", () => {
  console.log(`Сервер запущен: http://localhost:${port}/admin`);
});
