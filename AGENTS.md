# AGENTS.md

Harness v1 for `nrohland/lendflow-fintech-analytics`.

## Roles

Write role ids. Do not write bot display names in this repository.

| Role id | What that role may do |
| --- | --- |
| `owner` | `nrohland`. Freezes the brief, grants GO, merges. |
| `orchestrator` | Routes one task contract to one role. Does not widen `allowed_paths`. |
| `project-architect` | Proposes stack options and an ADR when `architecture.impacted` is true. Does not self-approve. |
| `builder` | Implements the active contract inside `allowed_paths`. Opens a draft pull request. |
| `independent-reviewer` | Reviews the draft. Does not approve their own work. |

## Flow

1. Grill-me at kickoff, before build. For `TASK-LENDFLOW-DESIGN` that step is done. The brief was frozen on 2026-09-21.
2. The orchestrator assigns the contract to one role.
3. One task contract produces one draft pull request.
4. Agents stop at the draft. They do not merge.
5. Merge is `owner` only.

`architecture.impacted: true` required an owner GO before this design package. That GO is recorded in [docs/architecture.md](docs/architecture.md). The merge lock is unchanged.

## Active contract

| Field | Value |
| --- | --- |
| `task_id` | `TASK-LENDFLOW-DBT-QUALITY-GAPS` |
| `graph_id` | `feature` |
| Contract | [docs/tasks/TASK-LENDFLOW-DBT-QUALITY-GAPS.yaml](docs/tasks/TASK-LENDFLOW-DBT-QUALITY-GAPS.yaml) |
| `data_project` | `true` |
| `architecture.impacted` | `false` |

`data_project: true` still means EDA runs before UI copy. This contract fills the missing column descriptions and wires CI plus a usable pre-commit install. It does not add a dashboard, Ask LendFlow, or new marts. Osmosis stays on hold.

Allowed paths:

```text
transform/
.github/workflows/
.pre-commit-config.yaml
packages.yml
docs/
scripts/
Makefile
README.md
AGENTS.md
requirements.txt
pyproject.toml
.gitignore
```

## Reviewer skills for dbt changes

When a diff touches `transform/models/` or `transform/tests/`, `independent-reviewer` loads skill id `dbt-model-review` before commenting. The skill is the checklist in `dennis-liu-glean/ds-ai-skills-starter-pack` at `skills/dbt-model-review/SKILL.md` (commit `eb71c0912ee9`). It covers grain, joins, tests, docs, materialization, and model logic. It does not run dbt. Runtime evidence stays `make dbt-build`.

Skill ids `dbt-reviewer` and `dbt-model-reviewer` are not loaded. They are not published by `dbt-labs/dbt-agent-skills` at `a8607fc02a67`.

`using-dbt-for-analytics-engineering` is a builder skill. On this repo the builder stays on local dbt Core and DuckDB.

The trial evidence and the `make dbt-checkpoint` / `make dbt-doctor` commands are in [docs/dbt-tooling-trial.md](docs/dbt-tooling-trial.md). Column descriptions, `make pre-commit-install`, and CI are in [docs/dbt-quality.md](docs/dbt-quality.md). There is no `packages.yml`. No Hub package is required.

Product docs and code comments are English. No secrets, no `.env`, no real applicant data.

Barrilito and vaca-muerta-pulse are out of this repository.
