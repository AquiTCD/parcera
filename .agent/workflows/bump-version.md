---
description: Automatically bumps project versions, logs changes, updates lockfiles, and stages a release commit.
---
# /bump-version Workflow

This workflow automates the repetitive tasks involved in cutting a new release for the Parcera project. It ensures that both the Python backend and Tauri frontend versions stay synchronized, the `CHANGELOG.md` is populated, the `uv.lock` is updated, and the release commit is cleanly staged.

## Execution Steps

1. **Determine Semantic Version Bump**: 
   - Read `pyproject.toml` and `ui/package.json` to identify the current version.
   - Analyze the `git log` and `git diff` of the unreleased changes to evaluate the scope of updates (e.g., breaking changes, new features, or bug fixes).
   - Based on Semantic Versioning (SemVer) principles, autonomously decide whether a `major`, `minor`, or `patch` bump is most appropriate, and declare the `NEW_VERSION`.

2. **Update Version Strings**:
   - Update the `version` field in `pyproject.toml`.
   - Update the `version` field in `ui/package.json`.

3. **Update CHANGELOG.md**:
   - Read recent git commit history (e.g., `git log`) to summarize the changes since the last version.
   - Insert a new section at the top of `CHANGELOG.md` (below the header) in the format: `## [NEW_VERSION] - YYYY-MM-DD - Release Title`
   - Group the changes into `### Added`, `### Changed`, and `### Fixed` as appropriate.

// turbo
4. **Synchronize Lockfile**:
   - Run `uv lock` to ensure `uv.lock` perfectly reflects the updated `pyproject.toml`.

5. **Stage and Commit**:
   - Verify visually that the git status is clean except for the release files.
   - Run the commit command: 
     `git add pyproject.toml ui/package.json CHANGELOG.md uv.lock && git commit -m "chore(release): bump version to <NEW_VERSION>" -m "- Document architecture refactoring and config standardization" -m "- Record frontend stabilization and startup checks"` (adapt the descriptive messages based on the changelog).

6. **Confirmation**:
   - Notify the user that the version has been bumped and the commit is ready. Remind them they can now run `/create-pr` or push.
