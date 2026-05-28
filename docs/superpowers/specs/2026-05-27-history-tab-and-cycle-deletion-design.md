# History Tab & Cycle Deletion Design

**Date:** 2026-05-27 (revised 2026-05-28)
**Status:** Approved (v2 — history page redesign)

## Summary

Add a "History" tab for browsing and managing all fetal movement records, simplify the main page to show only today's data, and stop persisting manually closed (invalid) cycles.

## Scope

Two sequential phases:

1. **Logic change** — manual cycle closure discards data instead of archiving as invalid
2. **UI change** — new History tab with swipe-to-delete, main page narrowed to today-only

---

## Phase 1: Manual Closure Discards Data

### Current behavior

`closeCycle` → `archiveActiveCycle(state, "manual", eventTs)` → pushes cycle to `completed_cycles` with `is_valid: false`.

### New behavior

1. **Confirmation dialog (UI layer, `index.tsx`):**
   - Triggered when user taps "结束当前周期"
   - Title: "停止本次记录？"
   - Message: "系统将不会保存这次的数据"
   - Buttons: "确认停止" (destructive) / "取消"
   - `closeCycle` is only called after confirmation

2. **Model layer (`model.ts`):**
   - `closeCycle` no longer calls `archiveActiveCycle`
   - Instead: `state.active_cycle = null`, `saveState(state)`, cancel pending notifications
   - Return message: "已停止本次记录，数据未保存。"

3. **Data migration (`storage.ts`):**
   - In `readState` (or `migrateStateIfNeeded`), filter out cycles where `is_valid === false` from `completed_cycles`
   - One-time automatic cleanup on first read after update

4. **Type cleanup:**
   - `CloseReason` keeps `"manual"` as optional for backward compatibility but new code won't produce it
   - `is_valid` field remains optional on `Cycle` type but is no longer written

### Affected files

- `common/model.ts` — `closeCycle` rewrite
- `common/storage.ts` — migration filter in `migrateStateIfNeeded`
- `index.tsx` — add `confirmationDialog` for close cycle action
- `widget.tsx` — remove "结束" button from `ActionButtons`
- `common/types.ts` — no breaking changes, optional fields kept

---

## Phase 2: UI Changes

### 2a. Main Page — Today Only

**Current:** `RecordsPage` renders Hero card + all `DayCard`s (up to 30 days).

**New:**

- Hero card unchanged (record button + close cycle button)
- Section title changes from "每日记录" to "今日记录"
- Only render the `DayCard` matching today's `day_key`
- Today card title format changes to full Chinese date: "2026年5月27日" (no "今天" prefix since the page context is already today)
- If no records today, show existing `EmptyState` component
- `index.tsx` passes only the today card to `RecordsPage` (filter `cards` by `formatDayKey(nowTs)`)

**Affected files:**

- `index.tsx` — filter cards before passing to RecordsPage
- `pages/records.tsx` — section title change, today card title format
- `utils/date.ts` — add `formatChineseDate(ts)` helper (e.g. "2026年5月27日")

### 2b. History Tab — New Third Tab

**Tab structure:** 记录 / 历史 / 设置

**Architecture: List as sole scroll container (no outer ScrollView)**

The History tab uses `<List>` directly inside `<NavigationStack>` — no wrapping `<ScrollView>`. This eliminates the double-scroll conflict that occurs when List is nested inside ScrollView. Navigation modifiers (`navigationTitle`, `toolbar`) and `toast` are applied directly on the List.

```
Tab "历史"
└── NavigationStack
    └── List (listStyle="insetGrouped", the only scroll container)
        ├── Section (day card: 2026年5月28日)
        │   ├── DaySummaryRow (not swipeable)
        │   ├── CycleRow (swipe-to-delete)
        │   └── CycleRow (swipe-to-delete)
        ├── Section (day card: 2026年5月27日)
        │   ├── DaySummaryRow
        │   └── CycleRow
        └── ...
```

**Page layout:**

1. NavigationBar title: "历史记录", inline mode
2. `<List>` with `listStyle="insetGrouped"`:
   - Each Section automatically renders as a rounded card
   - No need for manual `frame({ height })`, `listRowInsets`, or `listRowBackground` hacks
   - System handles scroll, card appearance, and swipe gesture routing
