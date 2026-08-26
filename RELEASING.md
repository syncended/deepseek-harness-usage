# Releasing

Releases use the same tag-driven npm publication flow as the other `@syncended/dsh-*` plugins. The base branch is `trunk`; there are no Changesets or release-it steps.

## One-time setup

1. Add an npm granular access token with package read/write access and 2FA bypass to the GitHub Actions secret `NPM_REGISTRY_TOKEN`.
2. Keep GitHub Actions allowed to create provenance attestations and GitHub Releases.

## Every release

Start from a clean `trunk` with all checks passing:

```bash
pnpm install --frozen-lockfile
pnpm check
npm pack --dry-run
```

Then bump, commit, tag, and push:

```bash
npm version patch   # or minor, major, or an explicit version
pnpm install --lockfile-only
git add pnpm-lock.yaml
git commit --amend --no-edit
git tag -f "v$(node -p 'require("./package.json").version')"
git push --follow-tags
```

If the lockfile did not change, the `git add`/amend/tag refresh steps are unnecessary and the usual two commands are enough:

```bash
npm version patch
git push --follow-tags
```

`.github/workflows/release.yml` verifies that the tag equals `v<package version>`, installs with pnpm 11, runs all checks, verifies package contents, publishes to npm with provenance, and creates an idempotent GitHub Release with generated notes.

Package page: https://www.npmjs.com/package/@syncended/dsh-usage
