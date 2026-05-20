---
name: bump-version
description: プロジェクトのバージョンを自動的にインクリメントし、CHANGELOG更新・コミット・gitタグ作成・origin push まで一括実行。Semantic Versioning に従い、コミット履歴からバージョン種別を自動判定。リリース作業全体を自動化する。
---

# bump-version

Automates the full release cycle: version bump → CHANGELOG → lockfile sync → commit → tag → push.

## Step 1: Detect Version Files

Scan the project root for version files that exist:
- `pyproject.toml` — `version = "X.Y.Z"` under `[project]`
- `src-tauri/Cargo.toml` — `version = "X.Y.Z"` under `[package]`
- `src-tauri/tauri.conf.json` — `"version": "X.Y.Z"`
- `ui/package.json` — `"version": "X.Y.Z"`

Read current version from the first found file. All found files must be kept in sync.

## Step 2: Determine Bump Type

Analyze `git log` from the last `chore(release):` commit to HEAD:
- `feat!:` or `BREAKING CHANGE` in body → **major**
- `feat:` present → **minor**
- Only `fix:`, `chore:`, `refactor:`, `ci:`, etc. → **patch**

Declare `NEW_VERSION` and report it to the user before proceeding.

## Step 3: Update All Version Strings

Use the Edit tool (never sed/awk) to update each found version file:
- `pyproject.toml`: replace `version = "OLD"` → `version = "NEW"` in `[project]` section
- `src-tauri/Cargo.toml`: replace `version = "OLD"` → `version = "NEW"` in `[package]` section only
- `src-tauri/tauri.conf.json`: replace `"version": "OLD"` → `"version": "NEW"`
- `ui/package.json`: replace `"version": "OLD"` → `"version": "NEW"`

## Step 4: Update CHANGELOG.md

Insert a new section immediately after the file header (before the first `## [` entry):

```
## [NEW_VERSION] - YYYY-MM-DD - <3-5 word release title>

### Added
- <feat commits as bullet points>

### Fixed
- <fix commits as bullet points>

### Changed
- <refactor/chore commits if user-notable>
```

- Date: use today's date
- Title: concise summary of the main theme
- Skip trivial commits: `chore(release):`, lockfile-only, CI config changes

## Step 5: Sync Lockfiles

Run lockfile update commands for detected package managers:
- If `uv.lock` exists: `uv lock`
- If `src-tauri/Cargo.lock` exists: `cargo check --manifest-path src-tauri/Cargo.toml`

## Step 6: Commit

Stage only release files (skip any that don't exist in this project):
```
git add pyproject.toml src-tauri/Cargo.toml src-tauri/tauri.conf.json ui/package.json CHANGELOG.md uv.lock src-tauri/Cargo.lock
```

Commit message:
```
chore(release): bump version to NEW_VERSION
```

## Step 7: Create Git Tag and Push

Push the branch first, then the tag:

```bash
git push
git tag vNEW_VERSION
git push origin vNEW_VERSION
```

Report: `✅ Pushed branch, tagged vNEW_VERSION, and pushed tag to origin. CI build fires automatically on tag push.`

## Examples

**Success**: Commits since last release include `ci: add GitHub Actions build` and `fix(sidecar): Windows python path` → patch bump → `0.14.3 → 0.14.4` → all version files updated → CHANGELOG inserted → lockfiles synced → committed → `git push` → `git tag v0.14.4` → `git push origin v0.14.4`.

**Failure**: Creating a local tag without `git push origin vX.Y.Z` — GitHub Actions never fires.
**Failure**: Pushing the tag before `git push` — release commit is missing from origin/main.
