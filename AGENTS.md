# AGENTS.md

This file provides repository-specific guidance for AI coding agents working on VSMemo.

Use it as contextual guidance rather than as a mandatory checklist. Inspect the files relevant to the requested change, preserve existing behavior unless the task requires otherwise, and continue through implementation and validation without stopping for routine decisions.

## Project Overview

VSMemo is a VS Code extension for creating and editing Markdown memos, date notes, and Markdown tables.

The project uses TypeScript and pnpm.

### Main source areas

* `src/extension.ts`

  * Extension entry point.
  * Registers commands and connects VS Code APIs, configuration, and feature modules.

* `src/dateNoteTemplate.ts`

  * Date-note template processing and variable substitution.

* `src/sidebarProvider.ts`

  * Webview provider for the Markdown Tools sidebar.

* `src/markdownTableUtils.ts`

  * Markdown table creation and manipulation.

* `src/markdownEditUtils.ts`

  * General Markdown/editor editing utilities.

* `src/test/`

  * Extension and feature tests.

* `package.json`

  * VS Code extension metadata, commands, menus, configuration, scripts, and dependencies.

* `esbuild.js`

  * Extension bundle configuration.

* `tsconfig.json`

  * TypeScript compiler configuration.

Generated directories:

* `dist/`
* `out/`

Do not edit generated files directly.

---

## Architecture Boundaries

Preserve the existing separation between VS Code integration and reusable logic.

### VS Code integration

Code that interacts directly with:

* `vscode.window`
* `vscode.workspace`
* `vscode.commands`
* `vscode.TextEditor`
* Webviews
* extension lifecycle

should remain near command handlers, providers, or the extension composition layer.

### Core logic

Logic such as:

* template substitution
* Markdown transformations
* table manipulation
* path or destination selection
* configuration-derived decisions that do not require VS Code UI state

should preferably remain independent of VS Code UI APIs and be testable as ordinary TypeScript functions.

Do not move code across these boundaries unless doing so materially improves the requested change.

---

## Repository Invariants

Preserve these behaviors unless the task explicitly requires changing them:

* Existing command IDs remain stable.
* Existing configuration keys remain backward compatible.
* Existing template-variable behavior remains compatible.
* Markdown transformations must not silently modify unrelated text.
* File creation and movement must respect configured workspace or destination paths.
* Generated output under `dist/` and `out/` must not be edited manually.
* Existing user workflows should not change as a side effect of unrelated modifications.

For file and folder operations, pay particular attention to:

* active editor state
* Explorer focus/selection
* workspace-relative versus absolute paths
* user-configured directories
* behavior when files or directories do not yet exist

---

## `package.json`

When a feature adds or changes a VS Code command, setting, or menu contribution, update all relevant declarations in `package.json`.

Depending on the feature, inspect:

* `contributes.commands`
* `contributes.menus`
* `contributes.configuration`
* `activationEvents`

Do not add declarations that are unnecessary for the currently supported VS Code version.

Keep command IDs and configuration keys consistent with their TypeScript usage.

---

## Implementation Scope

Make the smallest coherent change that fully satisfies the request.

Avoid unrelated cleanup or broad refactoring unless it is necessary to implement the requested behavior safely.

Small local refactoring is acceptable when it:

* removes duplication introduced by the change,
* makes the modified behavior testable, or
* preserves an architectural boundary.

Do not expand the task into a repository-wide redesign.

---

## Testing and Validation

Choose validation based on the affected area rather than running every command mechanically.

Useful repository commands include:

```bash
pnpm run check-types
pnpm run lint
pnpm run compile
pnpm run compile-tests
pnpm run test
```

For a normal TypeScript implementation change:

1. run the most relevant targeted tests if available;
2. run type checking and linting for affected code;
3. run broader compile/tests when the change touches integration points, commands, configuration, build behavior, or shared utilities.

When adding or changing observable behavior, add or update tests where they provide meaningful regression protection.

Do not add tests solely to mirror implementation details.

If a relevant test fails because of the requested change, diagnose and fix it before completing the task.

If a test failure is clearly pre-existing or environment-specific, report it explicitly instead of changing unrelated code.

---

## Dependencies

Prefer existing dependencies and platform APIs.

A new npm dependency is justified only when it materially reduces complexity or risk compared with implementing the behavior using existing project facilities.

If a new dependency is necessary:

* keep it narrowly scoped,
* verify that it is appropriate for a VS Code extension,
* update the lockfile consistently,
* explain the reason in the final summary.

Do not introduce a dependency merely for a trivial helper function.

---

## Compatibility-Sensitive Changes

Treat the following as compatibility-sensitive:

* renaming or removing configuration keys;
* changing existing command IDs;
* changing template syntax or substitution semantics;
* changing persisted data formats;
* intentionally altering existing user-visible workflows.

If the requested task clearly requires such a change, implement it rather than stopping solely because it is breaking.

Where practical, preserve backward compatibility or provide a migration path.

If the requested behavior is ambiguous and the alternatives would produce materially different compatibility outcomes, choose the least disruptive interpretation supported by the task and document the assumption.

---

## Agent Execution Guidance

For normal repository work, continue through the full implementation cycle without requesting approval for routine steps.

This includes:

* inspecting relevant files;
* tracing existing behavior;
* editing source and tests;
* running safe local build, lint, type-check, and test commands;
* fixing failures caused by the change;
* rerunning affected validation.

The repository's local development and test commands are considered safe to run.

Stop and report rather than guessing when:

* required behavior cannot be inferred from the task or repository;
* a destructive operation would affect user data or external systems;
* required credentials or external services are unavailable;
* validation cannot run because of an environment limitation.

---

## Completion Criteria

A task is complete when:

* the requested behavior is implemented;
* relevant architecture and compatibility constraints are preserved;
* affected declarations in `package.json` are consistent;
* meaningful regression tests are updated or added when appropriate;
* relevant validation has passed, or unresolved validation limitations are clearly identified;
* no unrelated changes remain in the implementation.

In the final response, summarize:

* what changed;
* any important implementation decisions;
* validation performed;
* remaining limitations or risks, if any.
