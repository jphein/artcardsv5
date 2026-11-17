// node --test scripts/version.test.mjs — the realm-sigil /version.json the Pages build publishes (2026-11-17).
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

test("version.js writes public/version.json in the realm-sigil contract", () => {
  execFileSync("node", [path.join(root, "scripts", "version.js")], { cwd: root });
  const v = JSON.parse(readFileSync(path.join(root, "public", "version.json"), "utf-8"));
  const hash = execFileSync("git", ["rev-parse", "--short", "HEAD"], { cwd: root, encoding: "utf-8" }).trim();
  assert.equal(v.hash, hash);
  assert.match(v.version, /^.+ · [0-9a-f]{7,40}$/);
  assert.ok(v.version.endsWith(`· ${hash}`));
  assert.equal(v.repo, "https://github.com/jphein/artcardsv5");
  assert.equal(typeof v.dirty, "boolean");
  assert.match(v.built, /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/);
});
