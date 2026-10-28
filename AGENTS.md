# Codex Guidance

## Standing Dependency Completion Policy

Treat dependency remediation as part of completing authorized work on this
site, not as an optional follow-up. Proactively resolve vulnerabilities,
compatibility problems, broken installations and lockfile issues. Cover direct
and transitive dependencies, production and development dependencies,
workspaces and root-level tools. Do not dismiss findings because they are
pre-existing or development-only.

Before creating a release tag or publishing a release, require a clean locked
installation for every applicable dependency graph, zero known dependency
vulnerabilities in both full and production audits, and all applicable project
checks. An unavailable or incomplete audit is not a clean result. Use supported
upgrades, replacements or maintainable patches that preserve functionality.
Do not silence findings, weaken checks or force incompatible versions merely
to obtain a passing result.

Intermediate commits may capture coherent progress. Commit and push validated
work through this site's authorized delivery process, and complete meaningful
releases rather than stopping after reporting fixable dependency blockers.
Documentation-only housekeeping does not require an application release.

Preserve unrelated work, coordinate with other active chats, and retain existing
security, approval and production-access boundaries. Existing maintenance pauses
and repository exclusions remain in force; this policy does not expand access
or authorize otherwise excluded work. If a genuine blocker prevents completion,
preserve progress and report the exact blocker and remaining work. Distinguish
a published release from verified live deployment.

Treat this as a standing instruction for this site.

This is Civ Pro: Trial Ready, a dependency-light browser game and public teaching artifact for Civil Procedure practice.

Use these commands from this directory:

- `npm ci`
- `npm run audit`
- `npm run check`

Project constraints:

- Keep provider credentials, restricted-source caches, operator scripts, and private source material outside `dist/client`.
- Preserve the explicit public-artifact allowlist and the local-only storage boundary documented in `README.md`.
- Treat direct PACER access as optional, server-side, credentialed, and potentially fee-bearing.

## Public Repository and Secret Handling

- Treat this repository and every committed file as public information.
- Never commit `.env`, `.env.*`, credentials, access tokens, private keys, signing material, restricted-source caches, or environment-specific private paths. Track only scrubbed templates such as `.env.example`, with blank or unmistakably fake values.
- Before staging or publishing, inspect `git status --short`, review the staged diff, and run a redacted secret scan when available. Confirm that ignored local credential files remain ignored.
- If a real secret ever enters tracked content or Git history, stop publication, remove it from the affected history, and rotate or revoke the credential before pushing or changing visibility.

## Commit, Tag, and Release Policy

- Commit coherent, validated increments frequently: normally after each focused change passes its relevant checks and before switching to a different concern. Preserve unrelated user work and do not fold it into an unclear commit.
- Push validated commits as the normal completion step so the public repository stays current.
- Create tags less frequently, only for meaningful version, citation, submission, or compatibility milestones. An ordinary commit does not need a tag.
- Publish a release only at a milestone with aligned version metadata, release notes, verified artifacts and checksums where applicable, and passing release checks. Use a draft or prerelease for genuinely provisional milestones, a source-only release when that is the intended artifact, and a stable release only when the documented stable benchmark is met.

## Direct Delivery and Pull Requests

- After a coherent change set passes the repository's required checks, default to committing it and pushing it directly to the repository's default branch. Do not open a pull request unless the user explicitly asks for one, branch protection requires it, or an external-contribution policy makes direct integration inappropriate.
- For a release-worthy application change, update the project version as required, create an annotated tag, and publish or update the corresponding GitHub release in the same work session. Keep documentation-only, formatting-only, and other non-deployable housekeeping changes as committed and pushed source changes without inventing an application release.
- Never force-push a shared branch or move an existing published tag unless the user explicitly authorizes that exact history rewrite.
- If automation or repository policy creates a pull request, review it, wait for required checks, merge it when safe, and remove the merged branch before wrapping up. Do not leave redundant pull requests or branches open.
- Treat commit, push, tag, and GitHub release publication as source delivery only. Do not claim or perform production deployment unless it was separately authorized and verified.
