// Streak freeze tokens (#925): the streak and child cards show "❄️ N".
//
// Both cards draw themselves on more than one path (classic, and a designed
// path shared by the other styles). A feature added to one path only is
// invisible on the rest with no error, so every design is rendered here.

const assert = require("node:assert/strict");
const { test } = require("node:test");

const { loadCard, render, localize } = require("./harness.cjs");

const ENTITY = "sensor.taskmate_overview";
const DESIGNS = ["classic", "playroom", "console", "cleanpro", "accessible", "graphite"];
const TOOLTIP = localize("streak.freezes_tooltip");

function hassWith(child) {
  return {
    states: {
      [ENTITY]: {
        state: "ok",
        attributes: {
          children: [child],
          chores: [],
          recent_completions: [],
          todays_completions: [],
          chore_availability: {},
          points_icon: "mdi:star",
          points_name: "Stars",
          today_day_of_week: "wednesday",
        },
      },
    },
  };
}

const kid = (extra = {}) => ({ id: "kid1", name: "Mia", points: 12, current_streak: 9, best_streak: 9, chore_order: [], ...extra });

// ── Streak card ──────────────────────────────────────────────────────────

const StreakCard = loadCard("taskmate-streak-card.js").get("taskmate-streak-card");

function streakMarkup(child, design) {
  const card = new StreakCard();
  card.setConfig({ entity: ENTITY, card_design: design });
  card.hass = hassWith(child);
  return render(card.render()).markup;
}

for (const design of DESIGNS) {
  test(`streak card — ${design} shows the token count`, () => {
    const markup = streakMarkup(kid({ streak_freezes: 2 }), design);
    assert.match(markup, /❄️ 2/);
    assert.ok(markup.includes(TOOLTIP), "the chip explains itself on hover");
  });

  test(`streak card — ${design} still shows a count of zero while the feature is on`, () => {
    assert.match(streakMarkup(kid({ streak_freezes: 0 }), design), /❄️ 0/);
  });

  test(`streak card — ${design} shows nothing when the feature is off`, () => {
    assert.doesNotMatch(streakMarkup(kid(), design), /❄️/);
  });
}

// ── Child card ───────────────────────────────────────────────────────────

const ChildCard = loadCard("taskmate-child-card.js", {
  window: { __taskmate_badge_id: (b) => b.badge_id },
}).get("taskmate-child-card");

function childMarkup(child, design) {
  const card = new ChildCard();
  card.setConfig({ entity: ENTITY, child_id: "kid1", card_design: design });
  card.hass = hassWith(child);
  card._loading = {};
  card._optimisticCompletions = {};
  return render(card.render()).markup;
}

for (const design of DESIGNS) {
  test(`child card — ${design} shows the token count in the header`, () => {
    assert.match(childMarkup(kid({ streak_freezes: 1 }), design), /❄️ 1/);
  });

  test(`child card — ${design} keeps the header clean with no tokens`, () => {
    assert.doesNotMatch(childMarkup(kid({ streak_freezes: 0 }), design), /❄️/);
    assert.doesNotMatch(childMarkup(kid(), design), /❄️/);
  });
}

test("child card — classic shows the count with or without a level", () => {
  assert.match(childMarkup(kid({ streak_freezes: 2, level: 3 }), "classic"), /❄️ 2/);
  assert.match(childMarkup(kid({ streak_freezes: 2 }), "classic"), /❄️ 2/);
});
