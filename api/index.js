export default async (req, res) => {
  const { app } = await import("../dist/wondrvoices/server/server.mjs");
  return app(req, res);
};