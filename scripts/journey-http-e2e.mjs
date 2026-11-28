import assert from "node:assert/strict";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";

const baseUrl = process.env.HEART_BASE_URL ?? "http://127.0.0.1:3000";
const slug = "journey-http-ci-" + randomBytes(6).toString("hex");
const creatorId = randomUUID();
const experienceId = randomUUID();
const firstId = randomUUID();
const secondId = randomUUID();
const buyerTokens = [];

function psql(statement) {
  execFileSync("docker", ["compose", "exec", "-T", "db", "psql", "-U", "heart", "-d", "heart_studio", "-v", "ON_ERROR_STOP=1", "-c", statement], { stdio: "inherit" });
}
function cookieFrom(response) {
  const value = response.headers.get("set-cookie");
  assert.ok(value?.startsWith("heart_buyer="), "buyer session cookie missing");
  assert.match(value, /httponly/i, "buyer cookie must be HttpOnly");
  const token = value.split(";")[0].slice("heart_buyer=".length);
  buyerTokens.push(token);
  return value.split(";")[0];
}
async function call(path, cookie, options = {}) {
  const headers = new Headers(options.headers ?? {});
  if (cookie) headers.set("cookie", cookie);
  return fetch(new URL(path, baseUrl), { ...options, headers, redirect: "manual" });
}

try {
  psql(`
    INSERT INTO users (id, display_name, role) VALUES ('${creatorId}', 'Journey HTTP CI', 'creator');
    INSERT INTO experiences (id, creator_id, slug, title, status) VALUES ('${experienceId}', '${creatorId}', '${slug}', 'Journey HTTP CI', 'published');
    INSERT INTO experience_levels (id, experience_id, position, title, teaser, price_minor, private_content) VALUES
      ('${firstId}', '${experienceId}', 1, '第一关', '先完成这一关', 100, '第一关专属惊喜'),
      ('${secondId}', '${experienceId}', 2, '第二关', '完成第一关后出现', 200, '第二关专属惊喜');
  `);

  const session1 = await call("/api/buyer/session", null, { method: "POST", headers: { "sec-fetch-site": "same-origin" } });
  assert.equal(session1.status, 200);
  const cookie1 = cookieFrom(session1);

  const listing = await call("/api/experiences/" + slug, cookie1);
  assert.equal(listing.status, 200);
  const listingJson = await listing.json();
  assert.equal(listingJson.experience.levels.length, 2);
  assert.equal(listingJson.experience.levels[0].completed, false);

  const lockedGet = await call("/api/experiences/" + slug + "/levels/" + secondId, cookie1);
  assert.equal(lockedGet.status, 409, "direct URL must not bypass sequential lock");
  assert.equal((await lockedGet.json()).error, "LEVEL_LOCKED");

  const firstGet = await call("/api/experiences/" + slug + "/levels/" + firstId, cookie1);
  assert.equal(firstGet.status, 200);
  assert.equal((await firstGet.json()).content, "第一关专属惊喜");

  const lockedPost = await call("/api/experiences/" + slug + "/responses", cookie1, {
    method: "POST", headers: { "sec-fetch-site": "same-origin", "content-type": "application/json" },
    body: JSON.stringify({ levelId: secondId, reaction: "heart", message: "skip" })
  });
  assert.equal(lockedPost.status, 409, "locked level response must be rejected");

  const submitted = await call("/api/experiences/" + slug + "/responses", cookie1, {
    method: "POST", headers: { "sec-fetch-site": "same-origin", "content-type": "application/json" },
    body: JSON.stringify({ levelId: firstId, reaction: "heart", message: "这一关我完成啦" })
  });
  assert.equal(submitted.status, 200);
  assert.equal((await submitted.json()).ok, true);

  const secondGet = await call("/api/experiences/" + slug + "/levels/" + secondId, cookie1);
  assert.equal(secondGet.status, 200, "level two should unlock after response");
  assert.equal((await secondGet.json()).content, "第二关专属惊喜");

  const refreshed = await call("/api/experiences/" + slug, cookie1);
  assert.equal((await refreshed.json()).experience.levels[0].completed, true);

  const session2 = await call("/api/buyer/session", null, { method: "POST", headers: { "sec-fetch-site": "same-origin" } });
  assert.equal(session2.status, 200);
  const cookie2 = cookieFrom(session2);
  const otherListing = await call("/api/experiences/" + slug, cookie2);
  assert.equal((await otherListing.json()).experience.levels[0].completed, false, "progress must be visitor-scoped");
  const otherSecond = await call("/api/experiences/" + slug + "/levels/" + secondId, cookie2);
  assert.equal(otherSecond.status, 409, "another visitor must not inherit unlocked levels");

  console.log("PASS: session, direct-link lock, interaction, sequential unlock, progress read, visitor isolation.");
} finally {
  const tokenHashes = buyerTokens.map(token => createHash("sha256").update(token).digest("hex"));
  const deleteSessions = tokenHashes.length
    ? "DELETE FROM buyer_sessions WHERE token_hash IN (" + tokenHashes.map(hash => "'" + hash + "'").join(",") + ");"
    : "";
  psql(`DELETE FROM experiences WHERE id = '${experienceId}'; DELETE FROM users WHERE id = '${creatorId}'; ${deleteSessions}`);
}
