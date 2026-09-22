# dbt quality

How to keep column descriptions and the checkpoint hooks green on the local DuckDB project. The trial that chose the tools is [dbt-tooling-trial.md](dbt-tooling-trial.md). This page is the follow-up: the 40 empty descriptions, a git hook that can run after parse, and CI.

Osmosis stays on hold. The trial evidence has not changed.

## Column descriptions

The properties files declare 58 model columns. At the trial, 18 had a description and 40 did not. Those 40 now have a description. `check-model-columns-have-desc` fails the commit if a declared column loses its description.

The hook checks columns that are already in the properties file or in the manifest. It does not require every DuckDB column to be listed. `check-model-has-all-columns` stays off for that reason. It also needs `transform/target/catalog.json` from `dbt docs generate`. After `dbt build` on 2026-09-21 the fifteen models expose 270 DuckDB columns. 58 are declared in YAML. The other 212 stay undeclared. The properties files keep the keys, the tested columns, and the columns a reader filters on. Copying the other 212 into YAML would be a catalog rewrite, and this pass does not do it.

Source tables in `transform/models/sources.yml` have a table description and no column list. The six Parquet files have 47 columns. Column meaning for those files stays in [data-generation.md](data-generation.md) and the [analytical spec](../specs/analytical-spec.md). Staging models cast the columns downstream models use. `check-source-columns-have-desc` stays off with that source-column list.

## Install the git hook

From the repository root:

```bash
make install
make pre-commit-install
```

`make install` creates `.venv` and installs `requirements.txt`, including `pre-commit==4.6.2`. `make pre-commit-install` runs `dbt parse`, then `pre-commit install`, which writes `.git/hooks/pre-commit`.

pre-commit refuses that install when `core.hooksPath` is set, because Git would not run `.git/hooks`. The Makefile stops with the same reason and points at `make dbt-checkpoint`. CI uses that command. It does not install a git hook.

`transform/target/manifest.json` stays gitignored. A clean clone has no manifest until parse or build. The first hook in `.pre-commit-config.yaml` is a local `dbt parse` (`make dbt-parse`). It runs when a commit touches `transform/models/` or `transform/macros/`, and it runs before the dbt-checkpoint hooks. Those hooks then read the manifest this commit just parsed.

`transform/.dbt-checkpoint.yaml` sets `disable-tracking: true` and `dbt-project-dir: transform`. The hooks stay offline, and they find the manifest from the repository root.

Run the same checks without committing:

```bash
make dbt-checkpoint
```

That target parses, then runs `pre-commit run --all-files`. The local parse hook runs again inside that command. A second parse is the check that the git hook path still works.

After a YAML edit, the parse step is what makes `check-model-columns-have-desc` see the new text. The hook's own docs note that a description left behind in an old manifest can hide a deletion. Parsing first removes that gap for commits that touch the model tree.

## Hooks

| hook | bar |
| --- | --- |
| `dbt-parse` | local hook. `make dbt-parse` before the checkpoint hooks |
| `check-model-has-description` | every model has a description |
| `check-model-columns-have-desc` | every declared column has a description |
| `check-model-has-properties-file` | every model has a properties file |
| `check-script-semicolon` | model and macro SQL has no semicolon |
| `check-script-has-no-table-name` | models use `ref()` or `source()` |
| `check-model-has-tests` | `--test-cnt 1` |
| `check-source-table-has-description` | each synthetic table has a description |

Still off, with a reason:

| hook | reason |
| --- | --- |
| `check-model-has-all-columns` | Needs `catalog.json`. Properties files do not list every DuckDB column. |
| `check-source-columns-have-desc` | Source columns stay in the generator doc and the analytical spec. |
| `check-source-has-freshness` | Static Parquet has no loader freshness. |
| `check-source-has-loader` | The source is local Parquet, not a loader. |
| `check-model-has-contract` | This project does not enforce model contracts. |

## CI

`.github/workflows/dbt.yml` runs on pull requests and on pushes to `main`:

```text
make install
make dbt-parse
make dbt-build
make dbt-checkpoint
```

The runner is GitHub-hosted Ubuntu. The database is the local DuckDB file `transform/target/lendflow.duckdb`. The profile has no credentials. `dbt build` is the test gate. The checkpoint step is the description and properties gate.

`make dbt-doctor` is not in CI. The default preset is advisory (`--fail-on none`). Two of its errors are the shared-source heuristic described in the trial note. Run it locally when you want the scan.

## packages.yml

This repository has no `packages.yml`. No dbt Hub package is required for the descriptions, the hooks, or CI.

dbt-checkpoint is the pre-commit repository pinned at `v2.0.10` in `.pre-commit-config.yaml`. dbt-doctor is the npm CLI `dbt-doctor@0.3.4`, invoked by `make dbt-doctor`. Neither is a Hub package.

## Osmosis

dbt-osmosis stays on hold. It is not in `requirements.txt`.

The trial, on dbt Core 1.12.5, saw `analyze docs` report 0 of 58 columns documented while the manifest had descriptions on 18. Source introspection failed on `meta.external_location` `read_parquet` calls. Filling the 40 descriptions by hand does not fix that reading, and it does not make a YAML rewrite safe. Do not run `dbt-osmosis yaml document` against this project.

## Commands

```bash
make install
make dbt-build
make dbt-checkpoint
make pre-commit-install
make dbt-doctor
```

`make dbt-build` remains the gate for models and tests.
