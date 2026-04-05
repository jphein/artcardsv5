// Realm-sigil word lists (tarot realm)
const adjectives = [
  "Arcane", "Blessed", "Charmed", "Destined", "Enchanted",
  "Fateful", "Guiding", "Hidden", "Illumined", "Judging",
  "Karmic", "Liminal", "Moonlit", "Numbered", "Ordained",
  "Portentous", "Querent", "Reversed", "Starlit", "Turning"
];
const nouns = [
  "Amulet", "Blade", "Chalice", "Diviner", "Emperor",
  "Fool", "Guardian", "Hermit", "Initiate", "Justice",
  "Knight", "Lovers", "Magician", "Nomad", "Ouroboros",
  "Pentacle", "Querent", "Rosette", "Scepter", "Tower"
];

function generateName(hash) {
  const seed = parseInt(hash, 16) || 0;
  const adj = adjectives[seed % adjectives.length];
  const noun = nouns[(seed >> 8) % nouns.length];
  return `${adj} ${noun} · ${hash}`;
}

const { execFileSync } = require('child_process');
const os = require('os');

const startTime = Date.now();
const startISO = new Date().toISOString();

function gitInfo() {
  const info = { hash: 'dev', branch: 'unknown', dirty: false };
  try {
    info.hash = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { encoding: 'utf8' }).trim() || 'dev';
    info.branch = execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { encoding: 'utf8' }).trim() || 'unknown';
    try { execFileSync('git', ['diff', '--quiet']); } catch (e) { info.dirty = true; }
  } catch (e) {}
  return info;
}

module.exports = (req, res) => {
  const git = gitInfo();
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.status(200).json({
    name: 'artcardsv5',
    description: 'Imaginal art card creator',
    version: generateName(git.hash),
    hash: git.hash,
    branch: git.branch,
    dirty: git.dirty,
    built: startISO,
    started: startISO,
    uptime: Math.floor((Date.now() - startTime) / 1000),
    realm: 'tarot',
    runtime: `node${process.version}`,
    os: `${process.platform}/${process.arch}`,
    host: os.hostname(),
    pid: process.pid,
    repo: 'https://github.com/jphein/artcardsv5',
    commit_url: git.hash !== 'dev' ? `https://github.com/jphein/artcardsv5/commit/${git.hash}` : '',
  });
};
