# Security and resource audit, 2026-09-22

## Disposition

Civ Pro is a static browser application. Its deployable artifact is the explicit 22-file `dist/client` allowlist, served directly by a static host. It has no resident Node process, account system, cookies, analytics, database, server-side session, role promotion or demotion, background worker, queue, or production container. Adding a synthetic health API or application server would increase memory and attack surface without improving this site.

The repository was clean and synchronized with `origin/main` at `faf6b61395644c0463be5fc5ac0227f9dac607bb` before this review. Validation used Node 24.18.1 and npm 12.0.2 rather than the ambient Node 26 shell.

## Reviewed boundaries

- Public deployment copies only the paths in `scripts/public-artifact-contract.js`. The verifier rejects extra files, hidden paths, symlinks, private directory names, likely secrets, local absolute paths, unapproved file types, and unapproved external hosts.
- Browser imports are capped at 2 MB and validate schema, application/content/source versions, known cards and cases, identifier grammar, history limits, and markup before state restoration. Imported timers remain paused.
- Browser persistence is local-only. Balance history retains at most 200 sanitized rounds and removes learner writing, seeds, and timestamps. The user-facing cleanup path removes the application's saves, drafts, and statistics.
- All dynamic HTML built from replay, learner, source, or catalog state passes through centralized escaping or the HTTP(S)-only URL helper. The static CSP forbids inline scripts, framing, forms to other origins, plugins, and cross-origin connections.
- PACER remains an explicit, operator-only, disabled-by-default import path. It requires reviewed exact-case allowlisting, runtime credentials, an execution flag, and an additional production flag. It is absent from the public artifact and ordinary source-refresh commands.
- GitHub Actions use immutable action commit pins, read-only repository permissions, disabled checkout credentials, an exact toolchain check, locked installation, dependency audits, Chromium installation, and a finite job timeout. `actionlint` passed. The guarded `codex-zizmor` and `codex-osv-scan` wrappers were unavailable in this environment, so they are not represented as passing checks.

## Confirmed fixes

Two related operator-workflow defects were confirmed and fixed:

1. Legal-source probes, provider-candidate ingestion, and PACER requests previously had no deadline or response-size ceiling and parsed entire provider responses. A stalled or oversized upstream could retain an operator process or consume unbounded memory. One shared helper now applies abort deadlines, byte ceilings, redirect rejection, and sanitized transport errors to every network path.
2. PACER cache files and provider-candidate output previously inherited ambient umask and used direct writes. Private material could therefore become group/world readable or be left partially written. One shared writer now rejects a symlinked output directory, forces directories to `0700` and files to `0600`, fsyncs a unique temporary file, and atomically renames it into place.

Regression coverage proves normal JSON remains accepted, declared and streamed oversized responses fail, non-settling requests abort, credential-bearing error text is removed, redirects are rejected, ordinary provider and PACER workflows still work, private modes are enforced, temporary files are removed, and symlinked output directories fail closed.

## Resource conclusion

The production website already has the minimum practical resident memory footprint: no application process. Its finite browser state is bounded by import size, event/history limits, and the 200-round statistics cap. The newly bounded operator tools do not change production topology but prevent local network ingestion from retaining a process or buffering an arbitrarily large response.

## Validation boundary

The pinned clean install reported zero known vulnerabilities. Syntax, source, artifact, rendered-browser, accessibility, and keyboard-flow checks passed. The build produced and independently verified exactly 22 approved files. The only blocked install script was optional macOS `fsevents`, which is not part of the static production artifact and was not approved.

A requested Daybreak Deep Security scan did not enter discovery because the Codex host did not provide the required managed read-only filesystem permission profile. That infrastructure refusal is not a clean scan result. This source review and its tests are authoritative for the boundaries described here, while a Daybreak disposition remains pending until that host capability is available.

No DNS, Nginx, production service, credential, live PACER request, database, or deployment was changed.
