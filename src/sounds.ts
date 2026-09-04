// A small library of real, clearly-licensed sound effects (Mixkit Sound
// Effects — free for personal AND commercial use, attribution appreciated
// but not required: https://mixkit.co/license/#sfxFree), for pairing with
// reactions/dances. Unlike the RPM animation clips, Mixkit's licence
// permits redistribution, so these ARE committed under public/audio/ rather
// than fetched at setup time.
export interface SoundOption {
  id: string;
  label: string;
  url: string;
}

export const SOUND_LIBRARY: SoundOption[] = [
  { id: "laugh-cartoon-voice", label: "Laugh — cartoon voice", url: "/audio/laugh-cartoon-voice.mp3" },
  { id: "laugh-crowd", label: "Laugh — crowd", url: "/audio/laugh-crowd.mp3" },
  { id: "laugh-woman-hilarious", label: "Laugh — hilarious", url: "/audio/laugh-woman-hilarious.mp3" },
  { id: "laugh-big-crowd", label: "Laugh — big crowd", url: "/audio/laugh-big-crowd.mp3" },
  { id: "applause-ending-show", label: "Applause — ending show", url: "/audio/applause-ending-show.mp3" },
  { id: "applause-medium-crowd", label: "Applause — medium crowd", url: "/audio/applause-medium-crowd.mp3" },
  { id: "cheer-happy-crowd", label: "Cheer — happy crowd", url: "/audio/cheer-happy-crowd.mp3" },
  { id: "cheer-happy-birthday-crowd", label: "Cheer — birthday crowd", url: "/audio/cheer-happy-birthday-crowd.mp3" },
  { id: "party-horn-happy", label: "Party horn — happy", url: "/audio/party-horn-happy.mp3" },
  { id: "party-trumpet-horn", label: "Party — trumpet horn", url: "/audio/party-trumpet-horn.mp3" },
  { id: "party-birthday-crowd-cheer", label: "Party — birthday cheer", url: "/audio/party-birthday-crowd-cheer.mp3" },
  { id: "party-fireworks-whoosh-bangs", label: "Party — fireworks", url: "/audio/party-fireworks-whoosh-bangs.mp3" },
  { id: "whoosh-air", label: "Whoosh — air", url: "/audio/whoosh-air.mp3" },
  { id: "whoosh-cinematic-fast", label: "Whoosh — cinematic fast", url: "/audio/whoosh-cinematic-fast.mp3" },
  { id: "whoosh-epic-trailer-impact", label: "Whoosh — epic impact", url: "/audio/whoosh-epic-trailer-impact.mp3" },
];

// Default sound per move (2026-09, Osama's request). First pass was a blind
// round-robin by category and it showed — Osama reported clips not matching
// their sound. Root cause, found by actually extracting and looking at 6
// evenly-spaced frames from every one of the 48 preview WebPs (a real
// motion read, not a single static thumbnail): the Dance clips are all
// genuinely big/energetic, so a party/whoosh cycle across them holds up.
// But the "Reaction" clips are NOT uniformly big gestures — every single
// F_Talking_Variations and M_Talking_Variations clip (16 of the 33) is a
// subtle standing/talking loop with barely any visible motion, and most
// M_Standing_Expressions are similarly subtle. A loud laugh/cheer on those
// read as an obvious, categorical mismatch, not just an imprecise one.
//
// Fixed by only assigning a reaction sound to the specific clips that
// actually show a big gesture in that frame extraction (arms raised, a
// fist pump, a star-jump pose) — everything else defaults to no sound
// rather than a wrong one. One specific correction: M_Standing_Expressions_
// 007 (Reaction 12) is a head-down, dejected pose — this is the exact clip
// documented elsewhere in this project's history as the "Lose" reaction —
// and had WRONGLY received a cheer sound from the round-robin. It gets no
// sound now; there's no somber/sad option in this 15-sound library yet.
const DANCE_SOUND_CYCLE = [
  "party-horn-happy",
  "party-trumpet-horn",
  "party-birthday-crowd-cheer",
  "party-fireworks-whoosh-bangs",
  "whoosh-air",
  "whoosh-cinematic-fast",
  "whoosh-epic-trailer-impact",
];

// label -> sound id, ONLY for reactions confirmed (by frame extraction) to
// show a real matching gesture. Everything not listed here stays silent by
// default rather than getting a guessed, likely-wrong sound.
const REACTION_SOUND_BY_LABEL: Record<string, string> = {
  "Reaction 11": "cheer-happy-crowd", // M_Standing_Expressions_006: arms raised wide
  "Reaction 15": "cheer-happy-birthday-crowd", // M_Standing_Expressions_010: fist pump raised
  "Reaction 18": "applause-medium-crowd", // M_Standing_Expressions_013: arm raise/punch
  "Reaction 20": "cheer-happy-crowd", // M_Standing_Expressions_015: star-jump, arms wide
  "Reaction 21": "applause-ending-show", // M_Standing_Expressions_016: arm raised
};

export function buildDefaultMoveSounds(labels: readonly string[]): Map<string, string> {
  const map = new Map<string, string>();
  let danceIdx = 0;
  for (const label of labels) {
    if (label.startsWith("Dance")) {
      map.set(label, DANCE_SOUND_CYCLE[danceIdx % DANCE_SOUND_CYCLE.length] as string);
      danceIdx++;
    } else if (label in REACTION_SOUND_BY_LABEL) {
      map.set(label, REACTION_SOUND_BY_LABEL[label] as string);
    }
    // Every other reaction (subtle talking loops, ambiguous gestures, the
    // dejected "Lose" pose) intentionally gets no entry — no sound plays,
    // which is correct here, not a gap.
  }
  return map;
}

const audioCache = new Map<string, HTMLAudioElement>();

export function playSoundId(id: string | undefined): void {
  if (!id) return;
  const sound = SOUND_LIBRARY.find((s) => s.id === id);
  if (!sound) return;
  // A fresh element per play (cloning the cached one) so rapid re-triggers
  // (clicking Test twice quickly) don't cut a still-playing instance off —
  // each play gets its own independent playback.
  let base = audioCache.get(id);
  if (!base) {
    base = new Audio(sound.url);
    audioCache.set(id, base);
  }
  const instance = base.cloneNode(true) as HTMLAudioElement;
  void instance.play().catch(() => {
    // Autoplay/user-gesture restrictions or a missing file — a silent no-op
    // is correct here, not a thrown error over a sound effect.
  });
}
