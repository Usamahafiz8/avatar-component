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
integration — logic proven in the spike should get ported here as TS, not
redone from scratch.

## Scripts

- `npm run dev` — Vite dev server
- `npm run build` — typecheck + production build
- `npm test` — Vitest

## Integration plan

1. Build and verify the component here.
2. Once stable, copy `src/` into `blackjack-pwa/ui/` (or wherever it's
   consumed) and add `three` as a dependency there.
3. Wire it into the actual game screen/flow in `blackjack-pwa`.
