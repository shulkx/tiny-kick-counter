# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project context

Tiny Kick Counter is a fetal movement counter built on the **Scripting** iOS app (SwiftUI-wrapped TSX components, not a generic React/web project). It runs on-device; there is no Node bundler, no test runner, and no lint command in this repo. All runtime APIs (storage, notifications, widgets, intents) are provided by Scripting's native bridge — refer to `dts/` for the type definitions and to the `analyze-scripting-project` / `native-api-coding-guide` skills before touching native calls.

## Validation

```sh
scripting-ts project "Tiny Kick Counter" --check
```

This is the only working validation command. Running `tests/*.ts` files directly fails because the iOS shell cannot resolve relative module paths; the project-level `--check` resolves the whole script project correctly. There is no `npm test` / `vitest` / lint setup — do not invent one.

## Architecture

Four entry points, all consuming the same state model in `common/`:

- `index.tsx` — main page, shows last 30 days of cards.
- `widget.tsx` — `systemMedium` home-screen widget (today summary + up to 2 cycles + action buttons).
- `intent.tsx` — Shortcuts/Share Sheet entry; receives JSON, returns JSON. See `SHORTCUTS.md`.
- `app_intents.tsx` — `AppIntent`s wired to the widget buttons.

Shared layer:

- `common/types.ts` — `FetalMovementState`, `Cycle`, `EffectiveMovement`, constants (`CYCLE_DURATION_MS`, `EFFECTIVE_WINDOW_MS`).
- `common/model.ts` — command dispatch (`record`, `close_cycle`, `reset`, ...) returning `CommandResult`. Re-exports stats/theme/storage helpers so pages can import from `common/model`.
- `common/storage.ts` — persistence, schema validation, backup/restore. `schema_version` gates `migrateStateIfNeeded`; bump it when changing the on-disk shape.
- `common/stats.ts` — derives day cards / widget rows / summary from cycles.
- `utils/notifications.ts` — schedules and cancels the cycle-end reminder.

### Domain rules (do not regress)

These are encoded across model/stats and are easy to break:

- A **cycle** is 1 hour from its first record. Recording with no active cycle starts a new one and counts as the 1st effective movement.
- A tap **< 5 min** after the previous effective movement is a sub-movement (bumps `total_count` only). **≥ 5 min** is a new effective movement.
- Cycle-end notifications are reminders only — archival happens **lazily** the next time any entry runs, not from the notification.
- Manually-closed cycles are kept in the JSON backup but marked invalid and excluded from cards/widget/stats.
- A cycle's date belongs to its `started_ts` (`day_key`), not the end.
- Projected count = `round(today_effective_total / today_hours_counted * 12)`.

### Shortcuts contract

Shortcuts pass `event_ts` (ms) so timing is deterministic regardless of when Scripting actually wakes; it must be respected (see `utils/command.ts` `isFutureRejected`). The script returns `{title, message, ...}` and the Shortcut sends its own notification — Scripting itself does not notify in this path.

## Release

Pushing a tag matching `v[0-9]+.[0-9]+.[0-9]+(-…)?` triggers `.github/workflows/release.yml`, which:

1. Verifies the tag commit is reachable from `main`.
2. Verifies `script.json.version` equals the tag (without the `v`).
3. Verifies `remoteResource.url` points to `https://github.com/<repo>/releases/latest/download/TinyKickCounter.zip` and `autoUpdateInterval` is `86400`.
4. Packages only the runtime files (`script.json`, the four entry `.tsx` files, `README.md`, `SHORTCUTS.md`, `common/`, `pages/`, `utils/`) into `TinyKickCounter.zip` and uploads to the release.

Before tagging: bump `script.json.version` to match. Tags with a `-suffix` (e.g. `v1.0.1-beta.1`) are published as pre-releases. `docs/`, `tests/`, `plan.md`, `.github/`, `.agent/` are explicitly excluded from the package and the workflow fails if any leak in.
