# dbt tooling trial

Trial of four quality tools against the local dbt-duckdb project in `transform/`. Evidence was collected on 2026-09-21 from this repository, at dbt Core 1.12.5 and dbt-duckdb 1.11.0. No model SQL or YAML was rewritten for the trial.

Column descriptions, the column-description hook, the git-hook install, and CI landed later in [dbt-quality.md](dbt-quality.md). The counts in this note are the trial baseline. Osmosis stays on hold. That evidence has not changed.

`packages.yml` was not added. None of the four tools is a dbt Hub package.

## Recommendation

| tool | purpose | install | run | result_on_this_repo | recommendation | rationale |
| --- | --- | --- | --- | --- | --- | --- |
| Agent skills `dbt-reviewer` / `dbt-model-reviewer` | Review grain, joins, tests, docs, materialization, and model logic | No repo install. `independent-reviewer` loads skill id `dbt-model-review` | Read the skill, then review the diff under `transform/models/` and `transform/tests/` | Checklist applied to all 15 models. Keys, joins, and singular tests hold. 18 of 58 declared columns have descriptions. Composite grains are singular tests. | trial | The literal ids are not in dbt-labs/dbt-agent-skills (`a8607fc02a67`, 2026-09-11). The checklist that matches the brief is `dbt-model-review`. It does not execute dbt. |
| dbt-doctor 0.3.4 | Static scan for docs, tests, naming, and SQL style | `npx --yes dbt-doctor@0.3.4`. Node 22. | `make dbt-doctor` | Default preset, lint on, manifest loaded: 4 errors, 8 warnings, score 80. Strict preset: 511 findings, score 31. | trial | The default report is short enough to read. Two of the four errors are a shared-source heuristic. The scan is advisory. |
| dbt-checkpoint v2.0.10 | pre-commit hooks for descriptions, properties files, `ref`/`source`, semicolons, and at least one test | `pre-commit==4.6.2` via `make install`. Hook repo pinned in `.pre-commit-config.yaml`. | `make dbt-checkpoint` | Six hooks passed on every model file. Blanking `stg_experiments` description failed the description hook after `dbt parse`. | trial | The passing hooks match rules this project already keeps. Column-completeness hooks would force a YAML rewrite, so they are not enabled in the trial. The quality follow-up enables `check-model-columns-have-desc` only. |
| dbt-osmosis 1.5.0 | YAML layout, column-doc inheritance, doc coverage | Installed only in a throwaway venv with `dbt-duckdb==1.11.0`. Not added to `requirements.txt`. | `dbt-osmosis analyze docs` and `dbt-osmosis yaml document --dry-run` | `analyze docs` reported 0/58 columns documented. dbt's own manifest has descriptions on 18 of those 58. `describe read_parquet(...)` failed for every synthetic source. | hold | The coverage number is wrong on dbt Core 1.12.5, and source introspection does not understand this project's Parquet sources. Applying the YAML rewrite would be a large refactor on a bad reading. |

## How the reviewer loads skills

`independent-reviewer` loads one skill when the diff touches `transform/models/` or `transform/tests/`:

