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

The verifier requires the 16 core assets, with an optional complete Linux family (19 assets total), and a GitHub SHA-256 digest for every asset. It verifies downloaded sizes and hashes, the two updater checksum files against their generated artifact names and bytes, Minisign prehashed `ED` signatures for the macOS archive and both Windows installers, every `latest.json` URL/signature mapping, and both platform provenance records against tag, source, original run, attempt, version, and platform. The Tauri signature sidecars are base64-encoded Minisign text; the verifier decodes that wrapper before checking the standard four-line signature. It accepts the two canonical platform keys or the observed five-key compatibility-alias shape. The Windows canonical key and MSI alias must point to MSI; the NSIS alias must point to setup.exe.

The optional Linux family consists of the versioned `amd64` `.deb`, `.AppImage`, and `release-provenance-linux-x86_64.json`. All three must be present or absent together. The proof must name both unique canonical release filenames, bind each SHA-256 to the downloaded bytes and GitHub digest, and match the expected source commit, tag target, release tag, run, attempt, ref, Linux platform, and current Release ID. Generation and upload both receive `LINUX_RELEASE_ID` from `steps.tauri-build.outputs.releaseId`. Upload checks the fixed `releases/<id>` API response for matching ID/draft/tag and uses only that ID's upload endpoint; it never resolves a tag to retarget the write. Deleted or recreated drafts fail, and existing proof assets require manual inspection without automatic deletion or retries. The verifier reads `gh run view --attempt <n> --json ...jobs...` and requires an exact `Generate Linux release provenance` step with conclusion `success` inside a successful job in that selected attempt. Missing, skipped, or failed generation rejects Linux evidence even if its JSON matches. Linux stays excluded from `latest.json`.

A successful `workflow_dispatch` build is valid when its workflow ref is the release tag and the asset provenance names the same run and attempt. A validation-only or dry-run cannot substitute for that artifact-building run. An inventory-only result is incomplete.

This pass verifies Tauri updater signatures. Follow [Release Manual Verification](../../../../docs/release-manual-verification.md) for macOS codesign, Gatekeeper, installer, and packaged-app checks.
