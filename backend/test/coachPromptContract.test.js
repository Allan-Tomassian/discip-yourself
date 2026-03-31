import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const OPENAI_RUNNER_PATH = path.resolve(process.cwd(), "src/services/coach/openaiRunner.js");
const RULES_PATH = path.resolve(process.cwd(), "src/services/fallback/rules.js");

test("coach prompts keep the global coach guidance concrete and explanatory", () => {
  const source = fs.readFileSync(OPENAI_RUNNER_PATH, "utf8");

  assert.match(source, /You are the conversational Coach for Discip-Yourself\./);
  assert.match(source, /The user is talking freely and may not want to create anything yet\./);
  assert.match(source, /You may suggest activating plan mode only when the user is clearly trying to structure something in the app\./);
  assert.match(source, /You are the local analysis layer for Discip-Yourself on/);
  assert.match(source, /This layer is secondary to the Coach and must stay local, concise, and non-conversational\./);
  assert.match(source, /Do not behave like the Coach and do not start a workflow on behalf of the user\./);
});

test("chat fallback keeps a concrete planning fallback", () => {
  const source = fs.readFileSync(RULES_PATH, "utf8");

  assert.match(source, /pose une seule action de 10 min, claire et tenable aujourd'hui/);
});
