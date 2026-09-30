const assert = require("node:assert/strict");
const { test } = require("node:test");
const { readFileSync } = require("node:fs");
const path = require("node:path");

const { loadCard } = require("./harness.cjs");

const { get } = loadCard("taskmate-panel.js");
const TaskMatePanel = get("taskmate-panel");
const SRC = readFileSync(path.join(__dirname, "../../custom_components/taskmate/www/taskmate-panel.js"), "utf8");

// Editors animate in only when they first appear, not on every redraw (#974).

function zoneWithScrim() {
  const classes = new Set(["tm-scrim"]);
  const scrim = { classList: { add: c => classes.add(c), contains: c => classes.has(c) } };
  return { zone: { querySelector: sel => (sel === ".tm-scrim" ? scrim : null) }, classes };
}

test("a dialog that has just appeared is marked as entering", () => {
  const p = Object.create(TaskMatePanel.prototype);
  const { zone, classes } = zoneWithScrim();
  p._markDialogEntry(zone, false);
  assert.ok(classes.has("tm-enter"));
});

test("redrawing a dialog that was already open does not animate it again", () => {
  const p = Object.create(TaskMatePanel.prototype);
  const { zone, classes } = zoneWithScrim();
  p._markDialogEntry(zone, true);
  assert.ok(!classes.has("tm-enter"));
});

test("a zone without a dialog is left alone", () => {
  const p = Object.create(TaskMatePanel.prototype);
  assert.doesNotThrow(() => p._markDialogEntry({ querySelector: () => null }, false));
});

test("the opening animations only run under .tm-enter", () => {
  for (const name of ["tm-scrim-in", "tm-dialog-in", "tm-drawer-in"]) {
    const uses = [...SRC.matchAll(new RegExp(`([^{}]*)\\{[^{}]*animation:\\s*${name}\\b`, "g"))].map(m => m[1].trim());
    assert.ok(uses.length > 0, `${name} is used somewhere`);
    for (const selector of uses) assert.match(selector, /\.tm-enter/, `${name} runs outside .tm-enter: ${selector}`);
  }
});
