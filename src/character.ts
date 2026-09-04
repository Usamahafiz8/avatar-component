// Ported from avatar-anim-v2/demo.html — rig loading, tint, glasses/beard/
// hair accessories, face-shape deformation, and texture-painted eye/lip
// colour, typed for avatar-component's TS/Vite setup. Numeric values (bone
// axes, UV rects, beard/hair geometry) are copied verbatim from measured/
// verified calibration — see project memory "avatar rig calibration" for
// how each was derived. Do not re-derive them.
//
// The hand-authored "Point" clip and the manual "Idle" trigger were removed
// 2026-09 at Osama's request — the rig still has a resting Idle pose (dances
// crossfade back to it automatically), it's just no longer a clickable move.
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";

export type BodyType = "male" | "female";
export type BeardStyleKey = "none" | "thin" | "stubble" | "goatee" | "medium" | "full";
export type HairStyleKey =
  | "default"
  | "buzz"
  | "crop"
  | "fade"
  | "swept"
  | "quiff"
  | "curly"
  | "afro"
  | "mohawk"
  | "ponytail"
  | "bun"
  | "long";

const MODELS: Record<BodyType, string> = {
  male: "/models/rpm/Masculine.glb",
  female: "/models/rpm/Feminine.glb",
};

// The shared animation library. One shared skeleton means these clips
// retarget onto EITHER body regardless of their own F_/M_ prefix (confirmed:
// the F_-prefixed clips already play correctly on the male body below) — a
// dance costs ~150-200KB once, not per player. "Idle" stays in this list
// (rebuild() needs its clip loaded as the rest state every other move
// crossfades back into) but is filtered out of CLIP_LABELS below since it's
// not a move you click, just where things land.
//
// Full available dance set from the library's shared dance/ folder (2026-09,
// Osama's request for at least 10) — all 15 that exist there, not a curated
// subset like avatar-anim-v2's (which cut weaker reactions for not reading
// as their label; revisit that kind of curation here if some read badly).
//
// Plus the library's OTHER shared reaction category, expression/ (2026-09,
// Osama's request for "the other reactions" too) — all 33 available (6
// F_Talking_Variations, 17 M_Standing_Expressions, 10 M_Talking_Variations).
// Same non-curated approach: avatar-anim-v2 hand-picked just 2 clips from
// this exact category (Laugh, Lose) after finding most others read wrong
// for their label (e.g. an "Angry" clip that was actually a thumbs-up) —
// expect the same here. The Reactions tab's ▶ Test button is exactly the
// tool for finding which of these 33 are actually worth keeping.
interface ClipDef {
  label: string;
  file: string;
}
const CLIP_LIBRARY: ClipDef[] = [
  { label: "Idle", file: "F_Standing_Idle_001" },
  { label: "Dance 1", file: "F_Dances_001" },
  { label: "Dance 2", file: "F_Dances_004" },
  { label: "Dance 3", file: "F_Dances_005" },
  { label: "Dance 4", file: "F_Dances_006" },
  { label: "Dance 5", file: "F_Dances_007" },
  { label: "Dance 6", file: "M_Dances_001" },
  { label: "Dance 7", file: "M_Dances_002" },
  { label: "Dance 8", file: "M_Dances_003" },
  { label: "Dance 9", file: "M_Dances_004" },
  { label: "Dance 10", file: "M_Dances_005" },
  { label: "Dance 11", file: "M_Dances_006" },
  { label: "Dance 12", file: "M_Dances_007" },
  { label: "Dance 13", file: "M_Dances_008" },
  { label: "Dance 14", file: "M_Dances_009" },
  { label: "Dance 15", file: "M_Dances_011" },
  { label: "Reaction 1", file: "F_Talking_Variations_001" },
  { label: "Reaction 2", file: "F_Talking_Variations_002" },
  { label: "Reaction 3", file: "F_Talking_Variations_003" },
  { label: "Reaction 4", file: "F_Talking_Variations_004" },
  { label: "Reaction 5", file: "F_Talking_Variations_005" },
  { label: "Reaction 6", file: "F_Talking_Variations_006" },
  { label: "Reaction 7", file: "M_Standing_Expressions_001" },
  { label: "Reaction 8", file: "M_Standing_Expressions_002" },
  { label: "Reaction 9", file: "M_Standing_Expressions_004" },
  { label: "Reaction 10", file: "M_Standing_Expressions_005" },
  { label: "Reaction 11", file: "M_Standing_Expressions_006" },
  { label: "Reaction 12", file: "M_Standing_Expressions_007" },
  { label: "Reaction 13", file: "M_Standing_Expressions_008" },
  { label: "Reaction 14", file: "M_Standing_Expressions_009" },
  { label: "Reaction 15", file: "M_Standing_Expressions_010" },
  { label: "Reaction 16", file: "M_Standing_Expressions_011" },
  { label: "Reaction 17", file: "M_Standing_Expressions_012" },
  { label: "Reaction 18", file: "M_Standing_Expressions_013" },
  { label: "Reaction 19", file: "M_Standing_Expressions_014" },
  { label: "Reaction 20", file: "M_Standing_Expressions_015" },
  { label: "Reaction 21", file: "M_Standing_Expressions_016" },
  { label: "Reaction 22", file: "M_Standing_Expressions_017" },
  { label: "Reaction 23", file: "M_Standing_Expressions_018" },
  { label: "Reaction 24", file: "M_Talking_Variations_001" },
  { label: "Reaction 25", file: "M_Talking_Variations_002" },
  { label: "Reaction 26", file: "M_Talking_Variations_003" },
  { label: "Reaction 27", file: "M_Talking_Variations_004" },
  { label: "Reaction 28", file: "M_Talking_Variations_005" },
  { label: "Reaction 29", file: "M_Talking_Variations_006" },
  { label: "Reaction 30", file: "M_Talking_Variations_007" },
  { label: "Reaction 31", file: "M_Talking_Variations_008" },
  { label: "Reaction 32", file: "M_Talking_Variations_009" },
  { label: "Reaction 33", file: "M_Talking_Variations_010" },
];
/** Every CLICKABLE move's label, in display order — excludes "Idle" (the
 * automatic rest state, not a triggerable move). Used to build UI controls
 * without hardcoding the list a second time. */
