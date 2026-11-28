import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";

const css = await readFile(new URL("../src/app/globals.css", import.meta.url), "utf8");
const required = [
  ["button controls", /button/],
  ["links", /\ba\b/],
  ["custom button roles", /\[role=\\?"button\\?"\]/],
  ["tabs", /\[role=\\?"tab\\?"\]/],
  ["onclick fallback", /\[onclick\]/],
  ["tap feedback animation", /@keyframes\s+heartStudioTap/],
  ["custom React click targets", /\*\\:active\s*\{\s*animation:\s*heartStudioTap/],
  ["selection feedback animation", /@keyframes\s+heartStudioChoice/],
  ["journey reveal animation", /@keyframes\s+heartStudioReveal/],
  ["reduced-motion support", /prefers-reduced-motion\s*:\s*reduce/],
];
for (const [label, pattern] of required) {
  assert.match(css, pattern, `Missing interaction motion requirement: ${label}`);
}
assert.match(css, /\*\\:active\s*\{\s*animation:\s*heartStudioTap/, "Custom React click targets must receive tap feedback");
assert.match(css, /\.journeyCard\.activeJourney/, "Selected journey cards need a distinct animated state");
console.log(`Interaction motion audit passed (${required.length + 2} checks).`);
