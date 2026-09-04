// Download the 3D assets this component needs, at setup time only.
//
// NOT committed, deliberately — same reasoning as avatar-anim-v2's
// fetch-assets.mjs: Ready Player Me's animation-library licence forbids
// redistributing the clips, so this fetches them fresh from RPM's own public
// GitHub repo (via jsdelivr) instead of checking them into git.
//
//   node fetch-assets.mjs
import { mkdir, writeFile, stat } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const ROOT = dirname(__filename);
const LIB = "https://cdn.jsdelivr.net/gh/readyplayerme/animation-library@master";
// jsdelivr occasionally 403s on specific files in this repo (seen on
// M_Dances_002/003, confirmed not an LFS/size issue — same files serve fine
// at their normal ~150-200KB straight from GitHub) — raw.githubusercontent
// as a fallback when that happens. CORS doesn't apply here since this is a
// server-side Node fetch, not a browser one.
const RAW = "https://raw.githubusercontent.com/readyplayerme/animation-library/master";

// Written under public/ so Vite serves them as static files at /models/...
// (dev server and build output both). Same bodies used by avatar-anim-v2 —
// the clip library's own T-pose rigs, one per body type for the Customize
// panel's Male/Female toggle. Paths are relative to the repo root so `get()`
// can build both the jsdelivr URL and the raw.githubusercontent fallback.
const AVATARS = [
  ["public/models/rpm/Masculine.glb", "masculine/glb/Masculine_TPose.glb"],
  ["public/models/rpm/Feminine.glb", "feminine/glb/Feminine_TPose.glb"],
];

// Idle, plus EVERY dance clip in the library's shared dance/ folder (2026-09,
// Osama's request for at least 10) — confirmed by directory listing
// (`api.github.com/repos/readyplayerme/animation-library/contents/feminine/glb/dance`):
// 5 F_-prefixed + 9 M_-prefixed (010 doesn't exist in the set), all living
// under the SAME feminine/glb/dance/ path regardless of prefix, on the one
// shared skeleton — the F_ clips already retarget fine onto the male body
// (see character.ts), so the M_ ones are expected to retarget the same way
// onto either body, not just their named one. Unlike avatar-anim-v2's
// smaller curated set (which cut weaker reactions for not reading as their
// label), this is deliberately the full available set, not re-curated.
// Expression clips (2026-09, Osama's request for "the other reactions" too)
// — the library's OTHER shared category besides dance, confirmed by listing
// feminine/glb/ itself (dance, expression, idle, locomotion exist; only
// dance and expression have actual reaction-shaped content). 6 F_Talking_
// Variations + 17 M_Standing_Expressions (003 doesn't exist) + 10 M_Talking_
// Variations = 33. Same "fetch the full set, let the Reactions tab's Test
// button sort out which ones actually read well" approach as the dance set
// — avatar-anim-v2 hand-curated a tiny handful from this exact category
// (Laugh from F_Talking_Variations_001, Lose from M_Standing_Expressions_007)
// after finding most others read wrong for their label (e.g. an "Angry"
// clip that was actually a thumbs-up) — expect the same here, curate later.
const CLIPS = [
  ["idle", ["F_Standing_Idle_001"]],
  [
    "dance",
    [
      "F_Dances_001",
      "F_Dances_004",
      "F_Dances_005",
      "F_Dances_006",
      "F_Dances_007",
      "M_Dances_001",
      "M_Dances_002",
      "M_Dances_003",
      "M_Dances_004",
      "M_Dances_005",
      "M_Dances_006",
      "M_Dances_007",
      "M_Dances_008",
      "M_Dances_009",
      "M_Dances_011",
    ],
  ],
  [
    "expression",
    [
      "F_Talking_Variations_001",
      "F_Talking_Variations_002",
      "F_Talking_Variations_003",
      "F_Talking_Variations_004",
      "F_Talking_Variations_005",
      "F_Talking_Variations_006",
      "M_Standing_Expressions_001",
      "M_Standing_Expressions_002",
      "M_Standing_Expressions_004",
      "M_Standing_Expressions_005",
      "M_Standing_Expressions_006",
      "M_Standing_Expressions_007",
      "M_Standing_Expressions_008",
      "M_Standing_Expressions_009",
      "M_Standing_Expressions_010",
      "M_Standing_Expressions_011",
      "M_Standing_Expressions_012",
      "M_Standing_Expressions_013",
      "M_Standing_Expressions_014",
      "M_Standing_Expressions_015",
      "M_Standing_Expressions_016",
      "M_Standing_Expressions_017",
      "M_Standing_Expressions_018",
      "M_Talking_Variations_001",
      "M_Talking_Variations_002",
      "M_Talking_Variations_003",
      "M_Talking_Variations_004",
      "M_Talking_Variations_005",
      "M_Talking_Variations_006",
      "M_Talking_Variations_007",
      "M_Talking_Variations_008",
      "M_Talking_Variations_009",
      "M_Talking_Variations_010",
    ],
  ],
];

const exists = async (p) => {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
};

async function fetchBinary(url, magic) {
  const res = await fetch(url);
  if (!res.ok) return { ok: false, status: res.status };
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.subarray(0, magic.length).toString() !== magic) return { ok: false, status: `not-a-${magic}` };
  return { ok: true, buf };
}

async function get(dest, relativePath, magic = "glTF") {
  const full = join(ROOT, dest);
  if (await exists(full)) {
    console.log(`  skip   ${dest}`);
    return;
  }
  await mkdir(dirname(full), { recursive: true });
  let result = await fetchBinary(`${LIB}/${relativePath}`, magic);
  let source = "jsdelivr";
  if (!result.ok) {
    const jsdelivrStatus = result.status;
    result = await fetchBinary(`${RAW}/${relativePath}`, magic);
    source = "raw";
    if (!result.ok) {
      console.error(`  FAIL   ${dest}  (jsdelivr ${jsdelivrStatus}, raw ${result.status})`);
      return;
    }
  }
  await writeFile(full, result.buf);
  const via = source === "raw" ? " (via raw fallback)" : "";
  console.log(`  ok     ${dest}  ${(result.buf.length / 1024).toFixed(0)} KB${via}`);
}

console.log("avatars:");
for (const [dest, relativePath] of AVATARS) await get(dest, relativePath);

console.log("clips:");
for (const [folder, names] of CLIPS)
  for (const n of names) await get(`public/models/rpm/clips/${n}.glb`, `feminine/glb/${folder}/${n}.glb`);

// Preview thumbnails (2026-09, Osama's request — "when I'm selecting I
// should know what that animation is"): none of these clips carry a real
// descriptive name anywhere (confirmed: clip.name in the GLB is just the
// filename baked in, and the library's own readme repeats the filename as
// the caption too) — but the library DOES publish a rendered preview per
// clip, an animated WebP loop, at the same relative path with glb->webp and
// the folder renamed. Browsers autoplay animated WebP in a plain <img>, no
// player needed. Skips "idle" — it isn't a Reactions-tab entry.
console.log("previews:");
for (const [folder, names] of CLIPS) {
  if (folder === "idle") continue;
  for (const n of names) await get(`public/models/rpm/previews/${n}.webp`, `feminine/webp/${folder}/${n}.webp`, "RIFF");
}

console.log("\ndone. now: pnpm dev");
