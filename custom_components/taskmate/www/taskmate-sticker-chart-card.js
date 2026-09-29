/**
 * TaskMate Sticker Chart Card
 * One sticker per approved chore, per child, towards a daily or weekly goal.
 *
 * Config:
 *   entity:     sensor.taskmate_overview (required)
 *   goal:       "week" (default) | "day"
 *   goal_count: stickers needed to hit the goal (default 10 per week, 3 per day)
 *   child_id:   show a single child only
 */

const LitElement = customElements.get("hui-masonry-view")
  ? Object.getPrototypeOf(customElements.get("hui-masonry-view"))
  : Object.getPrototypeOf(customElements.get("hui-view"));

const html = LitElement.prototype.html;
const css = LitElement.prototype.css;

// Keeps number runs like "3 / 10" reading left to right in RTL text (#995);
// identity until the design layer has loaded.
const _ltrNums = (s) => (window.__taskmate_design && window.__taskmate_design.ltrNums ? window.__taskmate_design.ltrNums(s) : s);

const GOALS = ["week", "day"];
const DEFAULT_GOAL_COUNT = { week: 10, day: 3 };
const MAX_GOAL_COUNT = 60;

class TaskMateStickerChartCard extends LitElement {
  static get properties() {
    return {
      hass: { type: Object },
      config: { type: Object },
    };
  }

  shouldUpdate(changedProps) {
    if (changedProps.has("hass")) {
      return window.__taskmate_hasChanged
        ? window.__taskmate_hasChanged(changedProps.get("hass"), this.hass, this.config?.entity)
        : true;
    }
    return true;
  }

  _t(key, params) {
    const fn = window.__taskmate_localize;
    return fn ? fn(this.hass, key, params) : key;
  }

  static get styles() {
    const base = css`
      :host { display: block; }
      ha-card { overflow: hidden; }
      .hd {
        display: flex; align-items: center; gap: 10px;
        padding: 14px 18px;
        background: var(--tmd-accent, var(--primary-color));
        color: var(--tmd-hd-text, #fff);
        font-family: var(--tmd-font-display, inherit);
        font-weight: 700; font-size: 1.1rem;
      }
      .hd .period { margin-inline-start: auto; font-size: 0.8rem; font-weight: 600; opacity: 0.9; }
      .body { padding: 14px 18px 18px; display: grid; gap: 14px; font-family: var(--tmd-font-body, inherit); }
      .kid {
        display: grid; gap: 8px; padding: 12px;
        background: var(--tmd-surface-2, var(--secondary-background-color));
        border: 1px solid var(--tmd-border, var(--divider-color));
        border-radius: var(--tmd-radius-sm, 12px);
      }
      .kid.done { border-color: var(--tmd-good, #2ecc71); }
      .kid-hd { display: flex; align-items: center; gap: 8px; }
      .name { flex: 1; min-width: 0; font-weight: 800; color: var(--tmd-text, var(--primary-text-color)); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .count { font-size: 0.85rem; font-weight: 700; color: var(--tmd-dim, var(--secondary-text-color)); }
      .kid.done .count { color: var(--tmd-good, #2ecc71); }
      .slots { display: flex; flex-wrap: wrap; gap: 6px; }
      .slot {
        width: 34px; height: 34px; border-radius: 50%;
        display: flex; align-items: center; justify-content: center;
        border: 2px dashed var(--tmd-border, var(--divider-color));
        color: var(--tmd-dim, var(--secondary-text-color));
        --mdc-icon-size: 20px;
      }
      .slot.on {
        border: 2px solid var(--tmd-gold, #f1c40f);
        background: color-mix(in srgb, var(--tmd-gold, #f1c40f) 25%, transparent);
        color: var(--tmd-gold, #f1c40f);
      }
      .extra { font-size: 0.8rem; font-weight: 700; color: var(--tmd-accent, var(--primary-color)); align-self: center; }
      .msg { padding: 18px; text-align: center; color: var(--tmd-dim, var(--secondary-text-color)); }
    `;
    const tokens = window.__taskmate_design && window.__taskmate_design.styles
      ? window.__taskmate_design.styles() : null;
    return tokens ? [tokens, base] : base;
  }

  setConfig(config) {
    if (!config || !config.entity) throw new Error(this._t("sticker.error.entity_required"));
    const goal = GOALS.includes(config.goal) ? config.goal : "week";
    const n = Math.floor(Number(config.goal_count));
    const goalCount = Number.isFinite(n) && n > 0 ? Math.min(n, MAX_GOAL_COUNT) : DEFAULT_GOAL_COUNT[goal];
    this.config = { title: null, child_id: null, ...config, goal, goal_count: goalCount };
  }

  getCardSize() { return 4; }
  static getConfigElement() { return document.createElement("taskmate-sticker-chart-card-editor"); }
  static getStubConfig() {
    return { entity: "sensor.taskmate_overview", goal: "week" };
  }