export const CLIP_LABELS: readonly string[] = CLIP_LIBRARY.filter((c) => c.label !== "Idle").map((c) => c.label);

// None of these clips carry a real descriptive name anywhere — not in the
// GLB (clip.name is just the filename baked in, confirmed by inspecting
// several before assuming), not in the animation-library's own docs (its
// readme repeats the filename as the caption too). What RPM's repo DOES
// have is a real rendered preview per clip (an animated WebP loop, ~70+
// frames, at feminine/webp/<dance|expression>/<file>.webp — same path for
// every file regardless of its own F_/M_ prefix, confirmed same as the GLBs
// themselves) — a reliable way to see what a move actually is, which is
// worth more than a guessed name (avatar-anim-v2's own history: an "Angry"
// clip that was actually a thumbs-up). Maps a move's label to its preview
// image URL for the Reactions tab.
export function previewUrlFor(label: string): string | null {
  const entry = CLIP_LIBRARY.find((c) => c.label === label);
  if (!entry) return null;
  return `/models/rpm/previews/${entry.file}.webp`;
}

interface LoadedModel {
  scene: THREE.Object3D;
  height: number;
  minY: number;
}

const loader = new GLTFLoader();
const modelCache = new Map<string, LoadedModel>();
let cachedClipLibrary: THREE.AnimationClip[] | null = null;

async function loadModel(bodyType: BodyType): Promise<LoadedModel> {
  const url = MODELS[bodyType];
  const cached = modelCache.get(url);
  if (cached) return cached;
  const gltf = await loader.loadAsync(url);
  // Two traps that each silently render the character ~20x too small (see
  // avatar-anim-v2): Box3.setFromObject on a SkinnedMesh reads BIND-POSE
  // bounds, and a clone reports the same wrong numbers — measure the SOURCE
  // scene once, before any cloning, using computeBoundingBox() on the mesh.
  gltf.scene.updateMatrixWorld(true);
  const box = new THREE.Box3();
  gltf.scene.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return;
    if (o instanceof THREE.SkinnedMesh) {
      o.computeBoundingBox();
      if (o.boundingBox) box.union(o.boundingBox.clone().applyMatrix4(o.matrixWorld));
      return;
    }
    if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
    if (o.geometry.boundingBox) box.union(o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld));
  });
  const loaded: LoadedModel = { scene: gltf.scene, height: box.max.y - box.min.y, minY: box.min.y };
  modelCache.set(url, loaded);
  return loaded;
}

async function loadClipLibrary(): Promise<THREE.AnimationClip[]> {
  if (cachedClipLibrary) return cachedClipLibrary;
  const clips: THREE.AnimationClip[] = [];
  for (const { label, file } of CLIP_LIBRARY) {
    const gltf = await loader.loadAsync(`/models/rpm/clips/${file}.glb`);
    const clip = gltf.animations[0];
    if (!clip) continue;
    clip.name = label;
    clips.push(clip);
  }
  cachedClipLibrary = clips;
  return clips;
}

// ---- glasses accessory (no separate mesh on this body, so real geometry) --
function buildGlasses(): THREE.Group {
  const g = new THREE.Group();
  const frameMat = new THREE.MeshStandardMaterial({ color: 0x1c1c1c, roughness: 0.3, metalness: 0.6 });
  const lensMat = new THREE.MeshPhysicalMaterial({
    color: 0x2a3a48,
    transparent: true,
    opacity: 0.32,
    roughness: 0.08,
    metalness: 0,
    clearcoat: 1,
    clearcoatRoughness: 0.1,
    side: THREE.DoubleSide,
  });
  const lensGeo = new THREE.TorusGeometry(0.025, 0.0028, 8, 24);
  const glassGeo = new THREE.CircleGeometry(0.025, 24);
  function eye(x: number): THREE.Group {
    const grp = new THREE.Group();
    const ring = new THREE.Mesh(lensGeo, frameMat);
    const glass = new THREE.Mesh(glassGeo, lensMat);
    glass.position.z = 0.001;
    grp.add(ring, glass);
    grp.position.set(x, 0, 0);
    return grp;
  }
  const lensL = eye(-0.034);
  const lensR = eye(0.034);
  const bridge = new THREE.Mesh(new THREE.CylinderGeometry(0.0022, 0.0022, 0.018, 6), frameMat);
  bridge.rotation.z = Math.PI / 2;
  const armGeo = new THREE.CylinderGeometry(0.002, 0.002, 0.1, 6);
  const armL = new THREE.Mesh(armGeo, frameMat);
  armL.position.set(-0.058, 0, -0.045);
  armL.rotation.x = Math.PI / 2;
  const armR = new THREE.Mesh(armGeo, frameMat);
  armR.position.set(0.058, 0, -0.045);
  armR.rotation.x = Math.PI / 2;
  g.add(lensL, lensR, bridge, armL, armR);
  g.name = "glassesAccessory";
  return g;
}

// ---- feathered alpha maps: alphaMap reads the texture's GREEN channel as --
// opacity, NOT the canvas's own alpha — every gradient here is encoded as an
// actual grayscale VALUE on an opaque canvas, never rgba(...,alpha).
const featherMapCache = new Map<string, THREE.CanvasTexture>();
function featherAlphaMap(midStop: number, key: string): THREE.CanvasTexture {
  const cached = featherMapCache.get(key);
  if (cached) return cached;
  const cv = document.createElement("canvas");
  cv.width = 8;
  cv.height = 128;
  const ctx = cv.getContext("2d");
  if (!ctx) throw new Error("2d context unavailable");
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, 8, 128);
  const grad = ctx.createLinearGradient(0, 0, 0, 128);
  grad.addColorStop(0, "#fff");
  grad.addColorStop(midStop, "#fff");
  grad.addColorStop(Math.min(0.99, midStop + 0.28), "#888");
  grad.addColorStop(1, "#000");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 8, 128);
  const tex = new THREE.CanvasTexture(cv);
  featherMapCache.set(key, tex);
  return tex;
}

