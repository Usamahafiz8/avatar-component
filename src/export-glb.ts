// GLTFExporter round-trip: @readyplayerme/visage's <Avatar modelSrc> takes a
// GLB URL/Blob, not a live three.js object graph, so showing the project's
// OWN customization (tint/paint/hair/beard/glasses/jaw-face deform — see
// character.ts's buildCustomizedCharacter) through visage means re-exporting
// the built THREE.Object3D back to a binary GLB blob first. See
// README.md's "visage proof-of-concept" section for what this does and
// doesn't prove.
import * as THREE from "three";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";

const exporter = new GLTFExporter();

/** three.js's `material.alphaMap` is a three-specific extension with no
 * core-glTF equivalent slot — GLTFExporter.js never even references
 * `alphaMap` (checked its source directly). It only reads `.transparent`
 * (-> alphaMode BLEND) and `.alphaTest` (-> alphaMode MASK), both flags, no
 * texture. character.ts's hair/beard accessories rely entirely on an
 * alphaMap to carve a small feathered dome/patch out of a much larger flat
 * sphere/plane — without it, the exported material comes back opaque
 * across the WHOLE underlying geometry (verified: this is exactly what
 * produced the giant solid sphere over the head on first export attempt,
 * not a hair-preset bug — the same "Curly" style renders correctly in the
 * live vanilla sandbox).
 *
 * Fix: bake the alphaMap into the ALPHA CHANNEL of a real RGBA colour
 * texture and assign that as `.map` instead — alpha coming from a colour
 * texture's own alpha channel is standard glTF (baseColorTexture + alphaMode
 * BLEND) and round-trips correctly. Mutates the given root's materials in
 * place — this function is meant to consume a root built solely for
 * export (see visage-poc.tsx), not one also being rendered live elsewhere. */
function bakeAlphaMapsIntoColor(root: THREE.Object3D): void {
  root.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    for (const mat of mats as THREE.MeshStandardMaterial[]) {
      const alphaMap = mat.alphaMap;
      if (!alphaMap) continue;
      const alphaImg = alphaMap.image as HTMLCanvasElement | HTMLImageElement | undefined;
      if (!alphaImg) continue;
      const w = alphaImg.width || 1;
      const h = alphaImg.height || 1;

      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) continue;
      // Base colour: the material's existing colour map if it has one
      // (none of this project's alphaMap-using materials do — hair/beard
      // are flat-tinted — but handle it in case that changes later),
      // otherwise a flat fill from `.color`.
      const baseMap = mat.map?.image as HTMLCanvasElement | HTMLImageElement | undefined;
      if (baseMap) {
        ctx.drawImage(baseMap, 0, 0, w, h);
      } else {
        ctx.fillStyle = `#${mat.color.getHexString()}`;
        ctx.fillRect(0, 0, w, h);
      }
      const colorData = ctx.getImageData(0, 0, w, h);

      const alphaCanvas = document.createElement("canvas");
      alphaCanvas.width = w;
      alphaCanvas.height = h;
      const actx = alphaCanvas.getContext("2d");
      if (!actx) continue;
      actx.drawImage(alphaImg, 0, 0, w, h);
      const alphaData = actx.getImageData(0, 0, w, h);
      // three.js's alphaMap reads the texture's GREEN channel as opacity
      // (see character.ts's featherAlphaMap/beardHairMap comments) — match
      // that convention when lifting it into the new texture's alpha.
      //
      // Row order is flipped here (h - 1 - y, not y) — verified empirically
      // by exporting, extracting the actual baked PNG bytes from the GLB,
      // and looking at it directly: without the flip the visible (opaque)
      // band lands at the BOTTOM of the texture instead of the top, and the
      // hair dome renders as a giant solid sphere instead of a feathered
      // cap. GLTFExporter re-encodes canvas-sourced images to match glTF's
      // own image-Y convention regardless of the source texture's own
      // `.flipY`, which inverts row order relative to how the ORIGINAL
      // (un-baked) alphaMap was sampled live — not documented anywhere
      // read, found by exporting and inspecting the actual bytes.
      for (let y = 0; y < h; y++) {
        const srcRow = (h - 1 - y) * w * 4;
        const dstRow = y * w * 4;
        for (let x = 0; x < w; x++) {
          colorData.data[dstRow + x * 4 + 3] = alphaData.data[srcRow + x * 4 + 1] ?? 255;
        }
      }
      ctx.putImageData(colorData, 0, 0);

      const baked = new THREE.CanvasTexture(canvas);
      baked.colorSpace = mat.map?.colorSpace ?? THREE.SRGBColorSpace;
      baked.flipY = alphaMap.flipY;
      mat.map = baked;
      mat.alphaMap = null;
      mat.transparent = true;
      mat.needsUpdate = true;
    }
  });
}

/** Exports a built character root (from buildCustomizedCharacter) to a
 * binary GLB Blob, suitable for visage's `modelSrc` prop. No animations are
 * embedded — the PoC drives animation via visage's separate `animationSrc`
 * prop, pointed at one of the project's already-local clip files, so this
 * only needs to carry the customized mesh/skeleton/materials. Mutates the
 * given root (see bakeAlphaMapsIntoColor) — pass a root built solely for
 * this export, not one also in live use elsewhere. */
export async function exportCharacterToGLB(root: THREE.Object3D): Promise<Blob> {
  bakeAlphaMapsIntoColor(root);
  const result = await exporter.parseAsync(root, { binary: true });
  if (!(result instanceof ArrayBuffer)) {
    // Only happens if `binary` is dropped/changed above — parseAsync returns
    // a plain JSON object instead of an ArrayBuffer without it.
    throw new Error("GLTFExporter did not return binary GLB (ArrayBuffer) — check export options.");
  }
  return new Blob([result], { type: "model/gltf-binary" });
}
