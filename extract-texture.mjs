// Dev utility: extract a body's baked baseColor/diffuse texture atlas as a
// PNG for visual inspection. This is how the shirt/pants paintable regions
// (character.ts's FACE_UV shirt/pants rects) were actually found — by
// looking at the real atlas, not guessing — same method the original eye/lip
// UV rects used. Re-run this (with different body/output paths below) any
// time a new paintable region needs finding on this or another body.
//
//   node extract-texture.mjs
//
// Requires a running dev server (npm run dev) since it reads the GLB served
// from it, and reads the GLB's own JSON chunk directly (no three.js/DOM
// needed) to avoid GLTFLoader's browser-only image decoding.
import { writeFile } from "node:fs/promises";

const BODY_URL = "http://localhost:5183/models/rpm/Masculine.glb";
const OUT_PATH = "/tmp/masculine-diffuse.png";

const res = await fetch(BODY_URL);
const buf = Buffer.from(await res.arrayBuffer());

// GLB layout: 12-byte header, then chunks of [u32 length][u32 type][data].
let offset = 12;
let jsonChunk = null;
let binChunk = null;
while (offset < buf.length) {
  const chunkLength = buf.readUInt32LE(offset);
  const chunkType = buf.readUInt32LE(offset + 4);
  const chunkData = buf.subarray(offset + 8, offset + 8 + chunkLength);
  if (chunkType === 0x4e4f534a) jsonChunk = JSON.parse(chunkData.toString("utf8")); // 'JSON'
  if (chunkType === 0x004e4942) binChunk = chunkData; // 'BIN\0'
  offset += 8 + chunkLength;
}
if (!jsonChunk || !binChunk) throw new Error("not a valid GLB (missing JSON/BIN chunk)");

// Don't assume images[0] is the diffuse map — this body also has a Normal
// Texture as a separate image (confirmed: images[0] was the normal map,
// images[1] the actual diffuse, the two were NOT in the order a guess would
// assume). Follow the material's own baseColorTexture reference instead.
const material = jsonChunk.materials[0];
const baseColorTexIndex = material.pbrMetallicRoughness.baseColorTexture.index;
const imageIndex = jsonChunk.textures[baseColorTexIndex].source;
const img = jsonChunk.images[imageIndex];
const bv = jsonChunk.bufferViews[img.bufferView];
const imgData = binChunk.subarray(bv.byteOffset ?? 0, (bv.byteOffset ?? 0) + bv.byteLength);

await writeFile(OUT_PATH, imgData);
console.log(`saved ${OUT_PATH} (${imgData.length} bytes) from material "${material.name}"`);
