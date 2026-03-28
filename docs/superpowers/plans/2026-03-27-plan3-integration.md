# Ultra RSS Reader — Plan 3: Integration & Polish

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans

Goal: FreshRSS連携、OPML、ブラウザビュー、検索を実装しMVPを完成させる

Tech Stack: Rust (Google Reader API client), Tauri WebView, OPML XML parser

Spec: `docs/superpowers/specs/2026-03-26-ultra-rss-reader-design.md`

---

## Tasks

1. Google Reader API Client (FreshRSS provider)
2. Add Account Flow (Tauri commands + UI)
3. OPML Import
4. Search (LIKE-based)
5. Browser View (Tauri WebView)
6. Sync trigger integration (startup, refresh button, interval)
7. Add local feed flow (UI: add subscription dialog)
8. Final polish & full integration test