// ---- beard shapes: small stacks of overlapping ellipsoids following the ---
// jaw's curve, sized/positioned against MEASURED head-bone-local bind-space
// geometry (skinIndex/skinWeight >= 0.5 for Head, mapped through
// mesh.bindMatrix + skeleton.boneInverses[Head]).
interface BeardPart {
  pos: [number, number, number];
  scale: [number, number, number];
  rotZ?: number;
}
interface BeardStyleConfig {
  parts: BeardPart[];
  density: number;
  colorMul: number;
}
const BEARD_STYLES: Record<Exclude<BeardStyleKey, "none">, BeardStyleConfig> = {
  thin: {
    parts: [
      { pos: [0, -0.011, 0.065], scale: [0.016, 0.015, 0.03] },
      { pos: [0.023, 0.009, 0.082], scale: [0.019, 0.022, 0.032], rotZ: -0.25 },
      { pos: [-0.023, 0.009, 0.082], scale: [0.019, 0.022, 0.032], rotZ: 0.25 },
    ],
    density: 0.42,
    colorMul: 1,
  },
  stubble: {
    parts: [
      { pos: [0, -0.013, 0.067], scale: [0.02, 0.018, 0.032] },
      { pos: [0.026, 0.007, 0.085], scale: [0.024, 0.028, 0.036], rotZ: -0.25 },
      { pos: [-0.026, 0.007, 0.085], scale: [0.024, 0.028, 0.036], rotZ: 0.25 },
      { pos: [0, 0.029, 0.105], scale: [0.028, 0.011, 0.03] },
    ],
    density: 0.48,
    colorMul: 0.9,
  },
  goatee: {
    parts: [
      { pos: [0, -0.015, 0.069], scale: [0.03, 0.028, 0.02] },
      { pos: [0, 0.028, 0.106], scale: [0.03, 0.013, 0.03] },
      { pos: [0.014, 0.003, 0.083], scale: [0.013, 0.02, 0.033] },
      { pos: [-0.014, 0.003, 0.083], scale: [0.013, 0.02, 0.033] },
    ],
    density: 0.7,
    colorMul: 1,
  },
  medium: {
    parts: [
      { pos: [0, -0.016, 0.067], scale: [0.03, 0.026, 0.02] },
      { pos: [0.026, 0.002, 0.083], scale: [0.026, 0.028, 0.021], rotZ: -0.18 },
      { pos: [-0.026, 0.002, 0.083], scale: [0.026, 0.028, 0.021], rotZ: 0.18 },
      { pos: [0.038, 0.014, 0.091], scale: [0.024, 0.026, 0.019], rotZ: -0.2 },
      { pos: [-0.038, 0.014, 0.091], scale: [0.024, 0.026, 0.019], rotZ: 0.2 },
      { pos: [0, 0.03, 0.106], scale: [0.03, 0.013, 0.015] },
    ],
    density: 0.66,
    colorMul: 1,
  },
  full: {
    parts: [
      { pos: [0, -0.017, 0.067], scale: [0.038, 0.032, 0.026] },
      { pos: [0.03, 0.001, 0.086], scale: [0.034, 0.036, 0.028], rotZ: -0.18 },
      { pos: [-0.03, 0.001, 0.086], scale: [0.034, 0.036, 0.028], rotZ: 0.18 },
      { pos: [0.046, 0.021, 0.099], scale: [0.034, 0.038, 0.028], rotZ: -0.2 },
      { pos: [-0.046, 0.021, 0.099], scale: [0.034, 0.038, 0.028], rotZ: 0.2 },
      { pos: [0, 0.03, 0.108], scale: [0.036, 0.016, 0.018] },
    ],
    density: 0.97,
    colorMul: 1,
  },
};

// A hair-noise texture reads as actual facial hair; a flat fill reads as
// painted-on plastic — layered speckle + short angled strand strokes,
// feathered to black at the rim so alphaMap fades it at the UV border.
const beardMapCache = new Map<string, THREE.CanvasTexture>();
function beardHairMap(density: number, key: string): THREE.CanvasTexture {
  const cached = beardMapCache.get(key);
  if (cached) return cached;
  const n = 320;
  const cv = document.createElement("canvas");
  cv.width = n;
  cv.height = n;
  const ctx = cv.getContext("2d");
  if (!ctx) throw new Error("2d context unavailable");
  const baseGray = Math.round(255 * THREE.MathUtils.clamp(density * 0.95 + 0.05, 0.08, 0.99));
  ctx.fillStyle = `rgb(${baseGray},${baseGray},${baseGray})`;
  ctx.fillRect(0, 0, n, n);
  let seed = 1337;
  const rand = (): number => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
  ctx.lineCap = "round";
  const drawStrands = (
    count: number,
    lenMin: number,
    lenMax: number,
    grayMin: number,
    grayMax: number,
    widthMin: number,
    widthMax: number,
  ): void => {
    for (let i = 0; i < count; i++) {
      const x = rand() * n;
      const y = rand() * n;
      const len = lenMin + rand() * (lenMax - lenMin);
      const ang = Math.PI / 2 + (rand() - 0.5) * 1.1;
      const x2 = x + Math.cos(ang) * len;
      const y2 = y + Math.sin(ang) * len;
      const g = Math.round(grayMin + rand() * (grayMax - grayMin));
      ctx.strokeStyle = `rgb(${g},${g},${g})`;
      ctx.lineWidth = widthMin + rand() * (widthMax - widthMin);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }
  };
  drawStrands(Math.round(density * 11000), 2, 5, baseGray * 0.5, Math.min(255, baseGray * 1.3 + 40), 0.7, 1.2);
  drawStrands(Math.round(density * 3000), 4, 8, baseGray * 0.3, Math.min(255, baseGray * 1.15 + 25), 0.5, 0.8);
  const featherStart = THREE.MathUtils.lerp(0.55, 0.74, density);
  const featherEnd = THREE.MathUtils.lerp(0.8, 0.9, density);
  const feather = ctx.createRadialGradient(n / 2, n / 2, n * featherStart, n / 2, n / 2, n * featherEnd);
  feather.addColorStop(0, "rgba(255,255,255,1)");
  feather.addColorStop(1, "rgba(255,255,255,0)");
  ctx.globalCompositeOperation = "destination-in";
  ctx.fillStyle = feather;
  ctx.fillRect(0, 0, n, n);
  ctx.globalCompositeOperation = "source-over";
  const tex = new THREE.CanvasTexture(cv);
  beardMapCache.set(key, tex);
  return tex;
}

