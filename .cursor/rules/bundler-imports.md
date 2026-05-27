# Scripting-CLI Bundler: Entry File Import Rule

## The Constraint

The scripting-cli bundler **cannot** resolve modules correctly when an entry file (`index.tsx`, `widget.tsx`) imports from multiple `common/` modules that share internal dependencies. This causes runtime errors like `(0, module.fn) is not a function`.

## The Rule

**Entry files must import from a single `common/` module only.**

- `index.tsx` and `widget.tsx` → import ONLY from `./common/model`
- `model.ts` acts as the facade, re-exporting what entry files need from `stats`, `theme`, `types`, and `storage`
- Non-entry files (`pages/*.tsx`, `tests/*.ts`, internal `common/*.ts`) can freely import from any module

## When Adding New Exports

If a new function/type in `common/stats.ts`, `common/theme.ts`, `common/types.ts`, or `common/storage.ts` is needed by an entry file:

1. Add a re-export line in `common/model.ts`:
   ```ts
   export { myNewFunction } from "./stats"
   ```
2. Import it from `./common/model` in the entry file

**Never** add a direct `import from "./common/stats"` (or theme/types/storage) in `index.tsx` or `widget.tsx`.

## Why This Happens

The bundler evaluates modules in dependency order. When an entry file imports from Module A and Module B, and both A and B share a common dependency (e.g., `./types`), the bundler can fail to initialize the shared dependency before it's needed, leaving exports as `undefined` at runtime.

## Quick Diagnostic

If you see `TypeError: (0, module_name.functionName) is not a function` at runtime:
1. Check if the entry file imports from multiple `common/` modules
2. Consolidate through `model.ts` re-exports
