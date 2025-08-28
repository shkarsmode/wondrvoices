export default async (req, res) => {
  const { app } = await import("../dist/wondrvoices/server/main.js");
  return app(req, res);
};
