// Ported from avatar-anim-v2/demo.html's "Customize Character" popup —
// simplified to a single bottom sheet (no split-view/canvas-reparenting;
// see avatar-anim-v2 if that's ever needed) but the same real, working
// options: skin tone, hair style/colour, eye/lip colour, beard + colour,
// glasses, body type, jaw width / face length. All presets/ranges are
// copied verbatim from the source — calibration data, not re-derived.
import type { BeardStyleKey, BodyType, CharacterHandle, CharacterState, HairStyleKey } from "./character";
import { applyFaceAnalysis, nearestPresetHex, previewUrlFor } from "./character";
import { playSoundId, SOUND_LIBRARY } from "./sounds";
import { analyzeSelfie, SelfieAnalysisError } from "./selfie";

export interface ReactionsOptions {
  /** Every available move's label (e.g. from character.ts's CLIP_LABELS). */
  moveLabels: readonly string[];
  /** The currently-enabled subset — mutated in place, same pattern as `state`. */
  selectedMoves: Set<string>;
  /** Called with a fresh copy of the selection whenever a toggle changes, so
   * whatever renders the moves row (e.g. main.ts) can stay in sync. */
  onChange: (selected: Set<string>) => void;
  /** label -> sound id (see sounds.ts), mutated in place — same pattern as
   * `selectedMoves`. Comes in pre-filled with a category-level round-robin
   * default (see sounds.ts's buildDefaultMoveSounds) — not a hand-matched
   * per-clip pairing, just so nothing starts at "No sound." Swap any of
   * these here once you've actually watched/heard the combo. */
  moveSounds: Map<string, string>;
}

interface ColorPreset {
  hex: number;
  label: string;
}
interface KeyPreset<T> {
  key: T;
  label: string;
}

const SKIN_PRESETS: ColorPreset[] = [
  { hex: 0xf0d0b0, label: "Light" },
  { hex: 0xe0b48a, label: "Fair" },
  { hex: 0xc68a5c, label: "Medium" },
  { hex: 0x8a5a3c, label: "Tan" },
  { hex: 0x5c4030, label: "Deep" },
];
const EYE_PRESETS: ColorPreset[] = [
  { hex: 0x4a3222, label: "Brown" },
  { hex: 0x2e6fb0, label: "Blue" },
  { hex: 0x3d7a4a, label: "Green" },
  { hex: 0x6b5030, label: "Hazel" },
  { hex: 0x7a9ab0, label: "Grey" },
  { hex: 0x1a1a1a, label: "Black" },
];
const LIP_PRESETS: ColorPreset[] = [
  { hex: 0xa8654a, label: "Natural" },
  { hex: 0xb03050, label: "Rose" },
  { hex: 0x9c1f2e, label: "Red" },
  { hex: 0x6b2540, label: "Berry" },
  { hex: 0xc98a72, label: "Nude" },
];
const HAIR_COLOR_PRESETS: ColorPreset[] = [
  { hex: 0x1a1410, label: "Black" },
  { hex: 0x3b2a1a, label: "Brown" },
  { hex: 0x7a5a35, label: "Chestnut" },
  { hex: 0xc9a15a, label: "Blonde" },
  { hex: 0x8a3a2a, label: "Auburn" },
  { hex: 0x8a8a8a, label: "Grey" },
];
const BEARD_PRESETS: KeyPreset<BeardStyleKey>[] = [
  { key: "none", label: "None" },
  { key: "thin", label: "Thin" },
  { key: "stubble", label: "Stubble" },
  { key: "goatee", label: "Goatee" },
  { key: "medium", label: "Medium" },
  { key: "full", label: "Full" },
];
const GLASSES_PRESETS: KeyPreset<boolean>[] = [
  { key: false, label: "None" },
  { key: true, label: "On" },
];
// Painted onto the shared texture's shirt/pants regions (2026-09) — see
// character.ts's paintAppearance for how these were found (extracted +
// visually inspected the atlas, not guessed). Includes the specifically
// requested black tracksuit look, plus enough spread to be genuinely useful.
const SHIRT_COLOR_PRESETS: ColorPreset[] = [
  { hex: 0x1a1a1a, label: "Black" },
  { hex: 0xf2f2f2, label: "White" },
  { hex: 0x1c3f66, label: "Navy" },
  { hex: 0x8a1620, label: "Red" },
  { hex: 0x3a3f36, label: "Olive" },
  { hex: 0x6b6b6b, label: "Grey" },
];
const PANTS_COLOR_PRESETS: ColorPreset[] = [
  { hex: 0x1a1a1a, label: "Black" },
  { hex: 0x2b2b2b, label: "Charcoal" },
  { hex: 0x1c3f66, label: "Navy" },
  { hex: 0x5c4a36, label: "Khaki" },
  { hex: 0xf2f2f2, label: "White" },
];
const HAIR_STYLE_PRESETS: KeyPreset<HairStyleKey>[] = [
  { key: "default", label: "Default" },
  { key: "buzz", label: "Buzz" },
  { key: "crop", label: "Crop" },
  { key: "fade", label: "Fade" },
  { key: "swept", label: "Swept back" },
  { key: "quiff", label: "Quiff" },
  { key: "curly", label: "Curly" },
  { key: "afro", label: "Afro" },
  { key: "mohawk", label: "Mohawk" },
  { key: "ponytail", label: "Ponytail" },
  { key: "bun", label: "Bun" },
  { key: "long", label: "Long" },
];

