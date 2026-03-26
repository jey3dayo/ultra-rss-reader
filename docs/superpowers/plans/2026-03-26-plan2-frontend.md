# Ultra RSS Reader — Plan 2: Frontend

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Reeder風の3ペインレスポンシブUIを構築し、Plan 1のRustバックエンドと接続する

**Architecture:** React + Zustand(UI state) + TanStack Query(server state) + Tauri invoke

**Tech Stack:** React 19, TypeScript, Zustand, TanStack Query, Tauri v2, CSS custom properties

**Spec:** `docs/superpowers/specs/2026-03-26-ultra-rss-reader-design.md` Section 7

---

## Tasks

1. Design Tokens & Dark Theme
2. Tauri API Layer (typed invoke wrappers)
3. Zustand UI Store + tests
4. Layout Hook (resolveLayout) + tests
5. TanStack Query Hooks (accounts, feeds, articles)
6. AppShell + AppLayout (responsive 3-pane container)
7. SidebarPane Components
8. ListPane Components
9. ContentPane Components
10. Responsive Breakpoint Detection
11. Keyboard Shortcuts (Reeder-compatible)
12. Polish & Integration Verification