3. Data grouped by day as `<Section>`, each Section is a visual card containing:

   **First row: Day summary (not swipeable)**
   - Left side: date in Chinese format ("2026年5月28日") + active cycle indicator (● if has_active_cycle)
   - Right side: estimated count badge (number + "推算次数" caption)
   - Subtitle: "X小时计数 · X次有效胎动"

   **Subsequent rows: Cycle rows (swipeable for completed cycles)**
   - Left side: time range ("00:34-01:34")
   - Right side: "有效 X  点击 X"
   - Active cycle: shows ● indicator, **no swipe action**
   - Completed cycle: has `trailingSwipeActions`

4. Swipe-to-delete interaction:
   - `allowsFullSwipe: false` (prevent accidental full-swipe deletion)
   - Single "删除" button with trash icon, styled with `tint` (red color)
   - **Critical:** Do NOT use `role="destructive"` on the swipe Button — this causes SwiftUI to auto-animate row removal before the confirmation dialog appears, leading to state mismatch and crash
   - On tap: `Dialog.confirm` with title "确认删除此周期？", message "删除后不可恢复。"
   - On confirm: `deleteCycle(cycleId)` → `refresh()` → `Widget.reloadAll()`

5. After deletion:
   - The day's summary stats (推算次数, 计数小时, 有效胎动) recalculate automatically
   - If the deleted cycle was from today, the main "记录" tab also updates on next render
   - If a day has no cycles remaining after deletion, the entire Section disappears
   - Widget also refreshes

6. Empty state: "暂无历史记录" + "完成一个计数周期后，记录会出现在这里。" when no cycles exist

7. History includes today's data (today's cycles appear both on main page and history page)

**Data layer:**

- `deleteCycle(cycleId: string)` in `model.ts` (already implemented):
  - Reads state, filters `completed_cycles` to exclude matching `cycle_id`
  - Saves state
  - Returns `CommandResult` with status "deleted" or "not_found"

**Affected files:**

- `index.tsx` — replace History tab's `<ScrollView>` wrapper with direct `<List>` approach; move `toast` and navigation props onto the HistoryPage component or a wrapper
- `pages/history.tsx` — rewrite to use `insetGrouped` List with DaySummaryRow + CycleRow per Section
- `common/stats.ts` — no changes needed; `buildDayCards` already computes all required stats

---

## Design Decisions Log

| Decision | Choice | Rationale |
|---|---|---|
| History page location | New third Tab | Most discoverable, clear mental model |
| Invalid cycle display | Don't persist after Phase 1 | Simplifies data, no need to filter in UI |
| Today's data in history | Yes, included | Single place for deletion management |
| Active cycle in history | Show but not deletable | User should use main page to stop active cycle |
| List style | `insetGrouped` | Card-per-day appearance with native swipe support |
| No outer ScrollView | List is sole scroll container | Eliminates double-scroll conflict and gesture interception |
| Day summary as first row | Not a Section header | Allows richer layout (badge, subtitle) within card body |
| Delete interaction | Swipe-to-delete + Dialog.confirm | iOS standard, native List support |
| Swipe button styling | `tint` (not `role="destructive"`) | Prevents auto-row-removal animation before dialog |
| `allowsFullSwipe` | `false` | Prevent accidental deletion |
| Delete confirmation | `Dialog.confirm` (global async) | Consistent with existing app patterns |
| Post-delete refresh | `refresh()` recomputes all derived data | Stats, today page, and widget all sync automatically |
| Today card title | "2026年5月27日" full Chinese date | Warm tone, no redundant "今天" prefix |
| Main page empty state | Existing EmptyState component | Already well-designed, no changes needed |
| Manual close confirmation | Dialog before calling closeCycle | User knows data won't be saved |

---

## Notes

- **Shortcut / Intent callers:** `closeCycle` in `model.ts` discards unconditionally. The confirmation dialog is UI-only (`index.tsx`). Shortcut callers (via `runCommand("close_cycle", ...)`) will discard without confirmation — user adds their own confirmation step in the Shortcuts app.
- **Widget change:** Remove the "结束" button from `widget.tsx` (`ActionButtons` component). The `CloseCycleIntent` in `app_intents.tsx` is kept for shortcut use. Widget users must open the app to stop a cycle.

## Out of Scope

- Batch deletion (low-frequency operation, not needed)
- Undo/soft-delete mechanism
- Filtering or search within history
- Widget changes (widget already only shows today)

---

## Revision History

| Date | Change |
|---|---|
| 2026-05-27 | Initial draft |
| 2026-05-28 | v2: Redesigned history page — replaced ScrollView+plain List with `insetGrouped` List as sole scroll container; added day summary row with stats (推算次数, 计数小时, 有效胎动); fixed delete crash by removing `role="destructive"` from swipe button |
