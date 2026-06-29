---
type: policy
title: Flaky Test Quarantine Policy
description: Policy for quarantining, documenting, and retiring flaky tests without hiding release risk.
resource: urn:ultra-rss-reader:docs:flaky-test-quarantine-policy
tags: [category/testing, audience/developer, audience/maintainer]
timestamp: 2026-06-29
audience: developer, maintainer
owner: project-maintainers
---

# Flaky Test Quarantine Policy

Flaky tests may be quarantined only when the unresolved risk remains discoverable from TODO tracking, issue tracking, and the skipped test annotation.

## Required Links

Every quarantined test must include all of the following:

- a `TODO.md` item or GitHub issue that names the user-visible or release risk;
- an owner handle or team name;
- an expiry date in `YYYY-MM-DD` format;
- retry evidence, including the failed command and at least one rerun result;
- an unskip gate that says which focused command must pass before the skip is removed.

## Skip Annotation Format

Use a single-line annotation immediately above the skipped test:

```ts
// flaky-quarantine: TODO=<TODO name or issue URL>; owner=<owner>; expires=<YYYY-MM-DD>; evidence=<command/result>; unskip=<focused command>
it.skip("...", () => {
  // ...
});
```

If the test framework supports a reason parameter, keep the same fields in the reason text. Do not use bare `it.skip`, `test.skip`, or `describe.skip` for flakes.

## Review Rules

- Expired quarantines fail review until the test is unskipped, the owner refreshes evidence, or the issue is split into a current TODO.
- Quarantine is for unstable verification only. Deterministic failures must be fixed or tracked as a normal defect.
- The linked TODO or issue must contain the same owner, expiry, retry evidence, and unskip gate so the risk survives test-file moves.