function buildBeard(style: Exclude<BeardStyleKey, "none">, hex?: number): THREE.Group {
  const cfg = BEARD_STYLES[style] ?? BEARD_STYLES.full;
  const group = new THREE.Group();
  group.name = "beardAccessory";
  const tinted = hex ? new THREE.Color(hex).lerp(new THREE.Color(0x000000), 0.12) : new THREE.Color(0x2a1912);
  const mat = new THREE.MeshStandardMaterial({
    color: tinted.multiplyScalar(cfg.colorMul),
    roughness: 1,
    metalness: 0,
    transparent: true,
    alphaMap: beardHairMap(cfg.density, `beard-${style}`),
  });
  const geo = new THREE.SphereGeometry(1, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.5);
  for (const part of cfg.parts) {
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = Math.PI; // dome opens downward, hugging the jaw/chin
    if (part.rotZ) mesh.rotation.z += part.rotZ;
    mesh.scale.set(...part.scale);
    mesh.position.set(...part.pos);
    group.add(mesh);
  }
  return group;
}

// ---- hair styles: real geometry swaps covering the scalp (baked hair -----
// can't be recoloured or hidden by painting — its UV footprint scatters
// across nearly the whole atlas, see paintFace's notes below). 2026-09,
// Osama's request for "at least all popular hair styles" — grew from 3
// (buzz/crop/swept, all the same sphere-slice dome at different coverage)
// to 11. Most new ones are still that same dome technique at different
// radius/coverage/proportion — a legitimate way to cover buzz/crop/fade/
// swept/quiff/curly/afro, which really are all "how much rounded volume,
// how far down the scalp." But a dome alone can't read as a ponytail, bun,
// mohawk, or long hair — those get a second (or third) primitive attached,
// same "simple shape, good enough at this render scale" reasoning already
// used for glasses/beard/chain. Honestly out of scope for this technique
// entirely: braids/cornrows, real curl texture — those would need actual
// strand geometry or a normal-mapped texture, not a solid coloured dome.
interface DomeConfig {
  r: number;
  seg: [number, number];
  theta: number;
  y: number;
  z: number;
  scale?: [number, number, number];
  tiltX?: number;
}
const HAIR_DOME: Record<
  Extract<HairStyleKey, "buzz" | "crop" | "fade" | "swept" | "quiff" | "curly" | "afro" | "mohawk" | "ponytail" | "bun" | "long">,
  DomeConfig
> = {
  buzz: { r: 0.1, seg: [16, 12], theta: 0.42, y: 0.115, z: -0.005 },
  crop: { r: 0.11, seg: [16, 12], theta: 0.65, y: 0.1, z: -0.01 },
  // Fade/undercut: short and tight like buzz, but with a bit more built-up
  // height/volume right at the crown (a taller top is the whole visual cue
  // that separates "fade" from a plain buzz at this level of geometric
  // detail — the shaved-sides part of a fade is implicit, since the base
  // texture's own baked hair is already short there).
  fade: { r: 0.1, seg: [16, 12], theta: 0.42, y: 0.118, z: -0.005, scale: [1, 1.35, 1] },
  swept: { r: 0.112, seg: [16, 12], theta: 0.68, y: 0.098, z: -0.02 },
  // Quiff/pompadour: volume concentrated toward the front-top rather than
  // spread evenly — approximated with a forward Z shift, extra height, and
  // a slight forward tilt, not a symmetric dome like the others.
  quiff: { r: 0.115, seg: [16, 12], theta: 0.58, y: 0.108, z: 0.01, scale: [1, 1.45, 1], tiltX: -0.12 },
  // Curly and afro are the same "big round volume" idea at two sizes —
  // curly tighter/smaller, afro larger and closer to a full sphere.
  curly: { r: 0.13, seg: [18, 14], theta: 0.82, y: 0.1, z: -0.01 },
  afro: { r: 0.155, seg: [20, 16], theta: 0.95, y: 0.095, z: -0.012 },
  // Base dome for the three compound styles below — deliberately smaller/
  // tighter (hair pulled back or shaved short on top) since the visual
  // interest is in the attached piece, not the scalp coverage.
  mohawk: { r: 0.095, seg: [14, 10], theta: 0.3, y: 0.115, z: -0.005 },
  ponytail: { r: 0.105, seg: [16, 12], theta: 0.55, y: 0.105, z: -0.008 },
  // Flatter than the other domes on purpose — the bun sphere needs to sit
  // CLEARLY above this dome's own top to read as a separate round shape
  // (measured by screenshot: at matching height it just blended into one
  // slightly-lumpy dome instead of looking like hair-with-a-bun).
  bun: { r: 0.1, seg: [16, 12], theta: 0.4, y: 0.1, z: -0.008 },
  long: { r: 0.108, seg: [16, 12], theta: 0.6, y: 0.102, z: -0.01 },
};
const HAIR_COLOR_DEFAULT = 0x2a1a12;

function buildHairMaterial(hex: number | undefined, key: string): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: hex ?? HAIR_COLOR_DEFAULT,
    roughness: 0.8,
    transparent: true,
    alphaMap: featherAlphaMap(0.55, `hair-${key}`),
  });
}

function buildDome(cfg: DomeConfig, mat: THREE.Material): THREE.Mesh {
  const geo = new THREE.SphereGeometry(cfg.r, cfg.seg[0], cfg.seg[1], 0, Math.PI * 2, 0, Math.PI * cfg.theta);
  const dome = new THREE.Mesh(geo, mat);
  dome.position.set(0, cfg.y, cfg.z);
  if (cfg.scale) dome.scale.set(...cfg.scale);
  if (cfg.tiltX) dome.rotation.x = cfg.tiltX;
  return dome;
}

