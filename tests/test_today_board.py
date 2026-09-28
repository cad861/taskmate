"""Tests for the admin panel Today board and daily progress history (#966).

is_chore_available_for_child is mocked (as in test_due_chores) so these cover
what get_today_board adds: done chores staying on the board, the daily limit,
approval state, today's mandatory misses and the stored week history.
"""

from __future__ import annotations

import asyncio
import datetime as dt
from datetime import timezone
from unittest.mock import AsyncMock, MagicMock, patch

from custom_components.taskmate.coordinator import TaskMateCoordinator
from custom_components.taskmate.models import Child, Chore, ChoreCompletion, MandatoryMiss
from custom_components.taskmate.storage import TaskMateStorage

UTC = timezone.utc
NOW = dt.datetime(2026, 4, 20, 10, 0, 0, tzinfo=UTC)  # Monday
YESTERDAY = NOW - dt.timedelta(days=1)


def _storage():
    st = object.__new__(TaskMateStorage)
    st._data = {"daily_progress": {}}
    return st


def _coord(chores, completions=None, available=True, misses=None, children=("ch1",)):
    coord = object.__new__(TaskMateCoordinator)
    coord.storage = MagicMock()
    coord.storage.get_chores = MagicMock(return_value=chores)
    coord.storage.get_completions = MagicMock(return_value=completions or [])
    coord.storage.get_children = MagicMock(return_value=[Child(name=c, id=c) for c in children])
    coord.storage.get_mandatory_misses = MagicMock(return_value=misses or [])
    coord.weekly_target_met = MagicMock(return_value=False)
    if callable(available):
        coord.is_chore_available_for_child = MagicMock(side_effect=available)
    else:
        coord.is_chore_available_for_child = MagicMock(return_value=available)
    return coord


def _board(coord):
    with patch("custom_components.taskmate.coord_chores.dt_util.now", return_value=NOW):
        return coord.get_today_board()


def _statuses(board, child_id="ch1"):
    entry = next(c for c in board["children"] if c["child_id"] == child_id)
    return {i["chore_id"]: i["status"] for i in entry["chores"]}


def test_open_chores_are_todo_and_others_are_left_off():
    chores = [
        Chore(name="Everyone", assigned_to=[], id="a"),
        Chore(name="Sibling", assigned_to=["ch2"], id="b"),
    ]
    board = _board(_coord(chores))
    assert board["date"] == "2026-04-20"
    assert _statuses(board) == {"a": "todo"}


def test_done_chore_stays_on_the_board_even_when_no_longer_available():
    """A finished weekly chore stops being 'available' but was still today's."""
    chores = [Chore(name="Weekly", id="a")]
    comps = [ChoreCompletion(chore_id="a", child_id="ch1", completed_at=NOW, approved=True)]
    board = _board(_coord(chores, comps, available=False))
    assert _statuses(board) == {"a": "done"}
    entry = board["children"][0]
    assert (entry["due"], entry["done"]) == (1, 1)


def test_awaiting_approval_is_pending_and_counts_towards_done():
    chores = [Chore(name="Dishes", id="a"), Chore(name="Bed", id="b")]
    comps = [ChoreCompletion(chore_id="a", child_id="ch1", completed_at=NOW, approved=False)]
    board = _board(_coord(chores, comps))
    assert _statuses(board) == {"a": "pending", "b": "todo"}
    assert (board["children"][0]["due"], board["children"][0]["done"]) == (2, 1)


def test_below_daily_limit_is_still_todo_with_count():
    chores = [Chore(name="Water", daily_limit=3, id="a")]
    comps = [ChoreCompletion(chore_id="a", child_id="ch1", completed_at=NOW, approved=True)]
    item = _board(_coord(chores, comps))["children"][0]["chores"][0]
    assert (item["status"], item["count"], item["limit"]) == ("todo", 1, 3)


def test_yesterdays_and_bonus_subtask_completions_are_ignored():
    chores = [Chore(name="Bed", id="a")]
    comps = [
        ChoreCompletion(chore_id="a", child_id="ch1", completed_at=YESTERDAY, approved=True),
        ChoreCompletion(chore_id="a", child_id="ch1", completed_at=NOW, approved=True, bonus_subtask_id="x"),
    ]
    assert _statuses(_board(_coord(chores, comps))) == {"a": "todo"}


