# Koruva — Parallel AI Editing Policy

This project may be edited concurrently by the repository owner and multiple AI coding assistants. These rules apply before **every** change, not only at the start of a task.

## 1. Reconcile before editing

- Fetch the latest `main` commit and the target working branch before each change set.
- Fetch the latest blob SHA and contents of every file that will be changed immediately before writing it.
- Inspect intervening commits and diffs when either branch has advanced. Rebase the intended patch conceptually onto the latest content; never restore an older full-file snapshot over newer work.
- Make writes sequentially for a given path. Do not run simultaneous updates against the same file.
- Prefer a focused feature branch and pull request over direct commits to `main`.

## 2. Preserve the owner's design intent

- Treat the owner's stated design, expected behavior, compatibility requirements, and constraints as the default source of truth.
- Do not silently replace an intended design with a personal preference or an unrelated refactor.
- Before changing an established approach, compare it with existing project implementations, tests, registries, and recent commits. Reuse a better implementation already present instead of creating a competing helper or registry.

## 3. Prefer a demonstrably better method when appropriate

A more robust method may replace the current approach when it has a concrete advantage, such as correctness, compatibility, bounded memory/CPU, reliable delivery, simpler shared behavior, or regression coverage.

When doing so:
- Preserve the intended user-visible behavior.
- State the reason for the change in the commit message or patch notes.
- Consolidate on the shared/canonical implementation where possible.
- Add or update regression tests that demonstrate the improvement.
- Keep migrations/backward compatibility for existing worlds and saved player data.

## 4. Validate and communicate honestly

- Add focused regression tests for each corrected failure mode.
- Run the relevant tests, typecheck, and build when the execution environment permits.
- Distinguish source inspection, automated test results, build results, and real-browser/production verification. Never describe an unrun check as passing.
- Report files changed, the behavior corrected, any remaining uncertainty, and whether deployment is still required.

## 5. Scope and safety

- Avoid unrelated rewrites while another contributor is working in the same subsystem.
- If a concurrent change provides a more complete or more accurate implementation, align with it and preserve attribution through the repository's existing commit history.
- Never claim delivery is guaranteed over an unreliable network. Instead, use bounded messages, progress signals, explicit inactivity handling, and clear disconnect errors.