function buildHairCap(style: Exclude<HairStyleKey, "default">, hex?: number): THREE.Object3D {
  const group = new THREE.Group();
  group.name = "hairAccessory";
  const domeCfg = HAIR_DOME[style];
  const mat = buildHairMaterial(hex, style);
  if (domeCfg) group.add(buildDome(domeCfg, mat));

  // Compound styles: a solid-colour primitive attached to the dome. Not
  // real strand geometry — reads as the right silhouette at this render
  // scale, same reasoning as the chain/glasses/beard accessories.
  //
  // First pass on mohawk/ponytail/bun put the extra piece directly BEHIND
  // the head (negative Z, centred) — measured by screenshot (this rig's own
  // "verify by rendering, don't assume" rule) and found completely
  // invisible: this app's camera is fixed front-on with no rotation
  // control, so anything directly behind the head is hidden by the head
  // itself. Fixed by moving each piece somewhere a front camera can
  // actually see it — up above the crown, or out to the side.
  if (style === "mohawk") {
    // First attempt (scale.y 3.2, y 0.185) clearly read as a mohawk but
    // clipped past the top of this app's fixed camera frame — measured by
    // screenshot, not assumed. Pulled back to stay in frame while still
    // reading as a clear raised spike, not a bump.
    const ridge = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 10), mat);
    ridge.scale.set(0.32, 2.2, 2.2); // thin strip, tall, running front-to-back
    ridge.position.set(0, 0.165, 0.01); // above the crown, near-centred front-back
    group.add(ridge);
  } else if (style === "ponytail") {
    // A high/side ponytail: a small gather visible poking up at the crown,
    // then a tail draping down the FRONT of one shoulder (not straight down
    // the back) so both pieces stay in view from the front.
    const gather = new THREE.Mesh(new THREE.SphereGeometry(0.03, 10, 8), mat);
    gather.position.set(0, 0.16, -0.01);
    group.add(gather);
    const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.007, 0.19, 10), mat);
    tail.position.set(0.065, 0.02, 0.05); // beside the neck, forward of centre
    tail.rotation.z = 0.55; // leans outward over the shoulder, not straight down
    group.add(tail);
  } else if (style === "bun") {
    // A top/high bun, not a low back bun — sits above the crown so its
    // silhouette clears the head outline from the front. Needs real
    // separation from the (deliberately flatter) dome's own top, measured
    // by screenshot — at matching height the two blended into one lumpy
    // shape instead of reading as hair-with-a-bun.
    const bun = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 10), mat);
    bun.position.set(0, 0.2, -0.005);
    group.add(bun);
  } else if (style === "long") {
    const fall = new THREE.Mesh(new THREE.SphereGeometry(0.09, 14, 12), mat);
    fall.scale.set(0.85, 1.9, 0.65);
    fall.position.set(0, -0.09, -0.06); // hangs down the back of the head/neck
    group.add(fall);
  }
  return group;
}

// ---- eye/lip/shirt/pants colour: painted directly onto the shared texture -
// One mesh, one material — no separate eye/lip/shirt/pants geometry — but
// each occupies its own clean, isolated rectangle in the baked atlas (found
// empirically by extracting and visually inspecting the actual texture per
// body, same method as the original eye/lip find; NOT guessed). Shirt and
// pants are new (2026-09, closing the long-standing "outfit isn't
// controllable" gap): the body ships wearing a plain RPM-branded tank top +
// trousers, both solid enough in colour that a `color`-blend paint (shifts
// hue+saturation, keeps the source's own fabric shading/folds/stitching) is
// convincing. Male and female atlases are laid out completely differently
// (confirmed by extracting both) — never assume one body's rect works on
// the other.
type UVRect = [number, number, number, number];
interface PaintUV {
  eye: UVRect;
  lip: UVRect;
  shirt: UVRect;
  pants: UVRect;
}
const FACE_UV: Record<BodyType, PaintUV> = {
  male: {
    eye: [0.79, 0.015, 0.975, 0.205],
    lip: [0.18, 0.239, 0.31, 0.256],
    // Both back+front tank-top views sit side by side here; one wide paint
    // covers both since they're the same garment/colour.
    shirt: [0.03, 0.63, 0.47, 0.98],
    pants: [0.52, 0.02, 0.74, 0.24],
  },
  female: {
    eye: [0.51, 0.51, 0.745, 0.745],
    lip: [0.18, 0.239, 0.31, 0.256],
    shirt: [0.03, 0.63, 0.47, 0.98],
    // Female atlas gives trousers a much bigger region (top-right quadrant)
    // than male's — confirmed by extraction, not assumed symmetric.
    pants: [0.56, 0.1, 0.94, 0.47],
  },
};
function paintAppearance(
  root: THREE.Object3D,
  colors: { eyeColor?: number; lipColor?: number; shirtColor?: number; pantsColor?: number },
  bodyType: BodyType,
): void {
  const { eyeColor, lipColor, shirtColor, pantsColor } = colors;
  if (!eyeColor && !lipColor && !shirtColor && !pantsColor) return;
  const uv = FACE_UV[bodyType] ?? FACE_UV.male;
  root.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    for (const mat of mats as THREE.MeshStandardMaterial[]) {
      const srcMap = mat.map;
      const srcImg = srcMap?.image as HTMLImageElement | undefined;
      if (!srcMap || !srcImg) continue;
      const cv = document.createElement("canvas");
      cv.width = srcImg.width;
      cv.height = srcImg.height;
      const ctx = cv.getContext("2d");
      if (!ctx) continue;
      ctx.drawImage(srcImg, 0, 0);
      const paint = (rect: UVRect, color: string, blend: GlobalCompositeOperation, alpha = 1): void => {
        const [u0, v0, u1, v1] = rect;
        const x0 = u0 * cv.width;
        const y0 = v0 * cv.height;
        const x1 = u1 * cv.width;
        const y1 = v1 * cv.height;
        const cx = (x0 + x1) / 2;
        const cy = (y0 + y1) / 2;
        const rx = (x1 - x0) / 2;
        const ry = (y1 - y0) / 2;
        ctx.save();
        ctx.globalCompositeOperation = blend;
        ctx.globalAlpha = alpha;
        ctx.filter = `blur(${Math.max(2, Math.min(rx, ry) * 0.35)}px)`;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.ellipse(cx, cy, rx * 0.92, ry * 0.92, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      };
      // A wide rect (both back+front garment views side by side) leaves most
      // of the actual fabric OUTSIDE an inscribed ellipse — confirmed by
      // screenshot: painting "White" only lightened a central blob, the
      // corners/shoulders/hem stayed original-dark, and the overall look at
      // render scale read as a muddy grey instead of white. A full-rect
      // fill (light blur just for edge softening, not shape-limiting) covers
      // the whole garment instead.
      const paintRect = (rect: UVRect, color: string, blend: GlobalCompositeOperation, alpha = 1): void => {
        const [u0, v0, u1, v1] = rect;
        const x0 = u0 * cv.width;
        const y0 = v0 * cv.height;
        const w = (u1 - u0) * cv.width;
        const h = (v1 - v0) * cv.height;
        ctx.save();
        ctx.globalCompositeOperation = blend;
        ctx.globalAlpha = alpha;
        ctx.filter = "blur(3px)";
        ctx.fillStyle = color;
        ctx.fillRect(x0, y0, w, h);
        ctx.restore();
      };
      const hex = (n: number): string => `#${n.toString(16).padStart(6, "0")}`;
      if (eyeColor) paint(uv.eye, hex(eyeColor), "hue");
      if (lipColor) paint(uv.lip, hex(lipColor), "color", 0.85);
      // Shirt/pants need a wider colour range than eye/lip (including near-
      // black and near-white, e.g. the specifically-requested "black
      // tracksuit"). A single `color`-blend pass can't reach those: it takes
      // hue+saturation from the paint but LEAVES THE BACKDROP'S LUMINANCE
      // alone — painting white onto a dark navy shirt does nothing visible,
      // because white has no hue/saturation to contribute and the fabric
      // stays dark regardless (confirmed: this was the actual bug, not a
      // guess — a white paint attempt rendered as no change at all).
      // Layering hue+saturation (safe, keeps contrast) with a PARTIAL
      // luminosity pass (nudges brightness toward the target without fully
      // flattening the fabric's own fold/shading detail) covers the full
      // range including black/white.
      const paintGarment = (rect: UVRect, hexColor: string): void => {
        paintRect(rect, hexColor, "hue", 1);
        paintRect(rect, hexColor, "saturation", 1);
        paintRect(rect, hexColor, "luminosity", 1);
      };
      if (shirtColor) paintGarment(uv.shirt, hex(shirtColor));
      if (pantsColor) paintGarment(uv.pants, hex(pantsColor));
      const tex = new THREE.CanvasTexture(cv);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.flipY = srcMap.flipY;
      tex.wrapS = srcMap.wrapS;
      tex.wrapT = srcMap.wrapT;
      mat.map = tex;
      mat.needsUpdate = true;
    }
  });
}

