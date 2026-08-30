# Codex Guidance

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