def test_todays_mandatory_miss_shows_as_missed():
    chores = [Chore(name="Homework", id="a"), Chore(name="Gone", id="b")]
    misses = [
        MandatoryMiss(chore_id="a", child_id="ch1", due_date="2026-04-20", period_id="afternoon"),
        MandatoryMiss(chore_id="b", child_id="ch1", due_date="2026-04-20", period_id="anytime"),
        MandatoryMiss(chore_id="a", child_id="ch1", due_date="2026-04-19", period_id="afternoon"),
    ]
    avail = lambda chore, cid: chore.id == "a"
    assert _statuses(_board(_coord(chores, misses=misses, available=avail))) == {"a": "missed", "b": "missed"}


def test_weekly_target_met_chore_is_not_owed():
    chores = [Chore(name="Hoover", id="a")]
    coord = _coord(chores)
    coord.weekly_target_met = MagicMock(return_value=True)
    assert _statuses(_board(coord)) == {}


def test_each_child_gets_their_own_board():
    chores = [Chore(name="Mine", assigned_to=["ch1"], id="a"), Chore(name="Shared", id="b")]
    comps = [ChoreCompletion(chore_id="b", child_id="ch2", completed_at=NOW, approved=True)]
    board = _board(_coord(chores, comps, children=("ch1", "ch2")))
    assert _statuses(board, "ch1") == {"a": "todo", "b": "todo"}
    assert _statuses(board, "ch2") == {"b": "done"}


# ---------------------------------------------------------------------------
# Daily progress storage + history
# ---------------------------------------------------------------------------


def test_upsert_replaces_same_day_and_prunes_before_cutoff():
    st = _storage()
    st.upsert_daily_progress("ch1", "2026-03-01", 4, 1, cutoff="2026-01-01")
    st.upsert_daily_progress("ch1", "2026-04-19", 5, 2, cutoff="2026-01-01")
    st.upsert_daily_progress("ch1", "2026-04-19", 5, 5, cutoff="2026-03-21")
    assert st.get_daily_progress("ch1") == [{"date": "2026-04-19", "due": 5, "done": 5}]
    st.remove_daily_progress_for_child("ch1")
    assert st.get_daily_progress("ch1") == []


def test_record_daily_progress_stores_todays_counts():
    chores = [Chore(name="Bed", id="a"), Chore(name="Teeth", id="b")]
    comps = [ChoreCompletion(chore_id="a", child_id="ch1", completed_at=NOW, approved=True)]
    coord = _coord(chores, comps)
    st = _storage()
    coord.storage.upsert_daily_progress = st.upsert_daily_progress
    coord.storage.async_save = AsyncMock()
    with patch("custom_components.taskmate.coord_chores.dt_util.now", return_value=NOW):
        asyncio.run(coord.async_record_daily_progress())
    assert st.get_daily_progress("ch1") == [{"date": "2026-04-20", "due": 2, "done": 1}]
    coord.storage.async_save.assert_awaited_once()


def test_history_is_seven_days_with_today_live_and_gaps_empty():
    chores = [Chore(name="Bed", id="a")]
    coord = _coord(chores)
    st = _storage()
    st.upsert_daily_progress("ch1", "2026-04-18", 3, 2, cutoff="2026-01-01")
    st.upsert_daily_progress("ch1", "2026-04-20", 9, 9, cutoff="2026-01-01")  # stale; live wins
    coord.storage.get_daily_progress = st.get_daily_progress
    with patch("custom_components.taskmate.coord_chores.dt_util.now", return_value=NOW):
        state = coord.daily_progress_state()
    days = state["history"]["ch1"]
    assert [d["date"] for d in days] == [f"2026-04-{n}" for n in range(14, 21)]
    assert days[4] == {"date": "2026-04-18", "due": 3, "done": 2}
    assert days[5] == {"date": "2026-04-19"}
    assert days[6] == {"date": "2026-04-20", "due": 1, "done": 0}
    assert state["board"]["children"][0]["chores"] == [{"chore_id": "a", "status": "todo", "count": 0, "limit": 1}]
