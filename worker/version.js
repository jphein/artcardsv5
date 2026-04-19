import { json } from "./cors.js";
import { HASH, BRANCH, DIRTY, BUILT } from "./version-info.js";

const ADJECTIVES = [
  "Arcane", "Blessed", "Charmed", "Destined", "Enchanted",
  "Fateful", "Guiding", "Hidden", "Illumined", "Judging",
  "Karmic", "Liminal", "Moonlit", "Numbered", "Ordained",
  "Portentous", "Querent", "Reversed", "Starlit", "Turning",
];

const NOUNS = [
  "Amulet", "Blade", "Chalice", "Diviner", "Emperor",
  "Fool", "Guardian", "Hermit", "Initiate", "Justice",
  "Knight", "Lovers", "Magician", "Nomad", "Ouroboros",
  "Pentacle", "Querent", "Rosette", "Scepter", "Tower",
];

function generateName(hash) {
  const seed = parseInt(hash, 16) || 0;
  const adj = ADJECTIVES[seed % ADJECTIVES.length];
  const noun = NOUNS[(seed >> 8) % NOUNS.length];
  return `${adj} ${noun} · ${hash}`;
}

// Workers clamp Date.now() to 0 at module load (side-channel mitigation),
// so capture `started` lazily on the first real request instead of at import time.
let started = null;
let startTime = 0;

export async function handleVersion(request, env, origin) {
  if (started === null) {
    started = new Date().toISOString();
    startTime = Date.now();
  }

  // Workers CI injects WORKERS_CI_COMMIT_SHA; fall back to the hash baked in at build time.
  const ciHash = (env.WORKERS_CI_COMMIT_SHA || env.CF_PAGES_COMMIT_SHA || "").slice(0, 7);
  const hash = ciHash || HASH;
  const branch = env.WORKERS_CI_BRANCH || env.CF_PAGES_BRANCH || BRANCH;

  return json(
    {
      name: "artcardsv5",
      description: "Imaginal art card creator",
      version: generateName(hash),
      hash,
      branch,
      dirty: DIRTY,
      built: BUILT,
      started,
      uptime: Math.floor((Date.now() - startTime) / 1000),
      realm: "tarot",
      runtime: "cloudflare-workers",
      repo: "https://github.com/jphein/artcardsv5",
      commit_url: hash && hash !== "dev" ? `https://github.com/jphein/artcardsv5/commit/${hash}` : "",
    },
    200,
    origin,
  );
}
