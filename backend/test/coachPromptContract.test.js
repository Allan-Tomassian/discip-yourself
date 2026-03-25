import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const OPENAI_RUNNER_PATH = path.resolve(process.cwd(), "src/services/coach/openaiRunner.js");
const RULES_PATH = path.resolve(process.cwd(), "src/services/fallback/rules.js");

test("coach prompts keep the global coach guidance concrete and explanatory", () => {
  const source = fs.readFileSync(OPENAI_RUNNER_PATH, "utf8");

  assert.match(source, /The coach is opened manually by the user from anywhere in the app\./);
  assert.match(source, /You may answer with a concise explanation when the user asks why a recommendation exists or how the app should be used/);
  assert.match(source, /If missing information blocks a credible recommendation, you may ask one short clarification question/);
});

test("chat fallback keeps a concrete planning fallback", () => {
  const source = fs.readFileSync(RULES_PATH, "utf8");

  assert.match(source, /pose une seule action de 10 min, claire et tenable aujourd'hui/);
});
