// Table-mockup entry point — the badge/turn-ring seat HUD with the real
// rigged character standing in front of it, plus a full Customize sheet
// ported from avatar-anim-v2/demo.html (skin/hair/eye/lip colour, beard,
// glasses, body type, jaw width/face length, and a Reactions tab to pick
// which moves stay in the pool). The deck/LAST CARD/END TURN/hand HUD
// pieces from the original reference mockup were removed (2026-09, Osama's
// request) to keep this focused on the character, not full table chrome.
import { CLIP_LABELS, DEFAULT_CHARACTER_STATE, mountCharacter, type CharacterState } from "./character";
import { mountCustomizeUI } from "./customize";
import { buildDefaultMoveSounds, playSoundId } from "./sounds";

const canvas = document.getElementById("gl");
if (!(canvas instanceof HTMLCanvasElement)) {
  throw new Error("#gl canvas not found");
}
const customizeMount = document.getElementById("customizeMount");
if (!customizeMount) {
  throw new Error("#customizeMount not found");
}
const movesRowEl = document.getElementById("movesRow");
if (!movesRowEl) {
  throw new Error("#movesRow not found");
}
// Re-bound to a non-nullable local: TS doesn't carry the guard's narrowing
// into functions declared later that close over the outer variable.
const movesRow: HTMLElement = movesRowEl;

// Starting look — now that shirt/pants colour are real controls (2026-09),
// this matches the black tracksuit from Zack's reference render. Everything
// is still adjustable live via the Customize sheet.
const initialState: CharacterState = {
  ...DEFAULT_CHARACTER_STATE,
  tint: 0x6b4a34,
  hasGlasses: true,
  shirtColor: 0x1a1a1a,
  pantsColor: 0x1a1a1a,
};

// Which moves are in the active pool — starts as everything, narrowed via
// the Customize sheet's Reactions tab. Idle/Point were removed outright
// (2026-09); this is a lighter-weight per-player curation on top of that,
// not a delete — deselecting a move here never touches character.ts.
const selectedMoves = new Set<string>(CLIP_LABELS);

// label -> sound id (see sounds.ts). Starts pre-filled with a round-robin
// default per category (2026-09, Osama's request — every move gets a sound
// out of the box, not "No sound") so it's never empty; see
// buildDefaultMoveSounds' doc comment for why that's a category-level
// default rather than a hand-matched-per-clip claim. Swap any of these any
// time via the Reactions tab's picker.
const moveSounds = buildDefaultMoveSounds(CLIP_LABELS);

function renderMovesRow(selected: Set<string>, onPlay: (label: string) => void): void {
  movesRow.innerHTML = "";
  for (const label of CLIP_LABELS) {
    if (!selected.has(label)) continue;
    const btn = document.createElement("button");
    btn.textContent = `▶ ${label}`;
    btn.addEventListener("click", () => {
      onPlay(label);
      playSoundId(moveSounds.get(label));
    });
    movesRow.appendChild(btn);
  }
  if (movesRow.children.length === 0) {
    const note = document.createElement("p");
    note.className = "note";
    note.style.margin = "0";
    note.textContent = "No reactions selected — turn some back on in Customize → Reactions.";
    movesRow.appendChild(note);
  }
}

mountCharacter(canvas, initialState)
  .then((character) => {
    renderMovesRow(selectedMoves, (label) => character.play(label));

    const sheet = mountCustomizeUI(customizeMount, character, initialState, {
      moveLabels: CLIP_LABELS,
      selectedMoves,
      onChange: (selected) => renderMovesRow(selected, (label) => character.play(label)),
      moveSounds,
    });
    document.getElementById("btnCustomize")?.addEventListener("click", () => sheet.open());
  })
  .catch((err: unknown) => {
    console.error(err);
    const msg = err instanceof Error ? err.message : String(err);
    const stage = document.querySelector(".stage");
    if (stage) {
      const box = document.createElement("div");
      box.style.cssText = "color:#ff6b6b;font-size:11px;text-align:center;padding:8px;";
      box.textContent = /404|fetch/i.test(msg)
        ? `Missing 3D assets. Run: node fetch-assets.mjs\n${msg}`
        : msg;
      stage.appendChild(box);
    }
  });
