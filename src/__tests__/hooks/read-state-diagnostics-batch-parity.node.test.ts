import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { ReadDiagnosticEventArgs } from "@/api/schemas";
import { envelopeByteSizeForTests } from "@/components/reader/hooks/article/read-state-diagnostics";

// Shared with the Rust-side fixture consumer:
// src-tauri/src/commands/log_commands.rs::tests::read_diagnostics_batch_size_calc_matches_the_canonical_wire_fixture_byte_counts
//
// `expectedBytes` in the fixture was computed independently with Python's json.dumps(obj,
// separators=(",", ":")) encoded as UTF-8 -- not by calling envelopeByteSize/realByteSize
// themselves -- so this test actually pins the `{ events, droppedCount }` camelCase envelope
// shape: if the frontend ever started sending a different key name, the measured byte count
// would move away from this fixed number instead of trivially matching it.
const FIXTURE_PATH = join(process.cwd(), "tests/fixtures/read-diagnostics/batch-parity.json");

type FixtureCase = {
  name: string;
  wire: { events: ReadDiagnosticEventArgs[]; droppedCount: number };
  expectedBytes: number;
};

type Fixture = { cases: FixtureCase[] };

function loadFixture(): Fixture {
  return JSON.parse(readFileSync(FIXTURE_PATH, "utf8")) as Fixture;
}

describe("read diagnostics batch byte-size parity (frontend side)", () => {
  const fixture = loadFixture();

  it("carries at least one case", () => {
    expect(fixture.cases.length).toBeGreaterThan(0);
  });

  for (const testCase of fixture.cases) {
    it(`matches the canonical wire fixture byte count for ${testCase.name}`, () => {
      const measured = envelopeByteSizeForTests(testCase.wire.events, testCase.wire.droppedCount);
      expect(measured).toBe(testCase.expectedBytes);
    });
  }

  it("omits errorClass entirely (rather than sending null) when it is undefined, unlike Rust's re-serialization", () => {
    // This documents the frontend's own half of the pre-existing, out-of-scope asymmetry noted in
    // the Rust fixture consumer test
    // read_diagnostics_batch_size_calc_reserializes_a_missing_error_class_as_explicit_null: the
    // frontend never sends an explicit null for a missing optional field, it omits the key.
    const settledWithoutErrorClass: ReadDiagnosticEventArgs = {
      event: "settled",
      requestId: "99999999-9999-4999-8999-999999999999",
      generation: 1,
      outcome: "success",
      durationMs: 10,
      saturated: false,
      errorClass: undefined,
      staleOwner: false,
    };

    const serialized = JSON.stringify({ events: [settledWithoutErrorClass], droppedCount: 0 });

    expect(serialized).not.toContain("errorClass");
  });
});
