"""Export dbt marts for the Next.js dashboard.

Facts are Parquet. product_metrics and the experiment result are also JSON.
Compiled model SQL is stored beside them. A slimmer snapshot is written to
web/src/data/dashboard.json for the app to import. Run `make dbt-build` first.
"""

from __future__ import annotations

import json
import os
from pathlib import Path

import duckdb

REPO_ROOT = Path(__file__).resolve().parents[1]
DUCKDB_PATH = Path(os.environ.get("LENDFLOW_DUCKDB", REPO_ROOT / "transform" / "target" / "lendflow.duckdb"))
EXPORT_ROOT = Path(os.environ.get("LENDFLOW_EXPORT_ROOT", REPO_ROOT / "data" / "marts"))
DASHBOARD_JSON = Path(
    os.environ.get("LENDFLOW_DASHBOARD_JSON", REPO_ROOT / "web" / "src" / "data" / "dashboard.json")
)
COMPILED_MARTS = REPO_ROOT / "transform" / "target" / "compiled" / "lendflow" / "models" / "marts"
SOURCE_MANIFEST = REPO_ROOT / "data" / "synthetic" / "manifest.json"

MART_TABLES = (
    "fct_applications",
    "fct_application_funnel",
    "fct_underwriting",
    "fct_funding",
    "fct_experiment_results",
    "product_metrics",
)

SQL_MODELS = (
    "product_metrics",
    "fct_experiment_results",
    "fct_application_funnel",
    "fct_applications",
    "fct_underwriting",
    "fct_funding",
)


def main() -> None:
    if not DUCKDB_PATH.exists():
        raise SystemExit(f"DuckDB file not found: {DUCKDB_PATH}. Run make dbt-build first.")

    EXPORT_ROOT.mkdir(parents=True, exist_ok=True)
    connection = duckdb.connect(str(DUCKDB_PATH), read_only=True)
    try:
        row_counts = {}
        for table in MART_TABLES:
            destination = (EXPORT_ROOT / f"{table}.parquet").as_posix()
            connection.execute(
                f"COPY (SELECT * FROM marts.{table}) TO '{destination}' (FORMAT PARQUET, COMPRESSION SNAPPY)"
            )
            row_counts[table] = connection.execute(f"SELECT count(*) FROM marts.{table}").fetchone()[0]

        product_metrics = _records(
            connection,
            "SELECT * FROM marts.product_metrics ORDER BY metric_name, stage_name, slice_name, slice_value",
        )
        experiment_results = _records(
            connection, "SELECT * FROM marts.fct_experiment_results ORDER BY metric_name"
        )
        stages = _records(
            connection,
            """
            select
                stage_order,
                stage_name,
                stage_kind,
                next_stage_name,
                failure_event_name
            from marts.fct_application_funnel
            group by 1, 2, 3, 4, 5
            order by stage_order
            """,
        )
    finally:
        connection.close()

    source_manifest = json.loads(SOURCE_MANIFEST.read_text()) if SOURCE_MANIFEST.exists() else None
    document = {
        "export_version": 1,
        "engine": "duckdb",
        "primary_metric": "bank_connection_completion_rate",
        "primary_population": "applications with bank_connection_started",
        "sla_attainment": "unshipped",
        "product_decision": None,
        "source_manifest": source_manifest,
        "row_counts": row_counts,
        "stages": stages,
        "product_metrics": product_metrics,
        "experiment_results": experiment_results,
        "sql": {name: _compiled_sql(name) for name in SQL_MODELS},
    }
    (EXPORT_ROOT / "metrics.json").write_text(json.dumps(document, indent=2, default=_json_default) + "\n")
    _write_dashboard_snapshot(document, source_manifest)
    print(f"wrote {EXPORT_ROOT}")
    print(f"wrote {DASHBOARD_JSON}")
    for table, count in row_counts.items():
        print(f"{table}={count}")


def _write_dashboard_snapshot(document: dict, source_manifest: dict | None) -> None:
    """App import. Parquet and the full metrics.json stay under data/marts/."""
    source = None
    if source_manifest:
        source = {
            "generator_version": source_manifest.get("generator_version"),
            "seed": source_manifest.get("seed"),
            "n_applications": source_manifest.get("n_applications"),
            "window_start": source_manifest.get("window_start"),
            "window_end_exclusive": source_manifest.get("window_end_exclusive"),
            "experiment_name": source_manifest.get("experiment_name"),
        }
    snapshot = {
        "export_version": document["export_version"],
        "engine": document["engine"],
        "primary_metric": document["primary_metric"],
        "primary_population": document["primary_population"],
        "sla_attainment": document["sla_attainment"],
        "product_decision": document["product_decision"],
        "source": source,
        "row_counts": document["row_counts"],
        "stages": document["stages"],
        "product_metrics": document["product_metrics"],
        "experiment_results": document["experiment_results"],
        "experiment_sql": document["sql"]["fct_experiment_results"],
    }
    DASHBOARD_JSON.parent.mkdir(parents=True, exist_ok=True)
    DASHBOARD_JSON.write_text(json.dumps(snapshot, separators=(",", ":"), default=_json_default) + "\n")


def _records(connection: duckdb.DuckDBPyConnection, query: str) -> list[dict]:
    frame = connection.execute(query).fetchdf()
    return json.loads(frame.to_json(orient="records", date_format="iso"))


def _compiled_sql(model_name: str) -> str:
    path = COMPILED_MARTS / f"{model_name}.sql"
    if not path.exists():
        raise SystemExit(f"Compiled SQL not found: {path}. Run make dbt-build first.")
    return path.read_text()


def _json_default(value: object) -> str:
    return str(value)


if __name__ == "__main__":
    main()
