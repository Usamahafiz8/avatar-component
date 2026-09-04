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

### Appearance tab

- Body type (male/female — swaps the whole GLB + its own texture atlas)
- Skin tone (5 presets, material tint)
- Hair style (cap geometry: buzz/crop/swept — baked-in hair can't be
  recoloured or hidden by painting, its UV footprint scatters across nearly
  the whole atlas) + hair colour (6 presets)
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
