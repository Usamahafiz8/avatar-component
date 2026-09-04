import { defineConfig, loadEnv, type Plugin } from "vite";
import { handleAnalyzeFaceRequest } from "./analyze-face-core.mjs";

// Dev-only /api/analyze-face endpoint, proxying to Gemini via the shared
// analyze-face-core.mjs (copied from avatar-anim-v2). GEMINI_API_KEY is read
// here, in vite.config.ts's own Node process — it never reaches client code
// or the browser bundle. A real deploy of this project would need an actual
// serverless function (Vercel/Netlify) for the same endpoint, the way
// avatar-anim-v2 has one per platform; this only covers `npm run dev`.
function analyzeFaceDevApi(geminiApiKey: string | undefined): Plugin {
  return {
    name: "analyze-face-dev-api",
    configureServer(server) {
      server.middlewares.use("/api/analyze-face", async (req, res) => {
        if (req.method !== "POST") {
          res.statusCode = 405;
          res.end(JSON.stringify({ error: "Method not allowed" }));
          return;
        }
        let raw = "";
        req.on("data", (chunk: Buffer) => {
          raw += chunk.toString();
        });
        req.on("end", () => {
          void (async () => {
            let parsedBody: unknown;
            try {
              parsedBody = JSON.parse(raw);
            } catch {
              res.statusCode = 400;
              res.end(JSON.stringify({ error: "Invalid request body" }));
              return;
            }
            const { status, body } = await handleAnalyzeFaceRequest(parsedBody, geminiApiKey);
            res.statusCode = status;
            res.setHeader("content-type", "application/json");
            res.end(JSON.stringify(body));
          })();
        });
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    root: ".",
    build: {
      outDir: "dist",
      target: "es2022",
    },
    plugins: [analyzeFaceDevApi(env.GEMINI_API_KEY)],
  };
});
