# Refactoring & Code Health — Design Spec

**Date:** 2026-05-27  
**Scope:** Tiny Kick Counter  
**Goal:** Improve code organization, clarify module boundaries, prevent rapid-press UX issues.

---

## 1. Split `index.tsx` by Page

### Problem

`index.tsx` is 484 lines mixing presentational components with state management and event handlers. Finding a specific component or understanding the state flow requires scanning the entire file.

### Solution

Extract UI into page-level modules. `index.tsx` retains only the top-level orchestration (state, handlers, TabView).

| New file | Contents | Approx lines |
|----------|----------|---:|
| `pages/records.tsx` | RecordsHeroCard, SummaryPill (exported), CycleRow, DayCardView, EmptyState, RecordsPage | ~125 |
| `pages/settings.tsx` | PlainCircleIcon, SettingsActionRow, SettingsPage | ~115 |
| `index.tsx` | MainPage (state, handlers, TabView shell) | ~90 |

**Shared component rule:** `SummaryPill` is used in both pages. It lives in `pages/records.tsx` and is exported for `pages/settings.tsx` to import. No separate `components/` folder — one 10-line component doesn't warrant extra directory structure.

### Interface contracts

`RecordsPage` props (unchanged from current inline usage):
```ts
{
  state: FetalMovementState
  cards: DayCard[]
  nowTs: number
  onRecord: () => void
  onCloseCycle: () => void
}
```

`SettingsPage` props (unchanged):
```ts
{
  cards: DayCard[]
  onExport: () => void
  onRestore: () => void
  onReset: () => void
}
```

---

## 2. Clean `model.ts` / `storage.ts` Boundary

### Problem

`model.ts` line 314 re-exports 13 symbols from `storage.ts`:
```ts
export { createBackup, createBackupFile, defaultState, exportState, getStateDirectory,
  getStateFilePath, migrateStateIfNeeded, parseBackupJson, readBackupFile,
  readState, restoreFromBackup, restoreFromBackupFile, saveState } from "./storage"
```

Consumers (e.g. `index.tsx`) import storage operations from `model.ts`, blurring the line between business logic and persistence.

### Solution

1. Remove the re-export line from `model.ts`.
2. Update consumers to import directly:
   - `index.tsx`: import `readState`, `saveState`, `createBackupFile` from `"./common/storage"`
   - `widget.tsx`: import `readState`, `saveState` from `"./common/storage"`
   - `intent.tsx` and `app_intents.tsx`: no change needed (they only import business-logic functions from `model.ts`)

**Resulting rule:**
- `common/model.ts` = business logic (record, close, archive, status, runCommand, restore wrappers)
- `common/storage.ts` = persistence (read/write state file, backup file I/O, validation, migration)

---

## 3. Extract `loadStateWithLazyArchive` into `model.ts`

### Problem

The pattern "read state → archive expired cycle if needed → save" is duplicated:

- `index.tsx` line 36-41 (`loadStateWithLazyArchive` function)
- `widget.tsx` lines 109-111 (inline)

### Solution

Move `loadStateWithLazyArchive` into `common/model.ts` as an exported function:

```ts
export function loadStateWithLazyArchive(nowTs = Date.now()): FetalMovementState {
  const { state } = readState()
  const archived = archiveExpiredCycleIfNeeded(state, nowTs)
  if (archived) saveState(state)
  return state
}
```

Both `index.tsx` and `widget.tsx` import and call it instead of duplicating the pattern.

---

## 4. Async-Loading Guard for Record Button

### Problem

The "记录胎动" button has no disabled state during the async `recordMovement` call. Rapid taps can fire multiple concurrent requests, causing UX confusion (multiple toasts, visual flicker). The model prevents data corruption but doesn't prevent the confusing feedback.

### Solution

Add `isRecording` state in `MainPage`:

```ts
const [isRecording, setIsRecording] = useState(false)

async function handleRecord() {
  if (isRecording) return
  setIsRecording(true)
  try {
    const result = await recordMovement(Date.now(), "app")
    refresh(result.message)
    requestWidgetReload()
  } finally {
    setIsRecording(false)
  }
}
```

Pass `disabled={isRecording}` to the record Button (if the Scripting Button API supports it), or guard via the early return alone.

Same pattern applies to `handleCloseCycle`.

---

## 5. Summary of Changes

| File | Action |
|------|--------|
| `index.tsx` | Remove component definitions, keep MainPage + handlers, add isRecording guard |
| `pages/records.tsx` | **New.** RecordsHeroCard, SummaryPill, CycleRow, DayCardView, EmptyState, RecordsPage |
| `pages/settings.tsx` | **New.** PlainCircleIcon, SettingsActionRow, SettingsPage |
| `common/model.ts` | Remove re-export line; add `loadStateWithLazyArchive` |
| `widget.tsx` | Replace inline archive pattern with `loadStateWithLazyArchive` import |

---

## 6. What's Explicitly Out of Scope

- Data scalability (unbounded `completed_cycles` growth)
- New features (charts, configurable rules, reminders)
- Concurrency guards between widget and app writes
- Test additions (can follow as a separate pass)

---

## 7. Verification

After refactoring:
1. `scripting-ts project "Tiny Kick Counter" --check` passes with no errors
2. Widget renders identically (manual visual check)
3. Record → sub-movement → close cycle → export → restore flow works end-to-end
4. Rapid-tap on record button shows single toast, not multiple
