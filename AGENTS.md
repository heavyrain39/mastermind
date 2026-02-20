# AGENTS.md

## Document Encoding Safety Rules

- Do not run bulk re-encoding commands for docs (for example, `Get-Content | Set-Content` rewrite patterns).
- Do not change file encoding unless the user explicitly requests encoding conversion.
- Prefer `apply_patch` for documentation edits so existing file encoding is preserved.
- If text looks garbled in terminal output, treat it as a console/codepage display issue first, not a file corruption issue.
- Before attempting any encoding fix, stop and ask the user for confirmation.
- Keep versioned docs side-by-side (for example, `v0.1`, `v0.2`) and never delete older version docs during version bumps.

