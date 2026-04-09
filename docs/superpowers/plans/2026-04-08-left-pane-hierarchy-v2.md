# Left Pane Hierarchy V2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the approved left-pane hierarchy update so smart views read as a distinct top-level entry area while subscriptions remain a clean folder-to-feed tree.

**Architecture:** Keep the existing sidebar data flow intact and limit changes to presentation boundaries. `Sidebar` will keep assembling the same feed and folder view models, while `SmartViewsView` and `FeedTreeView` get small presentational extensions for section labels, count weighting, and the unfoldered group treatment.

**Tech Stack:** React 19, TypeScript, Vitest, Testing Library, i18next

---

## Task 1: Lock the approved structure with tests

**Files:**

- Modify: `src/__tests__/components/smart-views-view.test.tsx`
- Modify: `src/__tests__/components/feed-tree-view.test.tsx`
- Modify: `src/__tests__/components/sidebar.test.tsx`

- [ ] **Step 1: Write failing tests for the new section labels and unfoldered grouping**
- [ ] **Step 2: Run targeted Vitest commands and confirm the new expectations fail for the intended reasons**
- [ ] **Step 3: Keep the tests minimal and focused on the approved hierarchy, not on incidental classnames**

## Task 2: Implement the smart view and subscription presentation changes

**Files:**

- Modify: `src/components/reader/smart-views-view.tsx`
- Modify: `src/components/reader/feed-tree-view.tsx`
- Modify: `src/components/reader/feed-tree-row.tsx`
- Modify: `src/components/reader/sidebar.tsx`
- Modify: `src/locales/ja/sidebar.json`
- Modify: `src/locales/en/sidebar.json`

- [ ] **Step 1: Add a lightweight smart-view section label and stronger smart-view count styling**
- [ ] **Step 2: Rename the feed section to subscriptions and pass the new label through i18n**
- [ ] **Step 3: Render unfoldered feeds under a lightweight group label instead of as a bare list**
- [ ] **Step 4: Reduce feed-count visual weight while keeping folder counts slightly stronger**

## Task 3: Verify the change stays stable

**Files:**

- Test: `src/__tests__/components/smart-views-view.test.tsx`
- Test: `src/__tests__/components/feed-tree-view.test.tsx`
- Test: `src/__tests__/components/sidebar.test.tsx`

- [ ] **Step 1: Run the targeted component tests until they pass**
- [ ] **Step 2: Run one focused broader check for sidebar-related regressions**
- [ ] **Step 3: Summarize the implementation and note any remaining polish ideas separately from this change**
