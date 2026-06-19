import express from "express";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync, existsSync } from "node:fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const dist = join(root, "dist");
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf-8"));

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: "512kb" }));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, game: pkg.name, version: pkg.version });
});

app.get("/api/meta", (_req, res) => {
  res.json({
    name: "Last Launch Exodus",
    description:
      "Post-nuclear road survival — stock the depot, lead your party to the last launch window.",
    version: pkg.version,
  });
});

if (existsSync(dist)) {
  app.use(express.static(dist, { maxAge: "1h", index: false }));
  app.get("*", (_req, res) => {
    res.sendFile(join(dist, "index.html"));
  });
} else {
  app.get("*", (_req, res) => {
    res.status(503).send("Build the client first: npm run build");
  });
}

app.listen(PORT, () => {
  console.log(`Last Launch Exodus server → http://localhost:${PORT}`);
});
