# Production run records

Two files per production migration run, `<YYYY-MM-DD>-before.txt` and
`<YYYY-MM-DD>-after.txt`, each the output of `db:state` against production.

They exist because the third condition of the deployment decision of 2026-09-08
is that a production run is recorded in the repository rather than in a terminal
scrollback or a stray `.log`. The command that produces them, and why it carries
`NO_COLOR=1` and `--silent`, is in `../db-migration-procedure.md` section 5.6.

The directory is empty until the first run. Its emptiness is itself a reading:
no chain migration has been applied to production through the runner.
