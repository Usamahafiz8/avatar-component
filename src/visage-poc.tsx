// Proof-of-concept mount for @readyplayerme/visage, kept fully isolated from
// the existing vanilla-three.js pipeline in character.ts/customize.ts/main.ts
// — its own page (visage-poc.html), its own React root, doesn't read or
// write index.html's own state. See README.md's "visage proof-of-concept"
// section for the full history (three RPM-domain/dep blockers routed around
// to get this far, plus the GLTFExporter round-trip needed for visage to
// show anything but the stock body).
//
// Two avatars, side by side:
// - STOCK: the raw Masculine.glb, untouched.
// - CUSTOMIZED: driven by the SAME Customize panel (customize.ts) as the
//   real character sandbox — every change rebuilds via character.ts's
//   buildCustomizedCharacter, re-exports to a GLB blob (export-glb.ts), and
//   feeds that to visage as `modelSrc`. customize.ts only knows about a
//   `CharacterHandle` interface (rebuild/play/playIdle/dispose); this file
//   is what adapts that interface onto visage instead of onto
//   mountCharacter's canvas renderer.
import "./customize-panel.css";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { Avatar } from "@readyplayerme/visage";
import {
  CLIP_LABELS,
  DEFAULT_CHARACTER_STATE,
  buildCustomizedCharacter,
  clipUrlFor,
  type CharacterHandle,
  type CharacterState,
} from "./character";
import { mountCustomizeUI } from "./customize";
import { buildDefaultMoveSounds } from "./sounds";
import { exportCharacterToGLB } from "./export-glb";

const IDLE_CLIP_SRC = clipUrlFor("Dance 1") ?? "/models/rpm/clips/M_Dances_001.glb";
// visage's default `environment` (and every named preset) resolves to a
// `files.readyplayer.me` HDR URL — a third RPM subdomain, confirmed dead
// from this network same as the other two. Routed around with a local HDR
// instead (three.js's own MIT-licensed examples — a placeholder, swap for a
// properly sourced asset before this goes near a real build).
const ENVIRONMENT_SRC = "/environments/quarry_01_1k.hdr";

// Starting look — same as main.ts's initialState, so this page's baseline
// matches the real sandbox rather than plain defaults.
const INITIAL_STATE: CharacterState = {
  ...DEFAULT_CHARACTER_STATE,
  tint: 0x6b4a34,
  hasGlasses: true,
  shirtColor: 0x1a1a1a,
  pantsColor: 0x1a1a1a,
};

type BuildState = { status: "loading" } | { status: "ready"; blob: Blob } | { status: "error"; message: string };

function AvatarStage({ modelSrc, animationSrc }: { modelSrc: string | Blob; animationSrc: string }) {
  return (
    <Avatar
      modelSrc={modelSrc}
      animationSrc={animationSrc}
      environment={ENVIRONMENT_SRC}
      scale={1}
      cameraTarget={1.65}
      cameraInitialDistance={0.4}
      style={{ width: "100%", height: "100%" }}
    />
  );
}

function VisagePoc() {
  // Mutated in place by customize.ts (same contract as main.ts's
  // initialState) — a ref, not React state, since customize.ts owns writes
  // to it directly (state.tint = ...) rather than going through a setter.
  const stateRef = useRef<CharacterState>({ ...INITIAL_STATE });
  const [build, setBuild] = useState<BuildState>({ status: "loading" });
  const [animationSrc, setAnimationSrc] = useState(IDLE_CLIP_SRC);
  const sheetRef = useRef<{ open(): void; close(): void } | null>(null);
  const rebuildTokenRef = useRef(0);

  async function rebuild(state: CharacterState): Promise<void> {
    const myToken = ++rebuildTokenRef.current;
    try {
      const { root } = await buildCustomizedCharacter(state);
      const blob = await exportCharacterToGLB(root);
      if (myToken !== rebuildTokenRef.current) return; // superseded
      setBuild({ status: "ready", blob });
    } catch (err) {
      if (myToken !== rebuildTokenRef.current) return;
      setBuild({ status: "error", message: err instanceof Error ? err.message : String(err) });
    }
  }

  // The CharacterHandle adapter customize.ts drives — see character.ts's
  // own CharacterHandle doc comment for the contract. `play`/`playIdle` are
  // simplified versus mountCharacter's real version: no automatic
  // hold-then-crossfade-back-to-idle timing, just switch visage's
  // `animationSrc` and let it loop — good enough to preview a move via the
  // Reactions tab's ▶ Test button, not a faithful port of the in-game timing.
  const handle: CharacterHandle = useMemo(
    () => ({
      rebuild,
      play(label: string) {
        setAnimationSrc(clipUrlFor(label) ?? IDLE_CLIP_SRC);
      },
      playIdle() {
        setAnimationSrc(IDLE_CLIP_SRC);
      },
      dispose() {
        // No render loop/renderer owned by this adapter (visage owns its
        // own Canvas) — nothing to tear down.
      },
    }),
    [],
  );

  useEffect(() => {
    const mount = document.getElementById("customizeMount");
    if (!mount) return;

    const selectedMoves = new Set<string>(CLIP_LABELS);
    const moveSounds = buildDefaultMoveSounds(CLIP_LABELS);
    const sheet = mountCustomizeUI(mount, handle, stateRef.current, {
      moveLabels: CLIP_LABELS,
      selectedMoves,
      onChange: () => {
        // No separate moves-row on this page (unlike main.ts) — selection
        // still works via the Reactions tab's own On/Off toggles and Test
        // button, there just isn't a second list mirroring it here.
      },
      moveSounds,
    });
    sheetRef.current = sheet;

    void rebuild(stateRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once; handle/stateRef are stable across the component's lifetime
  }, []);

  return (
    <div className="visage-poc-grid">
      <div className="visage-panel">
        <h2>Stock (Masculine.glb, untouched)</h2>
        <div className="visage-panel-stage">
          <AvatarStage modelSrc="/models/rpm/Masculine.glb" animationSrc={IDLE_CLIP_SRC} />
        </div>
      </div>
      <div className="visage-panel">
        <h2>Customized (live, via GLTFExporter round-trip)</h2>
        <div className="visage-panel-stage">
          <button type="button" id="btnCustomize" className="customize-btn" onClick={() => sheetRef.current?.open()}>
            🎨 Customize
          </button>
          {build.status === "loading" && <p className="visage-status">Building &amp; exporting…</p>}
          {build.status === "error" && <p className="visage-status visage-status-error">Failed: {build.message}</p>}
          {build.status === "ready" && (
            // visage's own format validator only accepts a Blob whose
            // `type` is exactly 'model/gltf-binary' — a blob: object-URL
            // STRING fails that check silently (console warning, nothing
            // rendered, no thrown error). Pass the Blob itself.
            <AvatarStage modelSrc={build.blob} animationSrc={animationSrc} />
          )}
        </div>
      </div>
    </div>
  );
}

const mount = document.getElementById("visagePocMount");
if (mount) {
  createRoot(mount).render(<VisagePoc />);
} else {
  console.warn("[visage-poc] #visagePocMount not found in the page — skipping mount.");
}
