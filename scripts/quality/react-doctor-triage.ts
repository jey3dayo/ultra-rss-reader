import { readFileSync } from "node:fs";
import * as v from "valibot";
import type { ReactDoctorPin } from "./react-doctor-schemas.ts";
import { reactDoctorPinSchema } from "./react-doctor-schemas.ts";

function loadReactDoctorPin(): ReactDoctorPin {
  const pinJson = readFileSync("scripts/quality/react-doctor-pin.json", "utf8");
  return v.parse(reactDoctorPinSchema, JSON.parse(pinJson));
}

const reactDoctorPin = loadReactDoctorPin();

export const reactDoctorBaselines = {
  diff: reactDoctorPin.diff,
  full: reactDoctorPin.full,
} as const;

// Named so the empty array below keeps an element type. `as const` infers `readonly []` for a
// literal empty array, which makes the report loop over `never`.
type PendingJudgmentWarningFamily = {
  readonly rule: string;
  readonly count: number;
  readonly status: string;
  readonly trackingIssue: string;
};

const pendingJudgmentWarningFamilies: readonly PendingJudgmentWarningFamily[] = [];

const reactDoctorFullScanTriageStatusBase = {
  // The SHA must be reachable from main. A branch commit is not: squash-merging drops it,
  // and the pin then names a commit nobody can fetch to reproduce the measurement.
  //
  // It names the tree the scan ran against, and nothing more. What reproduces there is the raw
  // scan: warningCount, errorCount, affectedFileCount and auditWarningCount, by re-running
  // scanCommand and auditScanCommand at the pinned pluginVersion. The classification numbers below
  // are those diagnostics read through the *current* records, so this commit's own copy of the
  // block is deliberately outside the contract — do not compare them.
  scanSha: reactDoctorPin.scanSha,
  pluginVersion: reactDoctorPin.pluginVersion,
  scanCommand: reactDoctorPin.scanCommand,
  // Rows in the record that this scan reports, not rows in the record: rows the scan no longer
  // reports stay in place, marked. scripts/check-react-doctor-pin-consistency.ts compares the sets.
  classifiedFindingCount: 22,
  classifiedRecordPath: "docs/react-doctor-complexity-classification.md",
  outlierIssue: "https://github.com/jey3dayo/ultra-rss-reader/issues/256",
  classifiedWarningFamilies: [
    {
      rule: "no-loading-flag-reset-outside-finally",
      count: 3,
      disposition: "false-positive",
      recordPath: ".claude/rules/react-doctor-triage.md (Loading Flag Reset Findings)",
    },
    {
      // Off by default in the pinned plugin. The disposition applies if it is turned back on.
      rule: "js-tosorted-immutable",
      count: 0,
      disposition: "false-positive",
      recordPath: ".claude/rules/code-policy.md (ES2023 Array Copy Methods)",
    },
    {
      // Off by default in the pinned plugin.
      rule: "js-combine-iterations",
      count: 0,
      disposition: "accepted-risk",
      recordPath: ".claude/rules/react-doctor-triage.md (Iteration And Lookup Shape Findings)",
    },
    {
      rule: "js-set-map-lookups",
      count: 1,
      disposition: "accepted-risk",
      recordPath: ".claude/rules/react-doctor-triage.md (Iteration And Lookup Shape Findings)",
    },
    {
      rule: "no-self-updating-effect",
      count: 1,
      disposition: "accepted-risk",
      recordPath: ".claude/rules/react-doctor-triage.md (Behavioural Single Findings)",
    },
    {
      rule: "prefer-html-dialog",
      count: 1,
      disposition: "accepted-risk",
      recordPath: ".claude/rules/react-doctor-triage.md (Behavioural Single Findings)",
    },
    {
      // Removed from the pinned plugin's rule set. Counts must match the scan, so this stays 0.
      rule: "require-pnpm-hardening",
      count: 0,
      disposition: "deferred",
      recordPath: "https://github.com/jey3dayo/ultra-rss-reader/issues/264",
    },
    // Count 0 because every finding in these families carries an inline disable; the verdict
    // applies again if a disable is removed.
    {
      rule: "no-pass-data-to-parent",
      count: 0,
      disposition: "accepted-risk",
      recordPath: "docs/react-doctor-warning-classification-300.md",
    },
    {
      rule: "no-pass-live-state-to-parent",
      count: 0,
      disposition: "accepted-risk-and-false-positive",
      recordPath: "docs/react-doctor-warning-classification-300.md",
    },
    {
      rule: "no-derived-state",
      count: 0,
      disposition: "accepted-risk-and-false-positive",
      recordPath: "docs/react-doctor-warning-classification-300.md",
    },
    {
      // Only reported once no-derived-state is suppressed; see react-doctor-triage.md on the pairing.
      rule: "no-derived-state-effect",
      count: 0,
      disposition: "accepted-risk-and-false-positive",
      recordPath: "docs/react-doctor-warning-classification-300.md",
    },
    {
      rule: "no-adjust-state-on-prop-change",
      count: 0,
      disposition: "accepted-risk",
      recordPath: "docs/react-doctor-warning-classification-300.md",
    },
    {
      // A second entry for the same rule because this finding has a different record.
      rule: "no-adjust-state-on-prop-change",
      count: 1,
      disposition: "accepted-risk",
      recordPath: ".claude/rules/react-doctor-triage.md (Adjust State On Prop Change Findings)",
    },
    {
      // Count 0 because no component trips the rule; the disposition applies if one grows back.
      rule: "no-giant-component",
      count: 0,
      disposition: "accepted-risk",
      recordPath: "docs/react-doctor-warning-classification-300.md",
    },
    {
      rule: "no-reset-all-state-on-prop-change",
      count: 0,
      disposition: "accepted-risk",
      recordPath: "docs/react-doctor-warning-classification-300.md",
    },
    {
      rule: "no-secrets-in-client-code",
      count: 0,
      disposition: "false-positive",
      recordPath: "docs/react-doctor-warning-classification-300.md",
    },
  ],
  // Findings whose decision is blocked on something other than reading them. Kept out of
  // classifiedWarningFamilies so their count stays inside the untriaged total.
  pendingJudgmentWarningFamilies,
  // No open tracker while the untriaged total is 0; point this at a new issue when one is needed.
  untriagedWarningIssue: "https://github.com/jey3dayo/ultra-rss-reader/issues/256",
  errorIssue: "https://github.com/jey3dayo/ultra-rss-reader/issues/260",
  // The dispositions must total errorCountAtScan (pinned by the baseline test), so re-pinning
  // errorCount without re-classifying fails. mustFix counts fixes still owed.
  errorClassification: {
    pass: "2026-09-10",
    recordPath: "docs/react-doctor-error-triage.md",
    mustFix: 0,
    falsePositive: 1,
    acceptedRisk: 1,
  },
  // Named so re-pinning a total cannot erase an earlier decision.
  previouslyClassifiedErrors: [
    {
      rule: "no-prop-callback-in-render",
      location: "src/__tests__/components/story-query-client-provider.node.test.tsx:12",
      classification: "accepted-risk",
      reason:
        "Calls onClient during render, which the rule reports correctly. The call is a vi.fn QueryClient observation in a test helper, not a production state update; not re-confirmed in the 2026-09-08 pass.",
    },
  ],
  // The scanned warningCount is net of every inline disable, so on its own it cannot tell a
  // fixed finding from a silenced one. auditWarningCount is the same scan with
  // --no-respect-inline-disables, which is the number that moves only when a finding is
  // actually fixed. Re-pin the two together; measured on the same SHA as scanSha.
  auditWarningCount: reactDoctorPin.auditWarningCount,
  auditScanCommand: reactDoctorPin.auditScanCommand,
  reportArtifactPath: "tmp/react-doctor-full.json",
  // classifiedRule is used in triage, not in the pin
  classifiedRule: "no-high-complexity-react-function",
} as const;

const classifiedWarningFamiliesCount = reactDoctorFullScanTriageStatusBase.classifiedWarningFamilies.reduce(
  (total, family) => total + family.count,
  0,
);

// untriagedWarningCountAtScan is derived from the pinned totals so re-pinning never needs a
// hand-recomputed subtraction.
export const reactDoctorFullScanTriageStatus = {
  ...reactDoctorFullScanTriageStatusBase,
  classifiedWarningFamiliesCount,
  // Derived so there is no second pinned copy of the error total to drift.
  errorCountAtScan: reactDoctorBaselines.full.errorCount,
  untriagedWarningCountAtScan:
    reactDoctorBaselines.full.warningCount -
    reactDoctorFullScanTriageStatusBase.classifiedFindingCount -
    classifiedWarningFamiliesCount,
} as const;
