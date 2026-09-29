"""Sticker chart counts come from every stored completion, not the capped
`recent_completions` list (which holds only the newest 35 across all children)."""

from __future__ import annotations

from datetime import timedelta

from homeassistant.util import dt as dt_util

from custom_components.taskmate.models import ChoreCompletion
from custom_components.taskmate.sensor import _sticker_counts


def _comp(child, when, approved=True):
    return ChoreCompletion(chore_id="c", child_id=child, completed_at=when, approved=approved)


def test_counts_only_approved_and_current_week():
    now = dt_util.now()
    week_start = now - timedelta(days=now.weekday())
    last_week = week_start - timedelta(days=1)
    comps = [
        _comp("a", now),
        _comp("a", now, approved=False),
        _comp("a", last_week),
        _comp("b", now),
    ]
    out = _sticker_counts({"all_completions": comps})
    assert out["a"] == {"today": 1, "week": 1}
    assert out["b"] == {"today": 1, "week": 1}


def test_counts_are_not_capped_at_recent_completions_limit():
    now = dt_util.now()
    comps = [_comp("a", now) for _ in range(60)]
    assert _sticker_counts({"all_completions": comps})["a"] == {"today": 60, "week": 60}
