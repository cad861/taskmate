// Sticker chart card: one sticker per approved chore, per child, towards a
// daily or weekly goal. Counts come from the backend (stickers_today /
// stickers_week), never from the capped recent_completions list.

const assert = require("node:assert/strict");
const { test } = require("node:test");

const { loadCard, render } = require("./harness.cjs");

const ENTITY = "sensor.taskmate_overview";
const DESIGNS = ["classic", "playroom", "console", "cleanpro", "accessible", "graphite"];

const hass = {
  language: "en",
  states: {
    [ENTITY]: {
      state: "ok",
      attributes: {
        points_icon: "mdi:star",
        children: [
          { id: "a", name: "Millie", stickers_today: 1, stickers_week: 4 },
          { id: "b", name: "Evie", stickers_today: 3, stickers_week: 12 },
        ],
        // A stale capped list must be ignored.
        recent_completions: [{ completion_id: "x", child_id: "a", approved: true, completed_at: new Date().toISOString() }],
      },
    },
  },
};

const Card = loadCard("taskmate-sticker-chart-card.js").get("taskmate-sticker-chart-card");

function make(config) {
  const card = new Card();
  card.setConfig({ entity: ENTITY, ...config });
  card.hass = hass;
  return card;
}

test("sticker chart — an entity is required", () => {
  assert.throws(() => new Card().setConfig({}));
});

test("sticker chart — goal defaults to the week with 10 stickers", () => {
  const card = make({});
  assert.equal(card.config.goal, "week");
  assert.equal(card.config.goal_count, 10);
});

test("sticker chart — day goal defaults to 3 and bad values fall back", () => {
  assert.equal(make({ goal: "day" }).config.goal_count, 3);
  assert.equal(make({ goal: "nonsense" }).config.goal, "week");
  assert.equal(make({ goal_count: -4 }).config.goal_count, 10);
  assert.equal(make({ goal_count: 9999 }).config.goal_count, 60);
});

test("sticker chart — week mode reads stickers_week and flags a reached goal", () => {
  const markup = render(make({ goal: "week", goal_count: 10 }).render()).markup;
  assert.equal((markup.match(/class="slot on"/g) || []).length, 10 + 4, "4 filled for Millie, 10 for Evie");
  assert.ok(markup.includes("kid done"), "Evie reached her goal");
  assert.ok(markup.includes("+2"), "stickers beyond the goal are shown");
});

test("sticker chart — day mode reads stickers_today", () => {
  const markup = render(make({ goal: "day", goal_count: 3 }).render()).markup;
  assert.equal((markup.match(/class="slot on"/g) || []).length, 1 + 3);
});

test("sticker chart — child_id shows a single child", () => {
  const markup = render(make({ child_id: "a" }).render()).markup;
  assert.ok(markup.includes("Millie"));
  assert.ok(!markup.includes("Evie"));
});

for (const design of DESIGNS) {
  test(`sticker chart — ${design} renders`, () => {
    const markup = render(make({ card_design: design }).render()).markup;
    assert.ok(markup.includes("Millie") && markup.includes("Evie"));
  });
}
