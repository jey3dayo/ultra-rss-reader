import { describe, expect, it } from "vitest";
import {
  buildUrrCargoArgs,
  isWindowsTarget,
  urrBuildOutputPath,
  urrSidecarDestinationPath,
} from "../../../scripts/release/stage-cli-sidecar";

describe("urr CLI sidecar staging", () => {
  it("keeps non-Windows targets unsuffixed", () => {
    expect(isWindowsTarget("aarch64-apple-darwin")).toBe(false);
    expect(urrBuildOutputPath("aarch64-apple-darwin")).toBe("src-tauri/target/aarch64-apple-darwin/release/urr");
    expect(urrSidecarDestinationPath("aarch64-apple-darwin")).toBe("src-tauri/binaries/urr-aarch64-apple-darwin");
  });

  it("keeps optional Linux targets unsuffixed", () => {
    expect(isWindowsTarget("x86_64-unknown-linux-gnu")).toBe(false);
    expect(urrBuildOutputPath("x86_64-unknown-linux-gnu")).toBe(
      "src-tauri/target/x86_64-unknown-linux-gnu/release/urr",
    );
  });

  it("appends .exe for Windows targets in both the build output and the staged sidecar name", () => {
    expect(isWindowsTarget("x86_64-pc-windows-msvc")).toBe(true);
    expect(urrBuildOutputPath("x86_64-pc-windows-msvc")).toBe(
      "src-tauri/target/x86_64-pc-windows-msvc/release/urr.exe",
    );
    expect(urrSidecarDestinationPath("x86_64-pc-windows-msvc")).toBe(
      "src-tauri/binaries/urr-x86_64-pc-windows-msvc.exe",
    );
  });

  it("builds the urr binary only, without optional Cargo features", () => {
    const args = buildUrrCargoArgs("aarch64-apple-darwin");

    expect(args).toEqual(["build", "--release", "--locked", "--bin", "urr", "--target", "aarch64-apple-darwin"]);
    expect(args).not.toContain("--features");
    expect(args).not.toContain("ultra-rss-reader");
  });
});
