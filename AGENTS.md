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
| `task_id` | `TASK-LENDFLOW-DATA-GEN` |
| `graph_id` | `feature` |
| Contract | [docs/tasks/TASK-LENDFLOW-DATA-GEN.yaml](docs/tasks/TASK-LENDFLOW-DATA-GEN.yaml) |
| `data_project` | `true` |
| `architecture.impacted` | `false` |

`data_project: true` still means EDA runs before UI copy. This contract is the generator and the sanity checks. It does not add a dashboard, Ask LendFlow, or dbt marts.

Allowed paths:

```text
data/
scripts/
notebooks/
docs/
specs/
README.md
AGENTS.md
pyproject.toml
requirements.txt
Makefile
.gitignore
```

Product docs and code comments are English. No secrets, no `.env`, no real applicant data.

Barrilito and vaca-muerta-pulse are out of this repository.
