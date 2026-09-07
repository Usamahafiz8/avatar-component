// Vercel serverless function (Node runtime, auto-routed from /api/analyze-face
// by file location under api/). This is the missing piece the README already
// flagged: "A real deploy of this project would need an actual serverless
// function... this only covers npm run dev" — vite.config.ts's dev-only
// middleware never runs on Vercel, which is why a deployed instance 404s on
// this path (see project memory / selfie.ts's error mapping — a 404 here
// specifically means Vite's dev middleware, not this function, since the
// Gemini-call failures inside handleAnalyzeFaceRequest map to 502/503/etc,
// never 404).
//
// Copied structure verbatim from avatar-anim-v2/api/analyze-face.js — same
// three-deploy-target pattern (Vercel here, Netlify would be
// netlify/functions/analyze-face.js + netlify.toml, local dev already covered
// by vite.config.ts), all three calling the same shared
// analyze-face-core.mjs so behavior can't drift between them.
//
// GEMINI_API_KEY must be set in the Vercel project's own Environment
// Variables (Settings -> Environment Variables) — .env.local is gitignored
// and never reaches a Vercel deploy, so this needs setting there separately,
// not just locally.
import { handleAnalyzeFaceRequest } from "../analyze-face-core.mjs";

export const config = { api: { bodyParser: { sizeLimit: "6mb" } } };

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const { status, body } = await handleAnalyzeFaceRequest(req.body, process.env.GEMINI_API_KEY);
  res.status(status).json(body);
}
