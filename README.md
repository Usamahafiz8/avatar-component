# avatar-component

Standalone sandbox for the avatar/character component, built separately from
`blackjack-pwa` and meant to be merged into it once finished.

**Why a separate project:** builds the piece in isolation without touching
the live PWA, while using the *same tooling* as `blackjack-pwa` (Vite,
TypeScript in strict mode, Vitest) so the eventual port into
`blackjack-pwa/ui/` is close to a direct copy instead of a rewrite.

**Relationship to `avatar-anim-v2`:** that folder is the earlier
plain-HTML/Three.js spike (character rig, expression/dance galleries, brief
flow). This project is where the finished, typed component gets built for
integration — logic proven in the spike was ported here as TS, then extended
well past what the spike had (full dance library, shirt/pants colour, a
chain accessory — see below).

## Current page: character sandbox

`index.html` is a seat badge + turn ring (hardcoded HUD, matching the SBJ
reference render's style) with the real rigged, fully customizable character
standing in front of it. The deck/LAST CARD/END TURN/hand-of-cards pieces
from the original reference mockup were deliberately removed (2026-09) to
keep this focused on the character, not full table chrome — this isn't a
gameplay mockup any more, it's a character-and-animation testbed.

Run `node fetch-assets.mjs` (or `npm run assets`) once before `npm run dev` —
the GLB bodies/clips (and their WebP preview thumbnails) aren't committed
(RPM's animation-library licence forbids redistributing them). Fetches both
`Masculine.glb` and `Feminine.glb` (the Customize panel's body-type toggle
needs both), every clip in the library's `dance/` and `expression/` folders,
and a preview thumbnail per clip.

## Moves row

**48 clips total** — every reaction-shaped category in the RPM animation-
library, not a curated subset:

- **15 dances** (`Dance 1`-`15`) — the full `feminine/glb/dance/` folder.
- **33 reactions** (`Reaction 1`-`33`) — the full `feminine/glb/expression/`
  folder: 6 `F_Talking_Variations`, 17 `M_Standing_Expressions`, 10
  `M_Talking_Variations`. avatar-anim-v2 hand-picked just 2 clips from this
  exact category (Laugh, Lose) after finding most others read wrong for
  their label — e.g. an "Angry" clip that was actually a thumbs-up. Expect
  the same here: some of these 33 will look like nothing in particular.
  **The Reactions tab's ▶ Test button is exactly the tool for finding which
  ones are worth keeping** — go through them there, not in code.

All retarget onto either body from the one shared skeleton regardless of
their own F_/M_ prefix. Each plays its **full length** (dances run 4-6s;
reactions vary), then crossfades back to Idle — no artificial hold cap.
(Earlier versions of this project had a hand-authored "Point" clip and a
manual Idle button; both were removed at Osama's request. Idle still exists
as the automatic rest state every move returns to, it's just not a button.)

Which moves actually show up in the row is controlled by the Customize
panel's **Reactions tab** (see below) — this is a per-session UI selection,
not a code change.

## Customize panel

Tap "🎨 Customize" to open the full character customizer — a real tab bar
(Appearance / Reactions), shown **side by side** with the live character (a
CSS Grid, `.workspace`, two explicit columns — stays side by side reliably
rather than depending on flex-wrap's available width; collapses to one
column under 760px, or before you've even opened it) so every change is
visible in real time without covering the preview.

### Match My Character To Me (selfie upload)

At the top of the Appearance tab: **📷 Upload Selfie**. Picks a photo,
sends it to Gemini's vision API via a dev-only `/api/analyze-face` endpoint
(see `vite.config.ts`'s middleware + `analyze-face-core.mjs`, copied
verbatim from `avatar-anim-v2` — same prompt/schema, proven there already),
and applies whatever it returns (skin tone, eye colour, hair style+colour,
beard style+colour, lip colour, glasses, jaw width, face length, body type)
straight onto the character. A field it doesn't return, or returns an
unrecognised value for, is left exactly as it was — never reset.

**Needs a `GEMINI_API_KEY`** (copy `.env.example` to `.env.local`, fill it
in, restart `npm run dev`) — none is configured in this environment, so
right now uploading shows a clean "AI detection isn't configured" message
rather than either crashing or silently doing nothing. The key is read only
inside `vite.config.ts`'s own Node process; it never reaches the browser
bundle.

**Deliberately lighter than the original**: `avatar-anim-v2`'s version also
runs a local MediaPipe face-landmark pass first — quality gates (no face /
multiple faces / too dark / turned too far) and a free fallback when Gemini
isn't configured. This is the direct Gemini-only path. A bad or non-face
photo won't be caught before the request goes out; it'll come back as
Gemini's best guess, or a clean error if the request itself fails. Worth
porting the local quality-gate pass back in if bad uploads become a real
problem — see `src/selfie.ts`'s doc comment.

**Accuracy pass (2026-09, Osama reported colours/style/jaw all reading
wrong):** tested against a real (synthetic, privacy-safe) face photo with
known ground truth rather than guessing at a fix — the baseline result was
actually reasonably close (correct body type, hair style, hair colour, no
false glasses), so the pipeline wasn't fundamentally broken, but three real
issues were found and fixed:
- **Image sent to Gemini was downscaled to only 640px / 85% JPEG quality**
  (`src/selfie.ts`) — too lossy for subtle reads like jaw width, face
  length, and exact tone. Raised to 1280px / 92% quality.
- **`temperature: 0.2`** (`analyze-face-core.mjs`) added sampling variance
  to what's a structured classification task, not a creative one — every
  field is "pick the one enum that matches" or "read this hex off the
  image," where the most likely answer IS the right answer. Lowered to `0`.
- **jawWidth/faceLength had no calibration anchor** — nothing told the
  model most faces are "average," so it had no reason to prefer that over
  "narrow"/"wide" or "short"/"long" for a subtle, ambiguous case. Prompt now
  says explicitly: only pick the extreme categories for a CLEAR, noticeable
  difference.

Re-verified end-to-end after all three changes (real photo, actual browser
upload) — still working, no regressions.

**This exact feature has real history worth knowing:** a fuller version
(with its own dedicated upload screen, quality gates, a colour editor, a
premade-avatar picker) was built once in `avatar-anim-v2`, shown on a real
phone, and rejected on sight ("delete this all stuff right now") — not a
tech failure, a UI one. This version deliberately lives inside the existing
Customize panel instead of a new dedicated screen, to avoid repeating that.

### Appearance tab

- Body type (male/female — swaps the whole GLB + its own texture atlas)
- Skin tone (5 presets, material tint)
- **Hair style — 11 options** (2026-09, grew from 3): buzz, crop, fade,
  swept back, quiff, curly, afro, mohawk, ponytail, bun, long — cap geometry
  (baked-in hair can't be recoloured or hidden by painting, its UV footprint
  scatters across nearly the whole atlas). Most are the same sphere-slice
  dome at different radius/coverage (buzz/crop/fade/swept/quiff/curly/afro
  really are all "how much rounded volume, how far down the scalp"), but
  mohawk/ponytail/bun/long need a second attached shape a dome alone can't
  fake. **Real constraint found and fixed while building these**: this
  app's camera is fixed front-on with no rotation control, so a piece
  placed directly behind the head (where a real ponytail/bun naturally
  sits) is completely invisible — confirmed by screenshot, not assumed.
  Fixed by moving each to somewhere the front camera can actually see it: a
  high/side ponytail draping over one shoulder, a top bun sitting above the
  crown, a mohawk ridge tall enough to clear the head outline (tuned back
  once, after an first pass clipped past the top of the camera frame). Out
  of scope for this technique entirely: braids/cornrows, real curl texture
  — those need actual strand geometry or a normal map, not a solid-colour
  primitive. + hair colour (6 presets)
- Eye colour (6) / lip colour (5) — painted directly onto the shared texture
  at empirically-found UV rects, per body (male/female atlases differ)
- Beard (5 styles + 6 colours, primitive geometry on the Head bone,
  male body only — hidden automatically on female)
- Glasses on/off (primitive geometry, no mesh to toggle)
- **Shirt colour (6) / Pants colour (5)** — NEW (2026-09): painted directly
  onto the shirt/pants regions of the shared texture, found by actually
  extracting and inspecting the atlas (`extract-texture.mjs`), not guessed.
  Closes the long-standing "outfit isn't controllable" gap — the default
  look is now the actual black tracksuit from the reference render. One
  real limitation worth knowing: a `color`-blend paint (hue+saturation from
  the target, keeps the backdrop's own luminance) can't reach achromatic
  targets like white/black on a dark fabric — confirmed by screenshot,
  painting "white" onto the navy shirt did *nothing* visible with that
  blend alone. Fixed with a 3-pass paint (hue, saturation, then a full
  luminosity pass) over a plain filled rect rather than the eye/lip
  technique's inscribed ellipse (a wide two-view garment region left most
  of the actual fabric outside an ellipse, diluting the result to a muddy
  grey — confirmed by screenshot before switching to a rect fill).
- **Chain on/off + colour (gold/silver/black)** — NEW (2026-09): a
  drooping-curve tube + pendant, primitive geometry parented to the Neck
  bone. Directly answers a named, repeated ask ("gold chain") the outfit
  ceiling couldn't reach any other way. Debugged the same way the project
  already debugs invisible accessories (see project memory): swapped to an
  unlit, depth-test-disabled magenta material first to confirm shape/
  position were already right, which showed the real bug was Z-depth — the
  chain sat right at the shirt's own surface and was fully occluded under
  normal depth testing. Fixed by pushing it forward, verified visible on
  both body types.
- Jaw width / face length sliders — direct vertex-position edits on the head
  mesh, skin weights untouched so it still animates correctly

**Still not available**, honestly, not silently: nose/eyebrow/true eye-lip
*shape* (needs a different avatar source entirely — no morph target data on
this body), a genuinely different garment (only its *colour* is paintable,
not its cut), and a vendor-modelled hairstyle (the hair cap is a real
geometry swap, not baked-hair recolouring).

### Reactions tab

One row per available move, in two lines:
- **Top:** a real animated preview thumbnail, its label, and an **On/Off**
  toggle controlling whether it's in the moves row below.
- **Bottom:** a **sound picker** and a **▶ Test** button that plays the
  move's animation and its assigned sound together on the character (Test
  doesn't touch the On/Off selection — preview something before deciding).

The On/Off half mirrors a founder ask from the original brief chat directly:
*"Can I have the selection to pick from like some I would not keep."*

**Reaction audio** (2026-09, Osama's ask): 15 real sound effects — laughs,
applause/cheers, party horns, whooshes — sourced from
[Mixkit's Sound Effects library](https://mixkit.co/free-sound-effects/)
(free for personal *and* commercial use, no attribution required — unlike
the RPM clips, Mixkit's licence permits redistribution, so these ARE
committed under `public/audio/`, not fetched at setup time) and listed in
`src/sounds.ts`. Picking a sound in the dropdown auditions it immediately;
Test plays the animation and the assigned sound together.

**Default assignment is content-based, not a blind cycle** — a first pass
round-robinned sounds by category and Osama caught it immediately ("clip is
not matching with the sound"). Root cause, found by extracting and actually
looking at 6 evenly-spaced frames from all 48 preview WebPs (a real motion
read, not a static thumbnail): the 15 dances are uniformly big/energetic, so
a party/whoosh cycle across them holds up — but the 33 "reactions" are NOT
uniformly big gestures. 16 of them (every `Talking_Variations` clip, both
prefixes) are subtle standing/talking loops with barely any visible motion;
most `Standing_Expressions` are similarly subtle. A loud laugh/cheer on
those was an obvious mismatch. Fixed by only assigning a sound to the 5
reactions confirmed (by that frame extraction) to show an actual big
gesture — everything else defaults to **no sound**, which is correct there,
not a gap. One specific catch: `M_Standing_Expressions_007` (Reaction 12) is
a head-down, dejected pose — documented elsewhere in this project's history
as the "Lose" reaction — and had wrongly gotten a cheer sound from the
round-robin; it's silent now (no somber option exists in this 15-sound
library yet). See `buildDefaultMoveSounds` in `src/sounds.ts` for the exact
mapping. To add more sound options, add entries to `SOUND_LIBRARY` and drop
the file in `public/audio/`.

**Why a thumbnail instead of a real name** (2026-09, Osama asked for names —
this is what that turned into after actually checking): none of these 48
clips carry a descriptive name anywhere. Checked both places a name could
live — the GLB's own `clip.name` (just the filename baked in, confirmed by
inspecting several) and the animation-library's own docs (its readme
repeats the filename as the caption too, not a real label). What the
library DOES publish is a genuine rendered preview per clip — an animated
WebP loop (~70+ frames) at a matching path for every file — which browsers
autoplay natively in a plain `<img>`, lazy-loaded so 48 clips at
~100-450KB each don't all fetch on opening the tab. A real preview of the
actual motion is more reliable than a name anyway — avatar-anim-v2's own
history includes an "Angry" clip that was actually a thumbs-up.

## Dev utilities (not part of the shipped build)

- `node verify-visual.mjs` — Playwright screenshot + console-error check
  against a running dev server. Rewritten repeatedly through this project's
  history to check whatever was just built; treat its current contents as
  "the last thing verified," not a permanent regression suite.
- `node extract-texture.mjs` — pulls a body's actual baked diffuse texture
  out of its GLB (following the material's own `baseColorTexture` reference,
  not assuming image order) and saves it as a PNG. This is how the shirt/
  pants paintable regions were found — by looking at the real atlas, not
  guessing. Re-run it (editing the body/output path at the top) whenever a
  new paintable region needs finding.

## Scripts

- `npm run dev` — Vite dev server
- `npm run build` — typecheck + production build
- `npm run assets` — fetch the RPM body/clip GLBs (run once first)
- `npm test` — Vitest

## Integration plan

1. Build and verify the component here.
2. Once stable, copy `src/` into `blackjack-pwa/ui/` (or wherever it's
   consumed) and add `three` as a dependency there.
3. Wire it into the actual game screen/flow in `blackjack-pwa`.

## `@readyplayerme/visage` proof-of-concept (2026-09-05)

Researched RPM's open-source SDK repos as a possible fit for this project.
Their embed/creator SDK (`@readyplayerme/react-avatar-creator`) is a dead end
regardless of code quality — it iframes `<subdomain>.readyplayer.me`, and
that domain has been DNS-dead from this network since at least 2026-08-31.
`@readyplayerme/visage` (three.js/r3f display components) is separately
loadable via npm, so a proof-of-concept was built to check whether it's
worth adopting for display: `visage-poc.html` / `src/visage-poc.tsx`, a
standalone page (its own Vite build entry — see `vite.config.ts`'s
`rollupOptions.input`) completely isolated from the real character sandbox
— different React root, different HTML file, deletable with zero impact on
`index.html`/`main.ts`/`character.ts`'s own behavior (both were re-verified
by screenshot after every change below to confirm that held).

**What it took to get working, three real blockers, none of them in our own
code:**
1. Peer deps pin `three` to an exact `0.166.1` (we were on `^0.160.1`) plus
   exact versions of `react`, `react-dom`, `@react-three/fiber`,
   `@react-three/drei`, `@react-three/postprocessing`, `three-stdlib`,
   `postprocessing`, `suspend-react`, `@amplitude/analytics-browser`. The
   three.js bump was verified safe first — `npm run typecheck` and a real
   screenshot of the existing character sandbox both clean before touching
   the PoC.
2. Visage pulls in `qs` → `object-inspect`, which does
   `require('util').inspect` at module scope. Vite externalizes Node's
   `util` core module for the browser by default, so that call is
   `undefined` and crashes immediately on `.custom` before anything renders
   — not a bug in this project, a Node/browser bundling mismatch in one of
   visage's own transitive deps. Fixed with `vite-plugin-node-polyfills`,
   scoped to just `util` (see `vite.config.ts`).
3. **Every one of visage's built-in `environment` presets — including the
   `'soft'` default — resolves to a `files.readyplayer.me` HDR URL.** That's
   a third RPM subdomain, confirmed dead the same way as the other two
   (`ERR_NAME_NOT_RESOLVED`), and it crashes the whole `<Canvas>` uncaught.
   `environment` also accepts a plain path though, so the PoC points it at a
   local HDR (`public/environments/quarry_01_1k.hdr`, pulled from three.js's
   own MIT-licensed examples — a placeholder, swap for a properly sourced
   asset before this goes near a real build) instead of a preset name.

**Working after those three fixes** — verified by screenshot, not just "no
console errors": the stock `Masculine.glb` renders through visage's
`<Avatar>` with the local dance clip actually playing (pose visibly changes
between two screenshots a beat apart).

### The GLTFExporter round-trip: real customization through visage (2026-09-05, part 2)

Extended the PoC to actually drive live customization, not just show the
stock body. `visage-poc.html` now renders two avatars side by side — stock,
and a "Customized" one driven by the **same Customize panel component**
(`customize.ts`) as `index.html`'s real sandbox, sharing its CSS (pulled out
into `src/customize-panel.css` so both pages use one copy instead of
duplicating ~180 lines) and its `CharacterHandle` contract. visage-poc.tsx
is the adapter: `customize.ts` calls `handle.rebuild(state)` exactly like it
always has, and this adapter's implementation of that method is what's new
— build the character via `character.ts`'s (newly extracted)
`buildCustomizedCharacter()`, re-export the result to a binary GLB blob
(`src/export-glb.ts`, via three's `GLTFExporter`), and feed that blob to
visage's `<Avatar modelSrc>`. `play(label)`/`playIdle()` are simplified
versus `mountCharacter`'s real version — just swap visage's
`animationSrc` and let it loop, no hold-then-crossfade-home timing — good
enough to preview a move via the Reactions tab's ▶ Test button, not a
faithful port of the in-game beat.

**Two real bugs found and fixed in the export path, both verified with
actual pixel/byte inspection, not assumption:**

1. **`GLTFExporter.js` never references `alphaMap` anywhere in its source**
   (checked directly) — it only ever reads `.transparent`/`.alphaTest` as
   flags, no texture slot, because core glTF has no equivalent to three's
   alphaMap extension. `character.ts`'s hair and beard accessories are
   built entirely from a flat-tinted material *plus* an alphaMap that
   carves a small feathered dome/patch out of a much larger flat sphere —
   without that map, the exported material comes back opaque across the
   **whole** underlying sphere. First symptom: picking any hair style with
   a wide `theta` (Curly, Afro) rendered as a giant solid ball engulfing the
   head — confirmed NOT a preset/geometry bug by rendering the identical
   state through the live vanilla sandbox, where it looks correct.
   **Fix** (`export-glb.ts`'s `bakeAlphaMapsIntoColor`): before export, bake
   the alphaMap into the **alpha channel of a real RGBA colour texture**
   and assign that as `.map` instead — alpha from a colour texture's own
   alpha channel is standard glTF (`baseColorTexture` + `alphaMode: BLEND`)
   and does round-trip.
2. **That bake came out vertically inverted on the first attempt** — found
   by exporting, then actually extracting the baked PNG's raw bytes out of
   the GLB's binary buffer view and reading real per-pixel alpha values
   (not eyeballing a screenshot): the opaque band landed at the *bottom* of
   the texture instead of the top. `GLTFExporter` re-encodes canvas-sourced
   images to glTF's own row order regardless of the source texture's own
   `.flipY` — not documented anywhere read, found by inspecting the actual
   exported bytes. Fixed by flipping the row order (`h - 1 - y`) when
   copying the alpha channel across.

**After both fixes, decisively verified three ways, not just "looks
right":** (1) extracted the exported PNG's raw pixel data and confirmed the
alpha channel is a clean 255→46 top-to-bottom gradient with constant RGB;
(2) confirmed the body mesh's native scale (~1.84 units, unscaled) already
matches visage's own default camera framing — ruled out scale as a factor
by measurement, not assumption; (3) **loaded the exact same exported GLB
through plain three.js, bypassing visage entirely, and it renders
correctly** — properly shaped, feathered hair, not a sphere.

**That third test is the important one: it proves the export is now fully
correct, and pins the remaining bug on visage's own rendering pipeline, not
this project's code.** Skin tone, eye/lip colour, and shirt/pants colour —
all plain texture-paint, no alphaMap involved — round-trip and render
**correctly through visage right now**, live, driven by the real Customize
panel (verified by screenshot). Hair/beard accessories still render as an
oversized solid shape **specifically inside visage**, not in plain
three.js. The likely cause, from reading visage's own `Models.service.tsx`
earlier in this file's research: `normaliseMaterialsConfig` unconditionally
sets `mat.depthWrite = true` for *any* material with a `.map` — which the
alpha-bake fix above newly gives hair/beard materials (they previously had
none, only a flat `.color` + `.alphaMap`). Not patched further — reaching
into visage's own internal material pass after it loads a model is outside
this project's code, and diminishing-returns territory for a PoC.

**Where this actually leaves the "should we adopt visage" question**: the
core mechanism works — this project's real customization pipeline, through
the real Customize UI, genuinely renders live inside visage's `<Avatar>` for
every texture-painted trait. Bone-parented alpha-shaped accessories (hair,
beard) are the one category that doesn't currently work *through visage
specifically*, for a reason outside this project's own code. None of this
touches the actual open question from the original `avatar-spike` runtime
research (draw-call cost), and the React/r3f/visage stack is a real
dependency-tree addition for what — even working — doesn't yet exceed what
`character.ts` already does directly. Worth an actual decision before going
further, not an assumed "yes, keep building on this."
