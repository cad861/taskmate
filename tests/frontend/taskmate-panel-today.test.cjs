const assert = require("node:assert/strict");
const { test } = require("node:test");

const { loadCard } = require("./harness.cjs");

const { get } = loadCard("taskmate-panel.js");
const TaskMatePanel = get("taskmate-panel");

// Admin panel Today page, child filter and command search (#966).

function panel(extra = {}) {
  const p = Object.create(TaskMatePanel.prototype);
  p._t = (key, params = {}) => (params.name ? `${key}:${params.name}` : key);
  p._timeAgo = () => "just now";
  p._activeTab = "today";
  p._state = {
    children: [
      { id: "kid1", name: "Malia", points: 142, current_streak: 9 },
      { id: "kid2", name: "Vaiha", points: 87, current_streak: 0 },
    ],
    chores: [
      { id: "bed", name: "Make bed", time_category: "morning", assigned_to: [] },
      { id: "dishes", name: "Dishes", time_category: "afternoon", assigned_to: ["kid1"] },
      { id: "cat", name: "Feed cat", time_category: "custom-gone", assigned_to: ["kid2"] },
    ],
    rewards: [
      { id: "tv", name: "TV time", assigned_to: [] },
      { id: "lego", name: "Lego", assigned_to: ["kid2"] },
    ],
    pending_completions: [
      { id: "p1", chore_id: "dishes", child_id: "kid1", completed_at: "2026-04-20T10:00:00Z" },
    ],
    pending_reward_claims: [],
    swap_requests: [],
    wishes: [
      { id: "w1", child_id: "kid2", name: "Kite", status: "pending", target: 50, created_at: "2026-04-20T09:00:00Z" },
    ],
    settings: { points_name: "Stars" },
    today: {
      board: {
        date: "2026-04-20",
        children: [
          { child_id: "kid1", due: 2, done: 1, chores: [
            { chore_id: "bed", status: "done", count: 1, limit: 1 },
            { chore_id: "dishes", status: "pending", count: 1, limit: 1 },
          ] },
          { child_id: "kid2", due: 2, done: 0, chores: [
            { chore_id: "bed", status: "missed", count: 0, limit: 1 },
            { chore_id: "cat", status: "todo", count: 0, limit: 1 },
          ] },
        ],
      },
      history: {
        kid1: [{ date: "2026-04-19" }, { date: "2026-04-20", due: 2, done: 1 }],
        kid2: [{ date: "2026-04-19", due: 3, done: 3 }, { date: "2026-04-20", due: 2, done: 0 }],
      },
    },
    ...extra,
  };
  return p;
}

test("Today is the first sidebar entry and every group has a heading but home", () => {
  const groups = panel()._sidebarGroups();
  assert.equal(groups[0].items[0].id, "today");
  assert.equal(groups[0].head, "");
  assert.ok(groups.slice(1).every(g => g.head && g.key));
});

test("the Today count covers approvals and new wishes", () => {
  const today = panel()._sidebarGroups()[0].items[0];
  assert.equal(today.count, 2);
});

test("the child cards show done/total from the board", () => {
  const html = panel()._renderTodayTab();
  assert.match(html, /<span>1\/2<\/span>/);
  assert.match(html, /<span>0\/2<\/span>/);
  assert.match(html, /panel\.today_streak/);
});

test("the board shows each chore's status and files unknown periods under any time", () => {
  const html = panel()._renderTodayBoard(panel()._state.children);
  assert.match(html, /tm-bchip-done" data-act="edit-chore" data-id="bed"/);
  assert.match(html, /tm-bchip-pending" data-act="edit-chore" data-id="dishes"/);
  assert.match(html, /tm-bchip-missed" data-act="edit-chore" data-id="bed"/);
  const anytime = html.indexOf("panel.time_anytime");
  assert.ok(anytime > 0 && html.indexOf('data-id="cat"') > anytime, "an unknown period falls back to any time");
});

test("the needs-you list includes a new wish with approve and decline", () => {
  const html = panel()._renderTodayTab();
  assert.match(html, /data-act="wish-approve" data-id="w1"/);
  assert.match(html, /data-act="approve-chore" data-id="p1"/);
});

test("the week view marks unrecorded days instead of inventing a number", () => {
  const html = panel()._renderTodayWeek(panel()._state.children);
  assert.match(html, /tm-week-none/);
  assert.match(html, />3\/3</);
  assert.match(html, /panel\.today_week_hint/);
});

test("a missing board says so rather than rendering empty", () => {
  const p = panel({ today: null });
  assert.match(p._renderTodayBoard(p._state.children), /panel\.today_board_unavailable/);
});

test("the child filter narrows chores, rewards and the approval queue", () => {
  const p = panel();
  p._scope = "kid2";
  assert.deepEqual(p._filterByName(p._state.chores).map(c => c.id), ["bed", "cat"]);
  assert.deepEqual(p._filterByName(p._state.rewards).map(r => r.id), ["tv", "lego"]);
  const queue = p._approvalQueue({ wishes: true });
  assert.equal(queue.count, 1);
  assert.doesNotMatch(queue.html, /approve-chore/);
});

test("a filter naming a deleted child falls back to everyone", () => {
  const p = panel();
  p._scope = "gone";
  assert.equal(p._scopeId(), "");
  assert.equal(p._filterByName(p._state.chores).length, 3);
});

test("command search finds chores by name and runs their edit action", () => {
  const p = panel();
  p._palette = { q: "dish", hi: 0 };
  const html = p._paletteListHtml();
  assert.match(html, /data-act="edit-chore" data-id="dishes"/);
  assert.doesNotMatch(html, /data-id="bed"/);
});

test("an empty search lists sections and actions but not every item", () => {
  const p = panel();
  p._palette = { q: "", hi: 0 };
  const html = p._paletteListHtml();
  assert.match(html, /data-act="tab" data-tab="chores"/);
  assert.match(html, /data-act="add-chore"/);
  assert.doesNotMatch(html, /data-act="edit-chore"/);
});

test("a collapsed group hides its items unless it holds the open section", () => {
  const p = panel();
  p._navClosed = new Set(["earn", "spend"]);
  p._activeTab = "rewards";
  const html = p._sidebar();
  assert.doesNotMatch(html, /data-tab="chores"/);
  assert.match(html, /data-tab="rewards"/);
});
