# Draft Artifact Verification

Run this after the original artifact-building Release run has completed and before publishing its draft:

```bash
node scripts/release/artifacts.ts verify-draft-release \
  --expected-tag v{version} \
  --source-sha {peeled_tag_sha} \
  --run-id {original_build_run_id} \
  --attempt {original_build_attempt} \
  --output-root tmp/release-verification/{tag}-run-{id}-attempt-{attempt}
```

Supply the exact tag target SHA and the original successful build run ID and attempt. The command resolves a draft through `gh release view`, then reads the release by its structured ID so the asset response includes GitHub digests. It also reads the remote annotated tag and selected run through existing `gh` authentication. Downloads go into a new directory under repository `tmp`; existing paths and symlinked ancestors are rejected. It never publishes, edits, or deletes Release state. It suppresses raw `gh` output and reports only safe status and verification errors. The updater trust key comes from `src-tauri/tauri.conf.json` at the expected source SHA via `git show`.

GitHub may report the selected run URL with `/attempts/{n}` while provenance stores the canonical run URL. Both forms are accepted only when origin, repository path, run ID, and the selected attempt match.

The verifier requires the current 16-asset release contract and GitHub SHA-256 digest for every asset. It verifies downloaded sizes and hashes, the two updater checksum files against their generated artifact names and bytes, Minisign prehashed `ED` signatures for the macOS archive and both Windows installers, every `latest.json` URL/signature mapping, and both platform provenance records against tag, source, original run, attempt, version, and platform. The Tauri signature sidecars are base64-encoded Minisign text; the verifier decodes that wrapper before checking the standard four-line signature. It accepts the two canonical platform keys or the observed five-key compatibility-alias shape. The Windows canonical key and MSI alias must point to MSI; the NSIS alias must point to setup.exe.

A successful `workflow_dispatch` build is valid when its workflow ref is the release tag and the asset provenance names the same run and attempt. A validation-only or dry-run cannot substitute for that artifact-building run. An inventory-only result is incomplete.

This pass verifies Tauri updater signatures. Follow [Release Manual Verification](../../../../docs/release-manual-verification.md) for macOS codesign, Gatekeeper, installer, and packaged-app checks.