// ---- face-shape deformation: direct vertex-position edits, no morph -------
// targets needed. Reshapes the rest pose the bones skin from — skin weights
// are untouched, so it still animates correctly afterward.
const FACE_Y = { chin: 1.593, jaw: 1.71, brow: 1.8, crown: 1.839 };
const smoothstep = (t: number): number => {
  const c = THREE.MathUtils.clamp(t, 0, 1);
  return c * c * (3 - 2 * c);
};
function jawInfluence(y: number): number {
  if (y <= FACE_Y.chin || y >= FACE_Y.brow) return 0;
  if (y < FACE_Y.jaw) return smoothstep((y - FACE_Y.chin) / (FACE_Y.jaw - FACE_Y.chin));
  return smoothstep(1 - (y - FACE_Y.jaw) / (FACE_Y.brow - FACE_Y.jaw));
}
function applyFaceShape(root: THREE.Object3D, jawWidth: number, faceLength: number): void {
  if (jawWidth === 1 && faceLength === 1) return;
  root.traverse((o) => {
    if (!(o instanceof THREE.SkinnedMesh)) return;
    // Explicit clone, not a reference — SkeletonUtils.clone shares geometry
    // between clones; mutating in place would corrupt the cached base model.
    const geo = o.geometry.clone();
    o.geometry = geo;
    const pos = geo.attributes.position;
    const skinIdx = geo.attributes.skinIndex;
    const skinWt = geo.attributes.skinWeight;
    if (!pos || !skinIdx || !skinWt) return;
    const headBoneIdx = o.skeleton.bones.map((b) => b.name).indexOf("Head");
    if (headBoneIdx < 0) return;
    for (let i = 0; i < pos.count; i++) {
      let w = 0;
      for (let k = 0; k < 4; k++) if (skinIdx.getComponent(i, k) === headBoneIdx) w = Math.max(w, skinWt.getComponent(i, k));
      if (w < 0.5) continue;
      const y = pos.getY(i);
      if (jawWidth !== 1) {
        const influence = jawInfluence(y);
        if (influence > 0) {
          const widthScale = 1 + (jawWidth - 1) * influence;
          pos.setX(i, pos.getX(i) * widthScale);
          pos.setZ(i, pos.getZ(i) * (1 + (jawWidth - 1) * influence * 0.4));
        }
      }
      if (faceLength !== 1 && y < FACE_Y.jaw) {
        // Anchor at the jaw line (fixed), not the browline — anchoring at
        // brow moved the eye socket while the separate eyeball geometry
        // stayed put, producing a googly-eye misalignment.
        pos.setY(i, FACE_Y.jaw - (FACE_Y.jaw - y) * faceLength);
      }
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals();
  });
}

// ---- skin tint (tint = wanted / texture's own average, keeps shading) -----
const textureAverageCache = new Map<string, THREE.Color>();
function textureAverage(mat: THREE.MeshStandardMaterial): THREE.Color {
  const cached = textureAverageCache.get(mat.uuid);
  if (cached) return cached;
  let avg = new THREE.Color(0.5, 0.5, 0.5);
  const im = mat.map?.image as HTMLImageElement | undefined;
  if (im) {
    const cv = document.createElement("canvas");
    const n = 48;
    cv.width = n;
    cv.height = n;
    const ctx = cv.getContext("2d", { willReadFrequently: true });
    if (ctx) {
      try {
        ctx.drawImage(im, 0, 0, n, n);
        const d = ctx.getImageData(0, 0, n, n).data;
        let r = 0;
        let g = 0;
        let b = 0;
        let c = 0;
        for (let i = 0; i < d.length; i += 4) {
          if ((d[i + 3] ?? 0) < 200) continue;
          r += d[i] ?? 0;
          g += d[i + 1] ?? 0;
          b += d[i + 2] ?? 0;
          c++;
        }
        if (c) avg = new THREE.Color(r / c / 255, g / c / 255, b / c / 255);
      } catch {
        // texture not readable (CORS/canvas taint) — fall back to neutral avg
      }
    }
  }
  textureAverageCache.set(mat.uuid, avg);
  return avg;
}

function applyTint(root: THREE.Object3D, hex: number): void {
  const want = new THREE.Color(hex);
  root.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    for (const mat of mats as THREE.MeshStandardMaterial[]) {
      const avg = textureAverage(mat);
      mat.color.setRGB(
        THREE.MathUtils.clamp(want.r / Math.max(0.08, avg.r), 0.35, 1.8),
        THREE.MathUtils.clamp(want.g / Math.max(0.08, avg.g), 0.35, 1.8),
        THREE.MathUtils.clamp(want.b / Math.max(0.08, avg.b), 0.35, 1.8),
      );
    }
  });
}