function faceShapeLabel(v: number, lowWord: string, highWord: string): string {
  if (Math.abs(v - 1) < 0.01) return "Neutral";
  return `${v < 1 ? lowWord : highWord} (${v.toFixed(2)})`;
}

function hex6(n: number): string {
  return `#${n.toString(16).padStart(6, "0")}`;
}

export interface CustomizeSheet {
  open(): void;
  close(): void;
}

/**
 * Renders the customize sheet's markup into `mount`, wires every control to
 * mutate `state` and call `character.rebuild(state)`, and returns open/close
 * controls. `state` is mutated in place — read it back any time for the
 * character's current look.
 */
export function mountCustomizeUI(
  mount: HTMLElement,
  character: CharacterHandle,
  state: CharacterState,
  reactions: ReactionsOptions,
): CustomizeSheet {
  mount.innerHTML = `
    <div id="czPanel" class="cz-panel">
      <header class="cz-header">
        <div class="cz-title-wrap">
          <h3>Customize Character</h3>
          <p id="czStatus" class="cz-status"><span class="cz-spin"></span>Updating avatar&hellip;</p>
        </div>
        <button id="czClose" class="cz-close" aria-label="Done">Done</button>
      </header>
      <div class="cz-tabs" id="czTabs">
        <button data-tab="appearance" aria-pressed="true">Appearance</button>
        <button data-tab="reactions" aria-pressed="false">Reactions</button>
      </div>
      <div class="cz-body">
        <div id="czTabAppearance" class="cz-tab-panel">
        <section class="cz-section">
          <label>Match My Character To Me</label>
          <div class="cz-selfie-row">
            <label class="cz-selfie-upload" for="czSelfieInput">📷 Upload Selfie</label>
            <input type="file" id="czSelfieInput" accept="image/*" hidden />
            <p id="czSelfieStatus" class="cz-selfie-status"></p>
          </div>
        </section>
        <section class="cz-section">
          <label>Body</label>
          <div class="cz-seg" id="czBodySeg">
            <button data-b="male" aria-pressed="true">Male</button>
            <button data-b="female" aria-pressed="false">Female</button>
          </div>
        </section>
        <section class="cz-section">
          <label>Skin Tone</label>
          <div class="cz-swatch-row" id="czSkin"></div>
        </section>
        <section class="cz-section">
          <label>Hair Style</label>
          <div class="cz-swatch-row" id="czHairStyle"></div>
        </section>
        <section class="cz-section">
          <label>Hair Color</label>
          <div class="cz-swatch-row" id="czHairColor"></div>
        </section>
        <section class="cz-section">
          <label>Eye Color</label>
          <div class="cz-swatch-row" id="czEyes"></div>
        </section>
        <section class="cz-section">
          <label>Lip Color</label>
          <div class="cz-swatch-row" id="czLips"></div>
        </section>
        <section class="cz-section" id="czBeardSection">
          <label>Beard</label>
          <div class="cz-swatch-row" id="czBeard"></div>
          <label>Beard Color</label>
          <div class="cz-swatch-row" id="czBeardColor"></div>
        </section>
        <section class="cz-section">
          <label>Glasses</label>
          <div class="cz-swatch-row" id="czGlasses"></div>
        </section>
        <section class="cz-section">
          <label>Shirt Color</label>
          <div class="cz-swatch-row" id="czShirt"></div>
        </section>
        <section class="cz-section">
          <label>Pants Color</label>
          <div class="cz-swatch-row" id="czPants"></div>
        </section>
        <section class="cz-section">
          <label>Face Shape</label>
          <div class="cz-slider-row">
            <div class="cz-slider-head"><span>Jaw Width</span><span class="cz-val" id="czJawVal">Neutral</span></div>
            <input type="range" id="czJawSlider" min="0.8" max="1.25" step="0.01" value="1" />
          </div>
          <div class="cz-slider-row">
            <div class="cz-slider-head"><span>Face Length</span><span class="cz-val" id="czFaceLenVal">Neutral</span></div>
            <input type="range" id="czFaceLenSlider" min="0.85" max="1.2" step="0.01" value="1" />
          </div>
        </section>
        <section class="cz-section cz-note">
          <label>Not available yet</label>
          <p>Nose, eyebrow, and true eye/lip SHAPE still need a different
            avatar source than what's free right now — this body has zero
            data to select between for those. Shirt/pants COLOR is real
            (painted onto the baked-in garment), but it's still the same
            garment — no different cut/style, and skin tint no longer bleeds
            into it now that it's painted separately. Hair style is a shaped
            cap covering the original hair, not a vendor-modelled hairstyle.</p>
        </section>
        </div>
        <div id="czTabReactions" class="cz-tab-panel" hidden>
        <section class="cz-section">
          <label>Reactions</label>
          <div class="cz-move-list" id="czMoves"></div>
        </section>
        <section class="cz-section cz-note">
          <label>How this works</label>
          <p>Pick which moves stay in the game's reaction pool — deselecting
            one here removes it from the table, it doesn't delete the clip.
            Same idea as the founder's own ask: a curated set per player, not
            every vendor clip by default.</p>
        </section>
        </div>
      </div>
    </div>
  `;

  const $ = <T extends HTMLElement>(id: string): T => {
    const el = mount.querySelector<T>(`#${id}`);
    if (!el) throw new Error(`customize UI: #${id} not found`);
    return el;
  };

  let rebuildToken = 0;
  async function rebuildCharacter(): Promise<void> {
    const myToken = ++rebuildToken;
    $("czStatus").classList.add("show");
    try {
      await character.rebuild(state);
    } finally {
      if (myToken === rebuildToken) $("czStatus").classList.remove("show");
    }
  }

  function renderSwatchRow<T>(
    containerId: string,
    items: (ColorPreset | KeyPreset<T>)[],
    isActive: (item: ColorPreset | KeyPreset<T>) => boolean,
    onPick: (item: ColorPreset | KeyPreset<T>) => void,
    shape: "color" | "shape" = "color",
  ): void {
    const wrap = $(containerId);
    wrap.innerHTML = "";
    for (const item of items) {
      const b = document.createElement("button");
      b.className = "cz-swatch" + (shape === "shape" ? " cz-swatch-shape" : "");
      b.setAttribute("aria-pressed", String(isActive(item)));
      if (shape === "shape") {
        b.textContent = item.label;
      } else {
        b.style.background = hex6((item as ColorPreset).hex);
      }
      b.title = item.label;
      b.onclick = () => {
        onPick(item);
        syncUI();
        void rebuildCharacter();
      };
      wrap.appendChild(b);
    }
  }

  function mark<T>(containerId: string, items: (ColorPreset | KeyPreset<T>)[], current: T | undefined, nearest = false): void {
    const wrap = mount.querySelector(`#${containerId}`);
    if (!wrap) return;
    const nearestHex =
      nearest && typeof current === "number" ? nearestPresetHex(current, items as ColorPreset[]) : null;
    [...wrap.children].forEach((el, idx) => {
      const item = items[idx];
      if (!item) return;
      const active = nearest ? (item as ColorPreset).hex === nearestHex : "hex" in item ? item.hex === current : item.key === current;
      el.setAttribute("aria-pressed", String(active));
    });
  }

  function buildRows(): void {
    renderSwatchRow<number>("czSkin", SKIN_PRESETS, (i) => (i as ColorPreset).hex === state.tint, (i) => {
      state.tint = (i as ColorPreset).hex;
    });
    renderSwatchRow<HairStyleKey>(
      "czHairStyle",
      HAIR_STYLE_PRESETS,
      (i) => (i as KeyPreset<HairStyleKey>).key === state.hairStyle,
      (i) => {
        state.hairStyle = (i as KeyPreset<HairStyleKey>).key;
      },
      "shape",
    );
    renderSwatchRow<number>("czHairColor", HAIR_COLOR_PRESETS, (i) => (i as ColorPreset).hex === state.hairColor, (i) => {
      state.hairColor = (i as ColorPreset).hex;
    });
    renderSwatchRow<number>("czEyes", EYE_PRESETS, (i) => (i as ColorPreset).hex === state.eyeColor, (i) => {
      state.eyeColor = (i as ColorPreset).hex;
    });
    renderSwatchRow<number>("czLips", LIP_PRESETS, (i) => (i as ColorPreset).hex === state.lipColor, (i) => {
      state.lipColor = (i as ColorPreset).hex;
    });
    renderSwatchRow<BeardStyleKey>(
      "czBeard",
      BEARD_PRESETS,
      (i) => (i as KeyPreset<BeardStyleKey>).key === state.beardStyle,
      (i) => {
        state.beardStyle = (i as KeyPreset<BeardStyleKey>).key;
      },
      "shape",
    );
    renderSwatchRow<number>("czBeardColor", HAIR_COLOR_PRESETS, (i) => (i as ColorPreset).hex === state.beardColor, (i) => {
      state.beardColor = (i as ColorPreset).hex;
    });
    renderSwatchRow<boolean>(
      "czGlasses",
      GLASSES_PRESETS,
      (i) => (i as KeyPreset<boolean>).key === state.hasGlasses,
      (i) => {
        state.hasGlasses = (i as KeyPreset<boolean>).key;
      },
      "shape",
    );
    renderSwatchRow<number>("czShirt", SHIRT_COLOR_PRESETS, (i) => (i as ColorPreset).hex === state.shirtColor, (i) => {
      state.shirtColor = (i as ColorPreset).hex;
    });
    renderSwatchRow<number>("czPants", PANTS_COLOR_PRESETS, (i) => (i as ColorPreset).hex === state.pantsColor, (i) => {
      state.pantsColor = (i as ColorPreset).hex;
    });

    const jawSlider = $<HTMLInputElement>("czJawSlider");
    const faceLenSlider = $<HTMLInputElement>("czFaceLenSlider");
    jawSlider.oninput = () => {
      $("czJawVal").textContent = faceShapeLabel(Number(jawSlider.value), "Narrower", "Wider");
    };
    jawSlider.onchange = () => {
      state.jawWidth = Number(jawSlider.value);
      void rebuildCharacter();
    };
    faceLenSlider.oninput = () => {
      $("czFaceLenVal").textContent = faceShapeLabel(Number(faceLenSlider.value), "Shorter", "Longer");
    };
    faceLenSlider.onchange = () => {
      state.faceLength = Number(faceLenSlider.value);
      void rebuildCharacter();
    };

    syncUI();
  }

  function syncUI(): void {
    for (const b of Array.from($("czBodySeg").children)) {
      b.setAttribute("aria-pressed", String((b as HTMLElement).dataset.b === state.bodyType));
    }
    $("czBeardSection").hidden = state.bodyType !== "male";
    mark<number>("czSkin", SKIN_PRESETS, state.tint, true);
    mark<number>("czEyes", EYE_PRESETS, state.eyeColor, true);
    mark<number>("czLips", LIP_PRESETS, state.lipColor, true);
    mark<BeardStyleKey>("czBeard", BEARD_PRESETS, state.beardStyle);
    mark<number>("czBeardColor", HAIR_COLOR_PRESETS, state.beardColor);
    mark<boolean>("czGlasses", GLASSES_PRESETS, state.hasGlasses);
    mark<HairStyleKey>("czHairStyle", HAIR_STYLE_PRESETS, state.hairStyle);
    mark<number>("czHairColor", HAIR_COLOR_PRESETS, state.hairColor);
    mark<number>("czShirt", SHIRT_COLOR_PRESETS, state.shirtColor);
    mark<number>("czPants", PANTS_COLOR_PRESETS, state.pantsColor);
    const jawSlider = mount.querySelector<HTMLInputElement>("#czJawSlider");
    const faceLenSlider = mount.querySelector<HTMLInputElement>("#czFaceLenSlider");
    if (jawSlider) {
      jawSlider.value = String(state.jawWidth);
      $("czJawVal").textContent = faceShapeLabel(state.jawWidth, "Narrower", "Wider");
    }
    if (faceLenSlider) {
      faceLenSlider.value = String(state.faceLength);
      $("czFaceLenVal").textContent = faceShapeLabel(state.faceLength, "Shorter", "Longer");
    }
  }

  $("czBodySeg").addEventListener("click", (e) => {
    const btn = (e.target as HTMLElement).closest("button[data-b]") as HTMLButtonElement | null;
    if (!btn) return;
    const next = btn.dataset.b as BodyType;
    state.bodyType = next;
    if (next !== "male") {
      state.beardStyle = "none";
      state.beardColor = undefined;
    }
    syncUI();
    void rebuildCharacter();
  });

  // ---- Upload Selfie -> AI customization (2026-09) -----------------------
  // See src/selfie.ts's doc comment for what's deliberately simpler here
  // than avatar-anim-v2's original (no local MediaPipe quality-gate pass —
  // a bad/non-face photo just comes back as Gemini's best guess, or a clean
  // error if the request itself fails, rather than being caught up front).
  const selfieInput = $<HTMLInputElement>("czSelfieInput");
  const selfieStatus = $("czSelfieStatus");
  selfieInput.addEventListener("change", () => {
    const file = selfieInput.files?.[0];
    if (!file) return;
    selfieStatus.textContent = "Analyzing…";
    selfieStatus.classList.remove("is-error");
    analyzeSelfie(file)
      .then((traits) => {
        Object.assign(state, applyFaceAnalysis(state, traits));
        syncUI();
        return rebuildCharacter();
      })
      .then(() => {
        selfieStatus.textContent = "Done — matched from your photo.";
      })
      .catch((err: unknown) => {
        selfieStatus.classList.add("is-error");
        selfieStatus.textContent =
          err instanceof SelfieAnalysisError ? err.message : "Couldn't analyze that photo — try a different one.";
      })
      .finally(() => {
        selfieInput.value = "";
      });
  });

  // ---- Reactions tab: which moves are in the pool, not what they look ----
  // like — a toggle set, not a rebuildCharacter() trigger (nothing about the
  // 3D model changes). Mirrors Zack's own ask in the brief: "can I have the
  // selection to pick from, like some I would not keep."
  // Each row: the move's name, a ▶ Test button that just plays it (doesn't
  // touch selection — you should be able to preview a move you're about to
  // turn off, or one that's already off, before deciding), and an On/Off
  // toggle that does touch selection.
  function renderMoveToggles(): void {
    const wrap = $("czMoves");
    wrap.innerHTML = "";
    for (const label of reactions.moveLabels) {
      const row = document.createElement("div");
      row.className = "cz-move-row";

      const top = document.createElement("div");
      top.className = "cz-move-row-top";

      // Real preview beats a guessed name: none of these clips carry a
      // descriptive name anywhere (checked the GLB and the library's own
      // docs — both just repeat the filename), but RPM's repo does publish
      // a genuine rendered preview per clip, an animated WebP loop, which
      // browsers autoplay natively in a plain <img>. lazy-loaded since 48
      // of these at ~100-450KB each would otherwise all fetch at once.
      const previewUrl = previewUrlFor(label);
      if (previewUrl) {
        const thumb = document.createElement("img");
        thumb.className = "cz-move-thumb";
        thumb.src = previewUrl;
        thumb.loading = "lazy";
        thumb.alt = `${label} preview`;
        top.appendChild(thumb);
      }

      const name = document.createElement("span");
      name.className = "cz-move-label";
      name.textContent = label;

      const toggle = document.createElement("button");
      toggle.type = "button";
      toggle.className = "cz-swatch cz-swatch-shape cz-move-toggle";
      const syncToggle = (): void => {
        const on = reactions.selectedMoves.has(label);
        toggle.setAttribute("aria-pressed", String(on));
        toggle.textContent = on ? "On" : "Off";
      };
      syncToggle();
      toggle.onclick = () => {
        if (reactions.selectedMoves.has(label)) reactions.selectedMoves.delete(label);
        else reactions.selectedMoves.add(label);
        syncToggle();
        reactions.onChange(new Set(reactions.selectedMoves));
      };

      top.append(name, toggle);

      const bottom = document.createElement("div");
      bottom.className = "cz-move-row-bottom";

      // Sound picker: no default pairing (see ReactionsOptions doc) — pick
      // this by actually watching the thumbnail/testing the move and
      // listening, not by guessing from either one's name. Changing the
      // selection auditions the sound immediately so comparing options
      // doesn't require re-triggering the 3D animation each time.
      const soundSelect = document.createElement("select");
      soundSelect.className = "cz-move-sound";
      const noneOpt = document.createElement("option");
      noneOpt.value = "";
      noneOpt.textContent = "No sound";
      soundSelect.appendChild(noneOpt);
      for (const s of SOUND_LIBRARY) {
        const opt = document.createElement("option");
        opt.value = s.id;
        opt.textContent = s.label;
        soundSelect.appendChild(opt);
      }
      soundSelect.value = reactions.moveSounds.get(label) ?? "";
      soundSelect.onchange = () => {
        const id = soundSelect.value;
        if (id) reactions.moveSounds.set(label, id);
        else reactions.moveSounds.delete(label);
        playSoundId(id || undefined);
      };

      const test = document.createElement("button");
      test.type = "button";
      test.className = "cz-move-test";
      test.textContent = "▶ Test";
      test.setAttribute("aria-label", `Test ${label}`);
      test.onclick = () => {
        character.play(label);
        playSoundId(reactions.moveSounds.get(label));
      };

      bottom.append(soundSelect, test);
      row.append(top, bottom);
      wrap.appendChild(row);
    }
  }
  renderMoveToggles();

  // ---- tab switching ------------------------------------------------------
  const tabPanels: Record<string, HTMLElement> = {
    appearance: $("czTabAppearance"),
    reactions: $("czTabReactions"),
  };
  $("czTabs").addEventListener("click", (e) => {
    const btn = (e.target as HTMLElement).closest("button[data-tab]") as HTMLButtonElement | null;
    if (!btn) return;
    const tab = btn.dataset.tab ?? "appearance";
    for (const b of Array.from($("czTabs").children)) {
      b.setAttribute("aria-pressed", String((b as HTMLElement).dataset.tab === tab));
    }
    for (const [key, panel] of Object.entries(tabPanels)) {
      panel.hidden = key !== tab;
    }
  });

  buildRows();

  function open(): void {
    mount.hidden = false;
  }
  function close(): void {
    mount.hidden = true;
  }
  $("czClose").onclick = close;

  return { open, close };
}
