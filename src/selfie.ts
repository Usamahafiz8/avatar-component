// Selfie upload -> AI trait detection (2026-09, Osama's request). Talks to
// the dev-only /api/analyze-face endpoint (see vite.config.ts), which
// proxies to Gemini via analyze-face-core.mjs — same call avatar-anim-v2
// makes, copied verbatim.
//
// Deliberately lighter than avatar-anim-v2's full pipeline: that version
// also runs a local MediaPipe FaceLandmarker pass first, for quality gates
// (no face / multiple faces / too dark / turned too far) and as a free
// fallback when Gemini isn't configured. This is the direct Gemini-only
// path — simpler, but a non-face image or a bad photo won't be caught
// before the request goes out, it'll just come back as Gemini's best guess
// (or a clean error if the request itself fails). Worth adding the local
// quality-gate pass back in if bad uploads turn out to be a real problem.
import type { FaceAnalysis } from "./character";

// 640px/0.85 quality (avatar-anim-v2's original values) throws away real
// detail Gemini needs for the subtler reads (jaw width, face length, exact
// skin/eye tone) — 2026-09, Osama reported across-the-board inaccuracy.
// 1280px/0.92 keeps the request small enough to stay well under Gemini's
// upload limits and this project's own 5MB cap (MAX_IMAGE_BYTES in
// analyze-face-core.mjs) while giving the model meaningfully more to work
// with than a phone-camera-shrunk-to-640px selfie.
function imageToBase64Jpeg(img: HTMLImageElement, maxSide = 1280): string {
  const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.max(1, Math.round(img.naturalWidth * scale));
  const h = Math.max(1, Math.round(img.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2d context unavailable");
  ctx.drawImage(img, 0, 0, w, h);
  const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
  return dataUrl.slice(dataUrl.indexOf(",") + 1);
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read that image file"));
    };
    img.src = url;
  });
}

export class SelfieAnalysisError extends Error {}

export async function analyzeSelfie(file: File): Promise<FaceAnalysis> {
  const img = await loadImage(file);
  const image = imageToBase64Jpeg(img);
  const res = await fetch("/api/analyze-face", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ image, mimeType: "image/jpeg" }),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    if (res.status === 503) {
      throw new SelfieAnalysisError("AI detection isn't configured — add GEMINI_API_KEY to .env.local and restart the dev server.");
    }
    throw new SelfieAnalysisError(body?.error ?? `AI detection failed (${res.status})`);
  }
  return (await res.json()) as FaceAnalysis;
}
