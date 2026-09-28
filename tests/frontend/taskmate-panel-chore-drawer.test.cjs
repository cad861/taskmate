const assert = require("node:assert/strict");
const { test } = require("node:test");

const { loadCard } = require("./harness.cjs");

const { get } = loadCard("taskmate-panel.js");
const TaskMatePanel = get("taskmate-panel");

// The chore editor opens as a side panel with its fields under headings (#968).

function editor(mode, data = {}) {
  const p = Object.create(TaskMatePanel.prototype);
  p._t = (key) => key;
  p._hass = null;
  p._state = {
    children: [{ id: "kid1", name: "Malia" }],
    chores: [{ id: "c1", name: "Make bed" }, { id: "c2", name: "Dishes" }],
    task_groups: [],
    settings: {},
  };
  p._dialog = {
    kind: "chore",
    mode,
    data: { id: mode === "edit" ? "c1" : undefined, name: "Make bed", assignment_mode: "everyone", schedule_mode: "specific_days",
      assigned_to: [], due_days: [], points: 5, daily_limit: 1, ...data },
    _openAdvanced: new Set(),
  };
  return p._renderChoreDialog();
}

test("the chore editor opens as a side panel", () => {
  const html = editor("edit");
  assert.match(html, /class="tm-scrim tm-scrim-drawer"/);
  assert.match(html, /class="tm-dialog tm-drawer"/);
});

test("its fields sit under the five headings, in order", () => {
  const html = editor("edit");
  const heads = [...html.matchAll(/panel\.chore_sec_([a-z]+)/g)].map(m => m[1]);
  assert.deepEqual(heads, ["basics", "who", "when", "checking", "more"]);
});

test("each field lands in its section", () => {
  const html = editor("edit");
  const at = key => html.indexOf(`panel.chore_sec_${key}`);
  const field = name => html.indexOf(`data-field="${name}"`);
  assert.ok(field("name") > at("basics") && field("name") < at("who"));
  assert.ok(field("assignment_mode") > at("who") && field("assignment_mode") < at("when"));
  assert.ok(field("time_category") > at("when") && field("time_category") < at("checking"));
  assert.ok(html.indexOf('data-act="toggle-depends"') > at("when") && html.indexOf('data-act="toggle-depends"') < at("checking"));
  assert.ok(field("requires_approval") > at("checking") && field("requires_approval") < at("more"));
  assert.ok(html.indexOf('data-section="weather"') > at("more"));
});

test("editing offers Delete; adding does not", () => {
  assert.match(editor("edit"), /data-act="delete-chore" data-id="c1"/);
  assert.doesNotMatch(editor("add"), /data-act="delete-chore"/);
});

test("other editors stay centred dialogs", () => {
  const p = Object.create(TaskMatePanel.prototype);
  p._t = (key) => key;
  const html = p._dialogShell("Reward", "<p></p>", "");
  assert.doesNotMatch(html, /tm-drawer/);
});
