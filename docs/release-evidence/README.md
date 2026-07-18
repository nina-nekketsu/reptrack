# Release Evidence

Use this directory for release-specific evidence that was actually generated for a frozen SHA.

Recommended layout:

```text
docs/release-evidence/<40-char-sha>/
  commands/
  browser-matrix/
  pwa-update/
  diagnostics/
  two-device/
  production-readonly/
  rollback/
```

Rules:

- Do not create pass records for checks that were not run.
- Do not store secrets, tokens, credentials, raw workout payloads, email addresses, or production data dumps.
- Redact account identifiers to stable aliases before committing evidence.
- Keep production mutation, schema application, deploy, push, and rollback evidence out of this folder until Lloyd has approved the exact action.
- Record command, timestamp, SHA, environment, and pass/fail result for each automated artifact.

Current repository state: this folder documents the evidence format only. It does not claim real-device, authenticated, production, deployment, or rollback passes.