/** Nearest preset hex to an arbitrary colour — for highlighting a swatch as
 * "closest match" when a value didn't come from clicking that exact swatch
 * (e.g. a future AI/selfie-driven colour). Not needed for pure swatch-click
 * flows (where the state always equals a preset exactly) but kept since it's
 * how avatar-anim-v2's panel stays honest about approximate matches. */
export function nearestPresetHex(hex: number, presets: readonly { hex: number }[]): number | null {
  const c = new THREE.Color(hex);
  let best: number | null = null;
  let bestDist = Infinity;
  for (const p of presets) {
    const pc = new THREE.Color(p.hex);
    const d = (c.r - pc.r) ** 2 + (c.g - pc.g) ** 2 + (c.b - pc.b) ** 2;
    if (d < bestDist) {
      bestDist = d;
      best = p.hex;
    }
  }
  return best;
}

export interface CharacterState {
  bodyType: BodyType;
  tint?: number;
  hasGlasses: boolean;
  beardStyle: BeardStyleKey;
  beardColor?: number;
  eyeColor?: number;
  lipColor?: number;
  hairStyle: HairStyleKey;
  hairColor?: number;
  jawWidth: number;
  faceLength: number;
  /** Recolors the shirt/pants regions of the shared texture atlas (2026-09)
   * — closes the long-standing "outfit isn't controllable" gap, within the
   * limits of a painted-on colour (fabric shading/branding text still
   * shows through; this isn't a different garment, just a different colour
   * of the one that's baked in). */
  shirtColor?: number;
  pantsColor?: number;
}

export const DEFAULT_CHARACTER_STATE: CharacterState = {
  bodyType: "male",
  hasGlasses: false,
  beardStyle: "none",
  hairStyle: "default",
  jawWidth: 1,
  faceLength: 1,
};

// ---- AI face analysis (2026-09, Osama's request: "ai will do the ---------
// customization for me") — maps a Gemini response (see analyze-face-core.mjs,
// copied verbatim from avatar-anim-v2, same prompt/schema) directly onto
// CharacterState. hairStyle/beardStyle enums match this project's own
// HairStyleKey/BeardStyleKey exactly by design (same source), so those need
// no translation. jawWidth/faceLength come back as a category (narrow/
// average/wide, short/average/long) — mapped to modest multipliers, same
// values as avatar-anim-v2's JAW_WIDTH_MAP/FACE_LENGTH_MAP: this drives an
// unattended first build from a photo, not deliberate manual dialing, so it
// stays narrower than the Face Shape sliders' own extremes.
export interface FaceAnalysis {
  bodyType?: "male" | "female";
  skinToneHex?: string;
  eyeColorHex?: string;
  hasGlasses?: boolean;
  hairStyle?: string;
  hairColorHex?: string;
  beardStyle?: string;
  beardColorHex?: string;
  lipColorHex?: string;
  jawWidth?: string;
  faceLength?: string;
}

const JAW_WIDTH_MAP: Record<string, number> = { narrow: 0.9, average: 1, wide: 1.12 };
const FACE_LENGTH_MAP: Record<string, number> = { short: 0.92, average: 1, long: 1.1 };
const HAIR_STYLE_KEYS: readonly HairStyleKey[] = [
  "default",
  "buzz",
  "crop",
  "fade",
  "swept",
  "quiff",
  "curly",
  "afro",
  "mohawk",
  "ponytail",
  "bun",
  "long",
];
const BEARD_STYLE_KEYS: readonly BeardStyleKey[] = ["none", "thin", "stubble", "goatee", "medium", "full"];

function parseHex(hex: string | undefined): number | undefined {
  if (!hex) return undefined;
  const n = Number.parseInt(hex.replace("#", ""), 16);
  return Number.isFinite(n) ? n : undefined;
}

/** Returns a NEW state with the analysis applied over `base` — doesn't
 * mutate `base`. Fields Gemini didn't return (or returned an enum value
 * outside this project's own vocab for) are left exactly as they were,
 * never reset to a default — a partial/uncertain read should never undo a
 * trait the user already had set. Shirt/pants colour are untouched:
 * they're not part of what this schema analyses (outfit, not face). */
export function applyFaceAnalysis(base: CharacterState, traits: FaceAnalysis): CharacterState {
  const next: CharacterState = { ...base };
  if (traits.bodyType === "male" || traits.bodyType === "female") next.bodyType = traits.bodyType;
  const skin = parseHex(traits.skinToneHex);
  if (skin !== undefined) next.tint = skin;
  const eye = parseHex(traits.eyeColorHex);
  if (eye !== undefined) next.eyeColor = eye;
  if (typeof traits.hasGlasses === "boolean") next.hasGlasses = traits.hasGlasses;
  if (traits.hairStyle && (HAIR_STYLE_KEYS as readonly string[]).includes(traits.hairStyle)) {
    next.hairStyle = traits.hairStyle as HairStyleKey;
  }
  const hairColor = parseHex(traits.hairColorHex);
  if (hairColor !== undefined) next.hairColor = hairColor;
  if (traits.beardStyle && (BEARD_STYLE_KEYS as readonly string[]).includes(traits.beardStyle)) {
    next.beardStyle = traits.beardStyle as BeardStyleKey;
  }
  const beardColor = parseHex(traits.beardColorHex);
  if (beardColor !== undefined) next.beardColor = beardColor;
  const lip = parseHex(traits.lipColorHex);
  if (lip !== undefined) next.lipColor = lip;
  if (traits.jawWidth && traits.jawWidth in JAW_WIDTH_MAP) {
    next.jawWidth = JAW_WIDTH_MAP[traits.jawWidth] as number;
  }
  if (traits.faceLength && traits.faceLength in FACE_LENGTH_MAP) {
    next.faceLength = FACE_LENGTH_MAP[traits.faceLength] as number;
  }
  return next;
}

