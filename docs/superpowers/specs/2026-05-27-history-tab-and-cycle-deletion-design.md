# History Tab & Cycle Deletion Design

**Date:** 2026-05-27
**Status:** Draft

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

**Page layout:**

1. NavigationBar title: "历史记录", inline mode
2. Uses `<List>` component with:
   - `listStyle="plain"` — transparent background
   - `listRowSeparator="hidden"` — no default separators
   - `listRowInsets={0}` — no default padding
   - `listRowBackground={<VStack />}` — clear row background
   - `listRowSpacing={8}` — spacing between rows
   - Dynamic `frame={{ height }}` calculated from data to work inside ScrollView
3. Data grouped by day as `<Section>`, each with a date header ("2026年5月27日" format)
4. Each cycle row displays:
   - Time range (e.g. "14:30-15:30")
   - Click count and effective count
   - Styled with existing `pillBackground` + `smallCardRadius`
5. Active cycle (if present) is displayed but **not deletable** (no swipe action)
6. Completed cycles have `trailingSwipeActions` with:
   - `allowsFullSwipe: false` (prevent accidental full-swipe deletion)
   - Single red "删除" button with trash icon
   - On tap: `Dialog.confirm` with title "确认删除此周期？", message "删除后不可恢复。"
   - On confirm: remove cycle from `completed_cycles`, save state, refresh
7. Empty state: "暂无历史记录" when no cycles exist
8. History includes today's data (today's cycles appear both on main page and history page)

**Data layer:**

- New function `deleteCycle(cycleId: string)` in `model.ts`:
  - Reads state, filters `completed_cycles` to exclude matching `cycle_id`
  - Saves state
  - Returns `CommandResult` with confirmation message

**Affected files:**

- `index.tsx` — add third Tab "历史" with NavigationStack + List
- `pages/history.tsx` — new file, history page component
- `common/model.ts` — add `deleteCycle` function
- `common/stats.ts` — no changes needed; after Phase 1 cleanup all remaining cycles pass `getVisibleCycles` filter, so `buildDayCards` works as-is for both main page and history page

---

## Design Decisions Log

| Decision | Choice | Rationale |
|---|---|---|
| History page location | New third Tab | Most discoverable, clear mental model |
| Invalid cycle display | Don't persist after Phase 1 | Simplifies data, no need to filter in UI |
| Today's data in history | Yes, included | Single place for deletion management |
| Active cycle in history | Show but not deletable | User should use main page to stop active cycle |
| Delete interaction | Swipe-to-delete + Dialog.confirm | iOS standard, verified working in prototype |
| `allowsFullSwipe` | `false` | Prevent accidental deletion |
| Delete confirmation | Dialog.confirm (Epical pattern) | Consistent with existing app patterns |
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
