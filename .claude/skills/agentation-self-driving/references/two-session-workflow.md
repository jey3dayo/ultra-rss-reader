# Two-Session Self-Driving Workflow

Full autonomous design review: one agent critiques, another fixes.

## Prerequisites

- Agentation toolbar installed with an `endpoint` pointing to the same HTTP server as the agent
- MCP server running and connected (toolbar shows "MCP Connected")
- `agent-browser` skill installed

## Setup

### Terminal 1 — The Critic (this skill)

```bash
claude
> /agentation-self-driving
```

This session opens the headed browser, scans the page, and adds design annotations. The user watches the browser as the agent navigates and critiques.

### Terminal 2 — The Fixer

```bash
claude
> Watch the intended Agentation session and address incoming feedback until I say stop.
```

This session blocks on `agentation_watch_annotations`, receives each annotation as it's created by Terminal 1, and edits the codebase to address the feedback.

Ask the agent to watch only the intended session, read the target code, make the change, run relevant checks and inspect visual results before resolving. Leave failed or unverified work open.

## How It Connects

1. Critic adds annotation → toolbar sends it to its configured HTTP endpoint
2. Fixer's `agentation_watch_annotations` unblocks with the new annotation
3. Fixer reads the annotation (element path, CSS selectors, feedback text)
4. Fixer greps the codebase using the selectors/component names
5. Fixer makes changes, verifies the result, then calls `agentation_resolve` with a summary
6. Fixer loops back to `agentation_watch_annotations`

## Flow Diagram

```
Browser (visible)          Terminal 1 (Critic)         Terminal 2 (Fixer)
─────────────────          ───────────────────         ──────────────────
User watches cursor    →   Scrolls, clicks elements   Blocking on watch...
Annotation dialog      →   Fills critique, clicks Add
                           Annotation auto-sends  →   Receives annotation
                                                      Reads code, makes fix
                                                      Resolves annotation
                           Moves to next element  →   Blocking on watch...
```

## Tips

- Start the Fixer session first so it's ready when annotations arrive
- The Critic can add annotations faster than the Fixer processes them — that's fine, they queue up
- If the page hot-reloads from Fixer's changes, the Critic may need to re-expand the toolbar
- Both sessions share the same MCP server registered with `claude mcp add` (stored in `~/.claude.json`)