export interface CharacterHandle {
  /** Plays any label from CLIP_LABELS. "Idle" loops forever; everything else
   * plays once, holds briefly (a card-game reaction beat, not a full mocap
   * clip — some source clips run 3-9s), then crossfades back to Idle. */
  play(label: string): void;
  playIdle(): void;
  /** Rebuilds the character from a full state snapshot. Safe to call again
   * before a prior call's model/clip loads settle — a superseded call bails
   * out instead of racing the latest one into `scene`. */
  rebuild(state: CharacterState): Promise<void>;
  dispose(): void;
}

/**
 * Mounts the rigged character into `canvas` and starts a render loop.
 * Known ceiling (see project memory): one merged mesh/material, zero morph
 * targets — shirt/pants COLOR is paintable (see paintAppearance), but it's
 * still the same garment, no different cut/style available.
 */
export async function mountCharacter(canvas: HTMLCanvasElement, initialState: CharacterState): Promise<CharacterHandle> {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
  camera.position.set(0, 0, 5.4);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x1f5f3a, 2.2));
  const keyLight = new THREE.DirectionalLight(0xffffff, 1.6);
  keyLight.position.set(1.4, 3, 4);
  scene.add(keyLight);

  const libraryClips = await loadClipLibrary();

  let root: THREE.Object3D | null = null;
  let mixer: THREE.AnimationMixer | null = null;
  let actions: Record<string, THREE.AnimationAction> = {};
  let current: THREE.AnimationAction | null = null;
  let returnTimer: ReturnType<typeof setTimeout> | undefined;
  let buildGeneration = 0;

  function playIdle(): void {
    const idle = actions["Idle"];
    if (!idle) return;
    idle.reset().setLoop(THREE.LoopRepeat, Infinity).play();
    current = idle;
  }
  function play(label: string): void {
    if (label === "Idle") {
      playIdle();
      return;
    }
    const idle = actions["Idle"];
    const action = actions[label];
    if (!action || !idle) return;
    clearTimeout(returnTimer);
    action.reset();
    action.setLoop(THREE.LoopOnce, 1);
    action.clampWhenFinished = true;
    if (current && current !== action) current.crossFadeTo(action, 0.25, false);
    action.play();
    current = action;
    // Play the full clip, then crossfade home. NOTE: this used to cap the
    // hold at 2.2s (some source clips run 3-9s) per Zack's 08-31 feedback on
    // the first sample — "not suppose to maybe so long... also fade away" —
    // reasoning it's a taunt gesture mid-hand, not a cutscene. Removed at
    // Osama's explicit request (2026-09); worth resolving with the founder
    // before this ships into the real game, not just carried over silently.
    const hold = action.getClip().duration;
    const startFade = Math.max(0.1, hold - 0.45);
    returnTimer = setTimeout(() => {
      action.crossFadeTo(idle, 0.45, false);
      idle.reset().play();
      current = idle;
    }, startFade * 1000);
  }

  async function rebuild(state: CharacterState): Promise<void> {
    const myGeneration = ++buildGeneration;
    const base = await loadModel(state.bodyType);
    if (myGeneration !== buildGeneration) return; // superseded while awaiting

    if (root) {
      mixer?.stopAllAction();
      scene.remove(root);
    }

    const newRoot = cloneSkinned(base.scene) as THREE.Object3D;
    newRoot.traverse((o) => {
      if (!(o instanceof THREE.Mesh)) return;
      o.material = Array.isArray(o.material) ? o.material.map((m) => m.clone()) : o.material.clone();
    });
    if (state.tint) applyTint(newRoot, state.tint);
    paintAppearance(
      newRoot,
      { eyeColor: state.eyeColor, lipColor: state.lipColor, shirtColor: state.shirtColor, pantsColor: state.pantsColor },
      state.bodyType,
    );
    if (state.jawWidth !== 1 || state.faceLength !== 1) applyFaceShape(newRoot, state.jawWidth, state.faceLength);
    scene.add(newRoot);

    let headBone: THREE.Bone | null = null;
    newRoot.traverse((o) => {
      if ((o as THREE.Bone).isBone && o.name === "Head") headBone = o as THREE.Bone;
    });
    if (headBone) {
      const hb: THREE.Bone = headBone;
      if (state.hasGlasses) {
        const glasses = buildGlasses();
        glasses.position.set(0, 0.088, 0.115);
        hb.add(glasses);
      }
      if (state.beardStyle !== "none") {
        hb.add(buildBeard(state.beardStyle, state.beardColor));
      }
      // A chosen hair colour needs actual geometry to show up on — default
      // effective style falls back to 'swept' if only a colour was picked.
      const effectiveHairStyle: Exclude<HairStyleKey, "default"> | null =
        state.hairStyle !== "default" ? state.hairStyle : state.hairColor ? "swept" : null;
      if (effectiveHairStyle) {
        hb.add(buildHairCap(effectiveHairStyle, state.hairColor));
      }
    }

    const newMixer = new THREE.AnimationMixer(newRoot);
    const newActions: Record<string, THREE.AnimationAction> = {};
    for (const clip of libraryClips) newActions[clip.name] = newMixer.clipAction(clip);

    // Frame it: feet on the floor line, matching avatar-anim-v2's demo framing.
    const s = 2.55 / base.height;
    newRoot.scale.setScalar(s);
    newRoot.position.set(0, -base.minY * s - 1.3, 0);

    root = newRoot;
    mixer = newMixer;
    actions = newActions;
    current = null;
    playIdle();
  }

  await rebuild(initialState);

  let raf = 0;
  const clock = new THREE.Clock();
  function resize(): void {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (w === 0 || h === 0) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  function tick(): void {
    raf = requestAnimationFrame(tick);
    mixer?.update(clock.getDelta());
    renderer.render(scene, camera);
  }
  resize();
  window.addEventListener("resize", resize);
  tick();

  return {
    play,
    playIdle,
    rebuild,
    dispose(): void {
      cancelAnimationFrame(raf);
      clearTimeout(returnTimer);
      window.removeEventListener("resize", resize);
      renderer.dispose();
    },
  };
}
