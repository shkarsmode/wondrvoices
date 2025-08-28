// api/index.js  — Node.js serverless function (Vercel)
let appPromise;

export default async function handler(req, res) {
  // ленивый одноразовый импорт (без двойных импортов)
  if (!appPromise) {
    appPromise = import("../dist/wondrvoices/server/server.mjs");
  }

  const { app } = await appPromise; // app: (req, res) => any
  return app(req, res);
}
