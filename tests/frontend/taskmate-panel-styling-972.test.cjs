const assert = require("node:assert/strict");
const { test } = require("node:test");

const { loadCard } = require("./harness.cjs");

const { get } = loadCard("taskmate-panel.js");
const TaskMatePanel = get("taskmate-panel");

// Admin panel fixes from #972.

function panel() {
  const p = Object.create(TaskMatePanel.prototype);
  p._t = (key) => key;
  return p;
}

test("badge criteria are plain text, so the table's escape shows >= once", () => {
  const p = panel();
  const label = p._criteriaLabel([{ metric: "first_chore", operator: ">=", value: 1 }]);
  assert.equal(label, "badge.criteria_first_chore >= 1");
  assert.equal(p._esc(label), "badge.criteria_first_chore &gt;= 1");
});

test("an icon picked for an avatar row lands in that row", () => {
  const p = panel();
  p._dialog = { kind: "avatar-catalog", data: { catalog: [{ icon: "mdi:cat" }, { icon: "mdi:dog" }] } };
  p._onValueChanged({ target: { dataset: { field: "catalog[1].icon" } }, detail: { value: "mdi:rocket" } });
  assert.deepEqual(p._dialog.data.catalog.map(a => a.icon), ["mdi:cat", "mdi:rocket"]);
  assert.equal(p._dialog.data["catalog[1].icon"], undefined);
});

test("plain dialog fields still write directly", () => {
  const p = panel();
  p._dialog = { kind: "chore", data: {} };
  p._onValueChanged({ target: { dataset: { field: "icon" } }, detail: { value: "mdi:broom" } });
  assert.equal(p._dialog.data.icon, "mdi:broom");
});

test("the avatar catalogue offers the icon picker, not a text box", () => {
  const p = panel();
  p._dialog = { kind: "avatar-catalog", data: { catalog: [{ label: "Cat", icon: "mdi:cat", unlock_type: "free" }] } };
  const html = p._renderAvatarCatalogDialog();
  assert.match(html, /<ha-icon-picker class="tm-avatar-picker" data-field="catalog\[0\]\.icon" data-current="mdi:cat">/);
  assert.doesNotMatch(html, /<input[^>]*data-field="catalog\[0\]\.icon"/);
  assert.match(html, /class="tm-dialog tm-dialog-wide"/, "four fields plus the picker need the wide dialog");
});
