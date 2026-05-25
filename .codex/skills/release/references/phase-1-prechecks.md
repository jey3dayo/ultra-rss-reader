# Phase 1: Pre-Checks And Version Choice

Run all checks before editing release files.

```bash
git branch --show-current
git fetch origin main
git rev-parse HEAD
git rev-parse origin/main
git status --porcelain
mise run check
```

Abort if:

- the current branch is not `main`;
- `HEAD` does not exactly match `origin/main`;
- `git status --porcelain` is not empty;
- `mise run check` fails.

Read `current_version` from `package.json` only after these gates pass.

Use an already supplied valid bump type (`patch`, `minor`, or `major`) only after every pre-check succeeds. Ask for a bump only when it was not supplied or was invalid.

## Push-First Synchronization

If the user explicitly asked to push first, run this synchronization check before the `HEAD == origin/main` gate:

```bash
git branch --show-current
git status --porcelain
git fetch origin main
git rev-list --left-right --count HEAD...origin/main
```

- Continue immediately when the ahead/behind count is `0 0`.
- If the count is `<ahead> 0`, push current clean `main` with `git push origin main`, then fetch and re-check until the count is `0 0`.
- If the count is `0 <behind>` or both sides are non-zero, stop before editing release files and report that `main` is not synchronized safely.

After any push-first synchronization, run the normal gates again and require `HEAD == origin/main`.