| When | Skill id | Source read for this trial |
| --- | --- | --- |
| Review of model SQL, schema YAML, or singular tests | `dbt-model-review` | [ds-ai-skills-starter-pack `skills/dbt-model-review/SKILL.md`](https://github.com/dennis-liu-glean/ds-ai-skills-starter-pack/blob/eb71c0912ee9/skills/dbt-model-review/SKILL.md) (commit `eb71c0912ee9`, 2026-05-21) |

The skill is a checklist: SQL grain and joins, `ref()` / `source()`, naming, tests, documentation, downstream risk. It does not run `dbt build`. The reviewer still uses the build output as the runtime evidence.

Do not load skill ids `dbt-reviewer` or `dbt-model-reviewer`. `dbt-labs/dbt-agent-skills` at `a8607fc02a67` publishes `using-dbt-for-analytics-engineering`, `adding-dbt-unit-test`, `maintaining-dbt-documentation`, and the semantic-layer and platform skills. It does not publish those two ids. A page titled `dbt-model-reviewer` on getskillsai.org did not return a readable, pinned `SKILL.md` during this trial.

`using-dbt-for-analytics-engineering` stays a builder skill for writing models. Its references for tests and documentation match the tests already in this project. Its cost notes assume a cloud warehouse and deferral. This repo stays on local DuckDB. The reviewer does not follow that branch.

dbt-doctor also ships a skill id, `dbt-doctor`. Its sample command omits `--offline`. That skill is not loaded. The Makefile target is the supported way to run the scanner.

### What the checklist found here

Grain is stated on the staging and intermediate models, and in [docs/dbt.md](dbt.md) for the funnel and metric tables.

- One row per application, with `unique` and `not_null` on `application_id`: `stg_applications`, `int_application_funnel`, `int_application_durations`, `int_experiment_assignments`, `fct_applications`, `fct_underwriting`, `fct_funding`.
- `fct_application_funnel` is one row per application and stage. `product_metrics` is one row per `metric_name`, `stage_name`, `slice_name`, `slice_value`. Both grains are enforced by `assert_composite_unique_keys`. A single-column `unique` test would be the wrong grain.
- `int_application_funnel` groups events by `application_id` and left-joins that pivot, so the join does not multiply applications.
- `fct_applications` inner-joins applicants, durations, and assignments (one row per application) and left-joins decisions and funding.

Every model has a description. Of the 58 columns declared in YAML, 18 have a description. Mart columns that a reader filters on, including `device_browser` and `started_week`, are still undescribed at the time of this trial. Filling those descriptions is a later docs pass. This trial does not do it. That pass is [dbt-quality.md](dbt-quality.md).

Materialization is already set in `transform/dbt_project.yml`: views for staging and intermediate, tables for marts. There is no incremental model. That fits a local build of 100,000 applications.

`select *` appears inside CTEs in `int_application_funnel` and `fct_experiment_results`, and the same CTE pattern appears in `fct_applications`. The outer selects name their columns. The checklist treats that as a review note. It is not a change in this trial.

## dbt-doctor

Primary docs: [northgraindata/dbt-doctor](https://github.com/northgraindata/dbt-doctor) (main `be424bd145a6`, 2026-07-14). CLI used: npm `dbt-doctor@0.3.4`. License is the package's own OSS license. No dbt Cloud, and the score API was not called.

The project lives in `transform/`, so the scan directory is `transform`. `--manifest` is joined onto that directory. An absolute manifest path becomes `transform/<absolute path>` and the graph rules are skipped, while the warning still prints the path you passed. Pass `target/manifest.json`.

```bash
make dbt-doctor
```

That target parses the project, then runs:

```bash
npx --yes dbt-doctor@0.3.4 transform \
  --offline --full --preset default --lint \
  --fail-on none \
  --manifest target/manifest.json
```

`--offline` skips the score API at `dbt-doctor.northgraindata.com`. `--fail-on none` keeps the target green. The findings are still printed.

Default preset with lint and the manifest, on this repo:

| severity | rule | where |
| --- | --- | --- |
| error | `no-select-star` | `int_application_funnel.sql:2`, `fct_experiment_results.sql:199` |
| error | `rejoining-upstream-concepts` | `fct_applications`, `product_metrics` |
| warning | `staging-naming-convention` | all six `stg_*` models |
| warning | `marts-prefix` | `product_metrics` |
| warning | `source-has-loader` | source `synthetic` |

Score 80, label Great. 4 errors, 8 warnings.

`rejoining-upstream-concepts` fires when two parent models share a source ancestor. Every model here descends from `synthetic`, so a mart that joins two upstream models is flagged. That is the shape of `fct_applications` and `product_metrics`, and the models are already tested. Staging names are `stg_<entity>` on purpose. `product_metrics` is the metric table, so it does not take an `fct_` or `dim_` prefix. Source `synthetic` is local Parquet, so a loader name adds nothing.

The strict preset reported 511 findings and score 31. The errors are per-model schema files, example SQL, enforced contracts, macro docs, materialization hints, and `select *`. The warnings are mostly SQL style (`sql-references-qualified` alone is 192). Turning that preset on would be a rewrite. It is not wired.

Without `--lint`, the same project scores 100 and prints no issues. That run does not see the manifest rules. Use the Makefile target.

## dbt-checkpoint

Primary docs: [dbt-checkpoint README](https://github.com/dbt-checkpoint/dbt-checkpoint/blob/v2.0.10/README.md) and [HOOKS.md](https://github.com/dbt-checkpoint/dbt-checkpoint/blob/v2.0.10/HOOKS.md). Pin: `v2.0.10` (`2537c7bd9d64`, 2026-06-18). pre-commit 4.6.2.

Hooks send Mixpanel events unless the checkpoint config sets `disable-tracking: true`. [transform/.dbt-checkpoint.yaml](../transform/.dbt-checkpoint.yaml) sets that and `dbt-project-dir: transform`, so the hooks read `transform/target/manifest.json` from the repository root. Each hook passes `--config transform/.dbt-checkpoint.yaml`. Both settings are required: the dbt project is not at the repository root, and the trial stays offline.

```bash
make install
make dbt-checkpoint
```

`make dbt-checkpoint` runs `dbt parse`, then `pre-commit run --all-files`. Parse is required because the hooks trust the manifest. A YAML edit that is not parsed yet still looks valid.

Enabled hooks, all of which passed on 2026-09-21:

| hook | bar |
| --- | --- |
| `check-model-has-description` | every model has a description |
| `check-model-has-properties-file` | every model has a properties file |
| `check-script-semicolon` | model and macro SQL has no semicolon |
| `check-script-has-no-table-name` | models use `ref()` or `source()` |
| `check-model-has-tests` | `--test-cnt 1` |
| `check-source-table-has-description` | each synthetic table has a description |

`check-model-has-tests` counts manifest children of type test, including singular tests. Every model has at least two. After `dbt parse`, clearing the `stg_experiments` description failed `check-model-has-description` on `transform/models/staging/stg_experiments.sql`. The description was restored and the project was parsed again.

Hooks that were run in the trial and then left out:

- `check-model-columns-have-desc` and `check-model-has-all-columns` fail while 40 of 58 declared columns have no description, and while warehouse columns are absent from YAML. That is a docs project, not a hook flip in this trial. The quality follow-up enables `check-model-columns-have-desc` after those 40 descriptions are filled. `check-model-has-all-columns` stays off. It needs `catalog.json`, and the properties files still do not list every DuckDB column.
- `check-source-has-freshness` and `check-source-has-loader` do not fit static Parquet.
- `check-model-has-contract` would turn on contracts that this project does not use.

`pre-commit install` is optional in this trial. The git hook is not installed by `make install`, because a clean clone has no manifest until parse or build. The later install path is `make pre-commit-install` in [dbt-quality.md](dbt-quality.md). The committed config parses before the checkpoint hooks so the git hook can run after that manifest exists.

## dbt-osmosis

Primary docs: [dbt-osmosis CLI](https://z3z1ma.github.io/dbt-osmosis/docs/reference/cli) and the PyPI page for 1.5.0. Upstream main at the time of the trial was `3cc00a57fa48` (2026-07-05). The published support note audits dbt Core 1.8 through 1.11. This project is on 1.12.5. The package still installed beside `dbt-duckdb==1.11.0` and the CLI started.

`dbt-osmosis analyze docs --project-dir transform --profiles-dir transform` exited 1:

```text
Models described: 15/15
Columns documented: 0/58 (0.0%)
Gaps: 131
```

The 58 matches the columns declared in YAML. dbt's manifest, parsed by dbt Core 1.12.5, has a non-empty description on 18 of them. `dbt_core_interface` `DocumentationChecker` only reads a description when the column object is a `dict`:

```python
col_desc = col_info.get("description", "") if isinstance(col_info, dict) else ""
```

On this dbt version the column objects are not dicts, so every description is dropped and coverage is reported as zero. The 131 gaps also count a missing `meta` block on each model and column. This project does not use owner metadata.

`dbt-osmosis yaml document --dry-run` built a context and would have rewritten `sources.yml`, `_stg.yml`, `_int.yml`, and `_marts.yml`. Introspection of the sources failed first:

```text
Parser Error: syntax error at or near "("
from (describe read_parquet('.../experiments.parquet'))
```

The sources use `meta.external_location` with `read_parquet`. Osmosis tried to `describe` that call and discovered no source columns. Inheritance from sources cannot run on this layout. The dry run was not applied.

Workbench, `generate`, and `--synthesize` need Streamlit or an LLM key. They were not run.

## Commands

From the repository root:

```bash
make install
make dbt-build
make dbt-checkpoint
make dbt-doctor
```

`make dbt-build` is the gate. The other two targets are the trial. They do not change model SQL.