  render() {
    if (!this.hass || !this.config) return html``;

    if (window.__taskmate_design) {
      window.__taskmate_design.apply(this, this.hass, this.config, this.config.entity);
    }

    const entity = this.hass.states[this.config.entity];
    if (!entity) {
      return html`<ha-card><div class="msg">${this._t("common.entity_not_found", { entity: this.config.entity })}</div></ha-card>`;
    }
    if (entity.state === "unavailable" || entity.state === "unknown") {
      return html`<ha-card><div class="msg">${this._t("common.unavailable")}</div></ha-card>`;
    }

    const attrs = (window.__taskmate_attrs && window.__taskmate_attrs(this.hass, this.config.entity)) || entity.attributes || {};
    const { goal, goal_count: target } = this.config;
    const icon = attrs.points_icon || "mdi:star";

    let children = Array.isArray(attrs.children) ? attrs.children : [];
    if (this.config.child_id) children = children.filter((c) => c.id === this.config.child_id);

    // Counted by the backend over every completion; recent_completions is
    // capped globally and would undercount busy families.
    const field = goal === "day" ? "stickers_today" : "stickers_week";
    const counts = {};
    children.forEach((c) => { counts[c.id] = Number(c[field]) || 0; });

    return html`
      <ha-card>
        <div class="hd">
          <ha-icon icon="${icon}"></ha-icon>
          <span>${this.config.title || this._t("sticker.default_title")}</span>
          <span class="period">${this._t(goal === "day" ? "sticker.period_day" : "sticker.period_week")}</span>
        </div>
        <div class="body">
          ${children.length === 0
            ? html`<div class="msg">${this._t("sticker.no_children")}</div>`
            : children.map((child) => {
                const n = counts[child.id] || 0;
                const reached = n >= target;
                const slots = Array.from({ length: target }, (_, i) => i < n);
                return html`
                  <div class="kid ${reached ? "done" : ""}">
                    <div class="kid-hd">
                      <span class="name">${child.name}</span>
                      <span class="count">${reached
                        ? this._t("sticker.goal_reached")
                        : _ltrNums(this._t("sticker.progress", { count: n, goal: target }))}</span>
                    </div>
                    <div class="slots">
                      ${slots.map((on) => html`<div class="slot ${on ? "on" : ""}"><ha-icon icon="${on ? icon : "mdi:plus"}"></ha-icon></div>`)}
                      ${n > target ? html`<span class="extra">+${n - target}</span>` : ""}
                    </div>
                  </div>`;
              })}
        </div>
      </ha-card>`;
  }
}

class TaskMateStickerChartCardEditor extends LitElement {
  static get properties() {
    return { hass: { type: Object }, config: { type: Object } };
  }

  _t(key, params) {
    const fn = window.__taskmate_localize;
    return fn ? fn(this.hass, key, params) : key;
  }

  static get styles() {
    return css`:host { display: block; } ha-form { display: block; }`;
  }

  setConfig(config) { this.config = config; }

  _schema() {
    const entity = this.config?.entity ? this.hass?.states?.[this.config.entity] : null;
    const children = entity?.attributes?.children || [];
    return [
      { name: "entity", selector: { entity: { domain: "sensor" } } },
      { name: "title", selector: { text: {} } },
      {
        name: "goal",
        selector: {
          select: {
            options: [
              { value: "week", label: this._t("sticker.editor.goal_week") },
              { value: "day", label: this._t("sticker.editor.goal_day") },
            ],
            mode: "dropdown",
          },
        },
      },
      { name: "goal_count", selector: { number: { min: 1, max: MAX_GOAL_COUNT, mode: "box" } } },
      {
        name: "child_id",
        selector: {
          select: {
            options: [
              { value: "__all__", label: this._t("common.editor.filter_by_child_all") },
              ...children.map((c) => ({ value: c.id, label: c.name })),
            ],
            mode: "dropdown",
          },
        },
      },
      {
        name: "card_design",
        selector: {
          select: {
            options: window.__taskmate_design
              ? window.__taskmate_design.editorOptions(this._t.bind(this))
              : [{ value: "global", label: "Use global default" }],
            mode: "dropdown",
          },
        },
      },
    ];
  }

  _label = (entry) => ({
    entity: this._t("common.editor.overview_entity"),
    title: this._t("sticker.editor.title"),
    goal: this._t("sticker.editor.goal"),
    goal_count: this._t("sticker.editor.goal_count"),
    child_id: this._t("common.editor.filter_by_child"),
    card_design: this._t("common.design.field_label"),
  })[entry.name] ?? entry.name;

  render() {
    if (!this.hass || !this.config) return html``;
    const data = {
      ...this.config,
      goal: this.config.goal || "week",
      child_id: this.config.child_id || "__all__",
      card_design: this.config.card_design || "global",
    };
    return html`<ha-form .hass=${this.hass} .data=${data} .schema=${this._schema()}
      .computeLabel=${this._label} @value-changed=${this._changed}></ha-form>`;
  }

  _changed = (ev) => {
    const value = ev.detail.value || {};
    const config = { ...value };
    if (config.child_id === "__all__" || !config.child_id) delete config.child_id;
    if (config.card_design === "global" || !config.card_design) delete config.card_design;
    if (config.title === "" || config.title == null) delete config.title;
    if (!config.goal_count) delete config.goal_count;
    this.dispatchEvent(new CustomEvent("config-changed", { detail: { config }, bubbles: true, composed: true }));
  };
}

customElements.define("taskmate-sticker-chart-card", TaskMateStickerChartCard);
customElements.define("taskmate-sticker-chart-card-editor", TaskMateStickerChartCardEditor);

window.customCards = window.customCards || [];
window.customCards.push({
  type: "taskmate-sticker-chart-card",
  name: "TaskMate Sticker Chart",
  description: "One sticker per approved chore towards a daily or weekly goal",
  preview: true,
  getEntitySuggestion: (hass, entityId) =>
    window.__taskmate_suggest(hass, entityId, "taskmate-sticker-chart-card", "overview"),
});
