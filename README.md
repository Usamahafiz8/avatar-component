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
