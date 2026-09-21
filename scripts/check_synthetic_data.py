"""Sanity checks for the synthetic Parquet tables.

Structural checks enforce the analytical spec. Pattern checks enforce the generator
contract: the six seeded processes are present at the published magnitudes.
The 24-hour decision cut is a check threshold, not a product SLA. The spec leaves
both SLA limits unset.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import platform
import sys
from pathlib import Path

import duckdb
import pandas as pd
import pyarrow.parquet as pq

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

from lendflow_synth.parameters import (  # noqa: E402
    APPLICATION_COUNT_TOLERANCE,
    APPLICATION_STATUSES,
    BANK_ERROR_CODES,
    BROWSER_BY_DEVICE,
    CHANNEL_LABELS,
    COLUMNS,
    DECISION_PATHS,
    DECISIONS,
    DEVICE_LABELS,
    EVENT_NAMES,
    EVENT_STAGE_RANK,
    EXPERIMENT_NAME,
    FAILURE_EVENTS,
    FUNDING_STATUSES,
    GENERATOR_VERSION,
    IDENTITY_ERROR_CODES,
    IDENTITY_FRICTION_DEVICE,
    LATE_PERIOD_START,
    N_APPLICATIONS,
    RISK_BANDS,
    SEED,
    SINGLETON_EVENTS,
    TABLE_NAMES,
    VARIANTS,
    VOLUME_CHANNEL,
    WINDOW_END_EXCLUSIVE,
    WINDOW_START,
)

DEFAULT_DATA = ROOT / "data" / "synthetic"
LONG_DECISION_MINUTES = 24 * 60


def file_sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


class Report:
    def __init__(self) -> None:
        self.checks: list[dict] = []

    def add(self, check_id: str, ok: bool, **evidence) -> None:
        self.checks.append(
            {
                "id": check_id,
                "result": "pass" if ok else "fail",
                **evidence,
            }
        )

    @property
    def passed(self) -> bool:
        return all(item["result"] == "pass" for item in self.checks)


def _sql_quote(value: str) -> str:
    return "'" + value.replace("'", "''") + "'"


def _in_list(values: tuple[str, ...]) -> str:
    return ", ".join(_sql_quote(value) for value in values)


def connect(data_dir: Path) -> duckdb.DuckDBPyConnection:
    con = duckdb.connect()
    for name in TABLE_NAMES:
        path = (data_dir / f"{name}.parquet").as_posix()
        con.execute(f"CREATE VIEW {name} AS SELECT * FROM read_parquet('{path}')")
    rank_rows = " ".join(
        f"WHEN {_sql_quote(name)} THEN {rank}" for name, rank in EVENT_STAGE_RANK.items()
    )
    con.execute(
        f"""
        CREATE TEMP TABLE event_flags AS
        SELECT
          application_id,
          count(*) AS n_events,
          count(DISTINCT session_id) AS n_sessions,
          {", ".join(
              f"bool_or(event_name = {_sql_quote(name)}) AS {name}" for name in EVENT_NAMES
          )}
        FROM events
        GROUP BY 1
        """
    )
    con.execute(
        f"""
        CREATE TEMP TABLE event_order AS
        SELECT
          application_id,
          event_id,
          event_timestamp,
          event_name,
          CASE event_name {rank_rows} ELSE NULL END AS stage_rank,
          lag(event_timestamp) OVER (
            PARTITION BY application_id ORDER BY event_timestamp, event_id
          ) AS prev_ts,
          lag(CASE event_name {rank_rows} ELSE NULL END) OVER (
            PARTITION BY application_id ORDER BY event_timestamp, event_id
          ) AS prev_rank
        FROM events
        """
    )
    return con


def violation_count(con: duckdb.DuckDBPyConnection, sql: str) -> int:
    value = con.execute(sql).fetchone()[0]
    return int(value or 0)


def check_zero(report: Report, con: duckdb.DuckDBPyConnection, check_id: str, sql: str) -> None:
    count = violation_count(con, sql)
    report.add(check_id, count == 0, violations=count)


def check_columns(report: Report, data_dir: Path) -> None:
    mismatches = []
    for name in TABLE_NAMES:
        schema = pq.read_schema(data_dir / f"{name}.parquet")
        if tuple(schema.names) != COLUMNS[name]:
            mismatches.append({"table": name, "columns": list(schema.names)})
    report.add("schema.columns", not mismatches, mismatches=mismatches)


def check_manifest(report: Report, con: duckdb.DuckDBPyConnection, data_dir: Path) -> dict:
    path = data_dir / "manifest.json"
    manifest = json.loads(path.read_text(encoding="utf-8"))
    counts = {
        name: violation_count(con, f"SELECT count(*) FROM {name}")
        for name in TABLE_NAMES
    }
    low, high = APPLICATION_COUNT_TOLERANCE
    ok = (
        manifest.get("seed") == SEED
        and manifest.get("generator_version") == GENERATOR_VERSION
        and manifest.get("n_applications") == N_APPLICATIONS
        and manifest.get("experiment_name") == EXPERIMENT_NAME
        and manifest.get("row_counts") == counts
        and low <= counts["applications"] <= high
        and counts["applications"] == N_APPLICATIONS
        and counts["experiments"] == counts["applications"]
        and counts["applicants"] == manifest.get("n_applicants")
    )
    report.add(
        "manifest.matches_tables",
        ok,
        applications=counts["applications"],
        row_counts=counts,
        seed=manifest.get("seed"),
        tolerance={"low": low, "high": high},
    )
    return manifest | {"observed_row_counts": counts}


def check_structure(report: Report, con: duckdb.DuckDBPyConnection) -> None:
    for name, column in (
        ("applicants", "applicant_id"),
        ("applications", "application_id"),
        ("events", "event_id"),
        ("underwriting_decisions", "application_id"),
        ("funding_events", "application_id"),
    ):
        check_zero(
            report,
            con,
            f"uniqueness.{name}",
            f"""
            SELECT count(*) FROM (
              SELECT {column} FROM {name}
              GROUP BY 1
              HAVING count(*) > 1
            )
            """,
        )
    check_zero(
        report,
        con,
        "uniqueness.experiment_assignment",
        """
        SELECT count(*) FROM (
          SELECT application_id, experiment_name
          FROM experiments
          GROUP BY 1, 2
          HAVING count(*) > 1
        )
        """,
    )
    check_zero(
        report,
        con,
        "fk.applications_applicant",
        """
        SELECT count(*)
        FROM applications a
        LEFT JOIN applicants p USING (applicant_id)
        WHERE p.applicant_id IS NULL
        """,
    )
    check_zero(
        report,
        con,
        "fk.applicants_have_applications",
        """
        SELECT count(*)
        FROM applicants p
        LEFT JOIN applications a USING (applicant_id)
        WHERE a.application_id IS NULL
        """,
    )
    check_zero(
        report,
        con,
        "fk.events_application",
        """
        SELECT count(*)
        FROM events e
        LEFT JOIN applications a USING (application_id)
        WHERE a.application_id IS NULL
        """,
    )
    check_zero(
        report,
        con,
        "fk.events_applicant_matches_application",
        """
        SELECT count(*)
        FROM events e
        JOIN applications a USING (application_id)
        WHERE e.applicant_id <> a.applicant_id
           OR e.device_type <> a.device_type
           OR e.browser <> a.browser
           OR e.acquisition_channel <> a.acquisition_channel
           OR e.experiment_variant <> a.experiment_variant
        """,
    )
    check_zero(
        report,
        con,
        "fk.decisions_application",
        """
        SELECT count(*)
        FROM underwriting_decisions d
        LEFT JOIN applications a USING (application_id)
        WHERE a.application_id IS NULL
        """,
    )
    check_zero(
        report,
        con,
        "fk.funding_application",
        """
        SELECT count(*)
        FROM funding_events f
        LEFT JOIN applications a USING (application_id)
        WHERE a.application_id IS NULL
        """,
    )
    check_zero(
        report,
        con,
        "fk.experiments_application",
        """
        SELECT count(*)
        FROM experiments e
        LEFT JOIN applications a USING (application_id)
        WHERE a.application_id IS NULL
        """,
    )
    check_zero(
        report,
        con,
        "lifecycle.every_application_has_events",
        """
        SELECT count(*)
        FROM applications a
        LEFT JOIN event_flags f USING (application_id)
        WHERE f.application_id IS NULL OR NOT f.application_started
        """,
    )
    singleton_list = _in_list(SINGLETON_EVENTS)
    check_zero(
        report,
        con,
        "uniqueness.singleton_events",
        f"""
        SELECT count(*) FROM (
          SELECT application_id, event_name
          FROM events
          WHERE event_name IN ({singleton_list})
          GROUP BY 1, 2
          HAVING count(*) > 1
        )
        """,
    )
    check_zero(
        report,
        con,
        "lifecycle.timestamps_strictly_increasing",
        """
        SELECT count(*) FROM event_order
        WHERE prev_ts IS NOT NULL AND event_timestamp <= prev_ts
        """,
    )
    check_zero(
        report,
        con,
        "lifecycle.event_stage_order",
        """
        SELECT count(*) FROM event_order
        WHERE stage_rank IS NULL
           OR (prev_rank IS NOT NULL AND stage_rank < prev_rank)
        """,
    )
    implications = (
        ("personal_info_completed", "application_started"),
        ("bank_connection_started", "personal_info_completed"),
        ("bank_connection_failed", "bank_connection_started"),
        ("bank_connected", "bank_connection_started"),
        ("identity_verification_started", "bank_connected"),
        ("identity_verification_failed", "identity_verification_started"),
        ("identity_verified", "identity_verification_started"),
        ("application_submitted", "identity_verified"),
        ("underwriting_started", "application_submitted"),
        ("manual_review_started", "underwriting_started"),
        ("decision_approved", "underwriting_started"),
        ("decision_referred", "underwriting_started"),
        ("decision_declined", "underwriting_started"),
        ("vehicle_selected", "decision_approved"),
        ("contract_started", "vehicle_selected"),
        ("contract_signed", "contract_started"),
        ("funding_started", "contract_signed"),
        ("loan_funded", "funding_started"),
    )
    implication_sql = " OR ".join(
        f"({later} AND NOT {earlier})" for later, earlier in implications
    )
    check_zero(
        report,
        con,
        "lifecycle.no_later_stage_without_earlier_stage",
        f"SELECT count(*) FROM event_flags WHERE {implication_sql}",
    )
    check_zero(
        report,
        con,
        "lifecycle.one_decision_event",
        """
        SELECT count(*) FROM event_flags
        WHERE (decision_approved::int + decision_referred::int + decision_declined::int) > 1
           OR (application_submitted AND (decision_approved::int + decision_referred::int + decision_declined::int) <> 1)
           OR ((decision_approved OR decision_referred OR decision_declined) AND NOT application_submitted)
        """,
    )
    check_zero(
        report,
        con,
        "lifecycle.canonical_clocks",
        """
        SELECT count(*)
        FROM applications a
        JOIN event_flags f USING (application_id)
        LEFT JOIN events started
          ON started.application_id = a.application_id
         AND started.event_name = 'application_started'
        LEFT JOIN events submitted
          ON submitted.application_id = a.application_id
         AND submitted.event_name = 'application_submitted'
        LEFT JOIN events contracted
          ON contracted.application_id = a.application_id
         AND contracted.event_name = 'contract_signed'
        LEFT JOIN events funded
          ON funded.application_id = a.application_id
         AND funded.event_name = 'loan_funded'
        WHERE started.event_timestamp IS DISTINCT FROM a.started_at
           OR (a.submitted_at IS NULL) IS DISTINCT FROM (NOT f.application_submitted)
           OR (a.submitted_at IS NOT NULL AND submitted.event_timestamp IS DISTINCT FROM a.submitted_at)
           OR (a.contracted_at IS NULL) IS DISTINCT FROM (NOT f.contract_signed)
           OR (a.contracted_at IS NOT NULL AND contracted.event_timestamp IS DISTINCT FROM a.contracted_at)
           OR (a.funded_at IS NULL) IS DISTINCT FROM (NOT f.loan_funded)
           OR (a.funded_at IS NOT NULL AND funded.event_timestamp IS DISTINCT FROM a.funded_at)
           OR (a.submitted_at IS NOT NULL AND a.submitted_at < a.started_at)
           OR (a.decision_at IS NOT NULL AND (a.submitted_at IS NULL OR a.decision_at < a.submitted_at))
           OR (a.contracted_at IS NOT NULL AND (a.decision_at IS NULL OR a.contracted_at < a.decision_at))
           OR (a.funded_at IS NOT NULL AND (a.contracted_at IS NULL OR a.funded_at < a.contracted_at))
        """,
    )
    check_zero(
        report,
        con,
        "lifecycle.no_contract_before_submission",
        """
        SELECT count(*) FROM applications
        WHERE contracted_at IS NOT NULL
          AND (submitted_at IS NULL OR contracted_at < submitted_at)
        """,
    )
    check_zero(
        report,
        con,
        "lifecycle.status_matches_events",
        """
        SELECT count(*)
        FROM applications a
        JOIN event_flags f USING (application_id)
        WHERE a.application_status IS DISTINCT FROM (
          CASE
            WHEN f.loan_funded THEN 'funded'
            WHEN f.contract_signed THEN 'contracted'
            WHEN f.vehicle_selected THEN 'vehicle_selected'
            WHEN f.decision_approved THEN 'approved'
            WHEN f.decision_referred THEN 'referred'
            WHEN f.decision_declined THEN 'declined'
            WHEN f.application_submitted THEN 'submitted'
            WHEN f.identity_verified THEN 'identity_verified'
            WHEN f.bank_connected THEN 'bank_connected'
            WHEN f.bank_connection_started THEN 'bank_connection_started'
            WHEN f.personal_info_completed THEN 'personal_info_completed'
            WHEN f.application_started THEN 'started'
            ELSE NULL
          END
        )
        """,
    )
    check_zero(
        report,
        con,
        "funding.only_after_approval",
        """
        SELECT count(*)
        FROM applications a
        LEFT JOIN underwriting_decisions d USING (application_id)
        LEFT JOIN event_flags f USING (application_id)
        WHERE (
            a.funded_at IS NOT NULL
            AND (
              d.decision IS DISTINCT FROM 'approved'
              OR a.decision_at IS NULL
              OR a.funded_at < a.decision_at
            )
          )
          OR (f.loan_funded AND (d.decision IS DISTINCT FROM 'approved' OR NOT f.decision_approved))
          OR (f.vehicle_selected AND d.decision IS DISTINCT FROM 'approved')
          OR (a.contracted_at IS NOT NULL AND d.decision IS DISTINCT FROM 'approved')
        """,
    )
    check_zero(
        report,
        con,
        "funding.row_iff_approved",
        """
        SELECT count(*)
        FROM underwriting_decisions d
        FULL OUTER JOIN funding_events f USING (application_id)
        WHERE (d.decision = 'approved' AND f.application_id IS NULL)
           OR (d.decision IS DISTINCT FROM 'approved' AND f.application_id IS NOT NULL)
           OR (d.application_id IS NULL AND f.application_id IS NOT NULL)
        """,
    )
    check_zero(
        report,
        con,
        "funding.duration_and_timestamp",
        """
        SELECT count(*)
        FROM funding_events f
        JOIN applications a USING (application_id)
        WHERE (
            f.funding_status = 'funded'
            AND (
              a.funded_at IS NULL
              OR f.funding_timestamp IS DISTINCT FROM a.funded_at
              OR f.funding_duration_hours IS NULL
              OR abs(
                f.funding_duration_hours
                - (epoch(a.funded_at) - epoch(a.contracted_at)) / 3600.0
              ) > 1e-6
            )
          )
          OR (
            f.funding_status = 'not_funded'
            AND (
              a.funded_at IS NOT NULL
              OR f.funding_timestamp IS NOT NULL
              OR f.funding_duration_hours IS NOT NULL
            )
          )
          OR f.funding_status NOT IN ('funded', 'not_funded')
        """,
    )
    check_zero(
        report,
        con,
        "decisions.match_application_clock",
        """
        SELECT count(*)
        FROM underwriting_decisions d
        JOIN applications a USING (application_id)
        JOIN event_flags f USING (application_id)
        WHERE d.decision_timestamp IS DISTINCT FROM a.decision_at
           OR a.underwriting_path IS DISTINCT FROM d.decision_path
           OR (d.manual_review_flag AND d.decision_path <> 'manual')
           OR (NOT d.manual_review_flag AND d.decision_path <> 'auto')
           OR (d.decision_path = 'manual') IS DISTINCT FROM f.manual_review_started
           OR (d.decision = 'approved' AND NOT f.decision_approved)
           OR (d.decision = 'referred' AND NOT f.decision_referred)
           OR (d.decision = 'declined' AND NOT f.decision_declined)
           OR a.submitted_at IS NULL
           OR abs(
             d.decision_duration_minutes
             - (epoch(d.decision_timestamp) - epoch(a.submitted_at)) / 60.0
           ) > 1e-6
        """,
    )
    check_zero(
        report,
        con,
        "decisions.closed_cohort",
        """
        SELECT count(*)
        FROM applications a
        LEFT JOIN underwriting_decisions d USING (application_id)
        WHERE (a.submitted_at IS NULL AND d.application_id IS NOT NULL)
           OR (a.submitted_at IS NOT NULL AND d.application_id IS NULL)
           OR (a.submitted_at IS NULL AND a.underwriting_path IS NOT NULL)
           OR (a.submitted_at IS NOT NULL AND a.underwriting_path IS NULL)
        """,
    )
    check_zero(
        report,
        con,
        "experiment.valid_assignment",
        f"""
        SELECT count(*)
        FROM applications a
        LEFT JOIN experiments e USING (application_id)
        WHERE e.application_id IS NULL
           OR e.experiment_name <> {_sql_quote(EXPERIMENT_NAME)}
           OR e.variant NOT IN ({_in_list(VARIANTS)})
           OR a.experiment_variant NOT IN ({_in_list(VARIANTS)})
           OR e.variant IS DISTINCT FROM a.experiment_variant
           OR e.assigned_at IS DISTINCT FROM a.started_at
        """,
    )
    check_zero(
        report,
        con,
        "experiment.no_extra_names",
        f"""
        SELECT count(*) FROM experiments
        WHERE experiment_name <> {_sql_quote(EXPERIMENT_NAME)}
        """,
    )
    status_list = _in_list(APPLICATION_STATUSES)
    event_list = _in_list(EVENT_NAMES)
    check_zero(
        report,
        con,
        "enums.status_and_events",
        f"""
        SELECT
          (SELECT count(*) FROM applications WHERE application_status NOT IN ({status_list}))
          + (SELECT count(*) FROM events WHERE event_name NOT IN ({event_list}))
          + (SELECT count(*) FROM underwriting_decisions WHERE decision NOT IN ({_in_list(DECISIONS)}))
          + (SELECT count(*) FROM underwriting_decisions WHERE decision_path NOT IN ({_in_list(DECISION_PATHS)}))
          + (SELECT count(*) FROM underwriting_decisions WHERE risk_band NOT IN ({_in_list(RISK_BANDS)}))
          + (SELECT count(*) FROM funding_events WHERE funding_status NOT IN ({_in_list(FUNDING_STATUSES)}))
          + (SELECT count(*) FROM applications WHERE acquisition_channel NOT IN ({_in_list(CHANNEL_LABELS)}))
          + (SELECT count(*) FROM applications WHERE device_type NOT IN ({_in_list(DEVICE_LABELS)}))
        """,
    )
    failure_list = _in_list(FAILURE_EVENTS)
    bank_codes = _in_list(BANK_ERROR_CODES)
    id_codes = _in_list(IDENTITY_ERROR_CODES)
    check_zero(
        report,
        con,
        "enums.error_codes",
        f"""
        SELECT count(*) FROM events
        WHERE (
            event_name = 'bank_connection_failed'
            AND (error_code IS NULL OR error_code NOT IN ({bank_codes}))
          )
          OR (
            event_name = 'identity_verification_failed'
            AND (error_code IS NULL OR error_code NOT IN ({id_codes}))
          )
          OR (
            event_name NOT IN ({failure_list})
            AND error_code IS NOT NULL
          )
        """,
    )
    pair_clauses = []
    for device, pairs in BROWSER_BY_DEVICE.items():
        browsers = _in_list(tuple(label for label, _ in pairs))
        pair_clauses.append(
            f"(device_type = {_sql_quote(device)} AND browser NOT IN ({browsers}))"
        )
    check_zero(
        report,
        con,
        "enums.device_browser_pairs",
        f"SELECT count(*) FROM applications WHERE {' OR '.join(pair_clauses)}",
    )
    check_zero(
        report,
        con,
        "lifecycle.started_inside_window",
        f"""
        SELECT count(*) FROM applications
        WHERE started_at < TIMESTAMPTZ {_sql_quote(WINDOW_START + "Z")}
           OR started_at >= TIMESTAMPTZ {_sql_quote(WINDOW_END_EXCLUSIVE + "Z")}
        """,
    )
    check_zero(
        report,
        con,
        "applicants.created_at_definition",
        """
        WITH firsts AS (
          SELECT applicant_id, min(started_at) AS first_started
          FROM applications
          GROUP BY 1
        )
        SELECT count(*)
        FROM applicants p
        JOIN firsts f USING (applicant_id)
        WHERE p.created_at > f.first_started
           OR (NOT p.returning_user AND p.created_at IS DISTINCT FROM f.first_started)
           OR (p.returning_user AND p.created_at > f.first_started - INTERVAL 30 DAY)
        """,
    )


def _rate(numerator: pd.Series, denominator: pd.Series) -> float:
    den = int(denominator.sum())
    if den == 0:
        raise RuntimeError("pattern denominator was empty")
    return float(numerator.sum()) / den


def _median(values: pd.Series) -> float:
    clean = values.dropna()
    if clean.empty:
        raise RuntimeError("median of an empty series")
    return float(clean.median())


def load_features(con: duckdb.DuckDBPyConnection) -> pd.DataFrame:
    frame = con.execute(
        f"""
        SELECT
          a.application_id,
          a.started_at,
          a.submitted_at,
          a.decision_at,
          a.funded_at,
          a.acquisition_channel,
          a.device_type,
          a.browser,
          a.experiment_variant,
          a.started_at >= TIMESTAMPTZ {_sql_quote(LATE_PERIOD_START + "Z")} AS late,
          d.decision,
          d.manual_review_flag,
          d.decision_duration_minutes,
          f.bank_connection_started AS bank_started,
          f.bank_connected,
          f.bank_connection_failed AS bank_failed,
          f.identity_verification_started AS id_started,
          f.identity_verified AS id_verified,
          f.identity_verification_failed AS id_failed,
          f.application_submitted AS submitted,
          f.loan_funded AS funded
        FROM applications a
        LEFT JOIN underwriting_decisions d USING (application_id)
        LEFT JOIN event_flags f USING (application_id)
        """
    ).fetchdf()
    identity = con.execute(
        """
        SELECT
          s.application_id,
          (epoch(v.event_timestamp) - epoch(s.event_timestamp)) / 60.0 AS identity_minutes
        FROM events s
        JOIN events v
          ON v.application_id = s.application_id
         AND v.event_name = 'identity_verified'
        WHERE s.event_name = 'identity_verification_started'
        """
    ).fetchdf()
    return frame.merge(identity, on="application_id", how="left")


def check_patterns(report: Report, features: pd.DataFrame) -> dict[str, float]:
    metrics: dict[str, float] = {}

    def remember(name: str, value: float) -> float:
        metrics[name] = value
        return value

    for column in (
        "bank_started",
        "bank_connected",
        "bank_failed",
        "id_started",
        "id_verified",
        "id_failed",
        "submitted",
        "funded",
        "late",
        "manual_review_flag",
    ):
        features[column] = features[column].fillna(False).astype(bool)

    for arm in VARIANTS:
        arm_rows = features["experiment_variant"] == arm
        safari = arm_rows & (features["device_type"] == "mobile") & (features["browser"] == "safari")
        chrome = arm_rows & (features["device_type"] == "mobile") & (features["browser"] == "chrome")
        safari_s = safari & features["bank_started"]
        chrome_s = chrome & features["bank_started"]
        completion_gap = remember(
            f"completion_gap_mobile_safari_vs_chrome_{arm}",
            _rate(features.loc[chrome_s, "bank_connected"], chrome_s) - _rate(features.loc[safari_s, "bank_connected"], safari_s),
        )
        failure_gap = remember(
            f"failure_gap_mobile_safari_vs_chrome_{arm}",
            _rate(features.loc[safari_s, "bank_failed"], safari_s) - _rate(features.loc[chrome_s, "bank_failed"], chrome_s),
        )
        report.add(
            f"pattern.mobile_safari_bank_{arm}",
            completion_gap >= 0.15 and failure_gap >= 0.15,
            completion_gap=completion_gap,
            failure_gap=failure_gap,
            n_safari_started=int(safari_s.sum()),
            n_chrome_started=int(chrome_s.sum()),
        )

    desktop_safari = (features["device_type"] == "desktop") & (features["browser"] == "safari") & features["bank_started"]
    desktop_chrome = (features["device_type"] == "desktop") & (features["browser"] == "chrome") & features["bank_started"]
    mobile_chrome = (features["device_type"] == "mobile") & (features["browser"] == "chrome") & features["bank_started"]
    desktop_gap = abs(
        _rate(features.loc[desktop_safari, "bank_connected"], desktop_safari)
        - _rate(features.loc[desktop_chrome, "bank_connected"], desktop_chrome)
    )
    mobile_chrome_gap = abs(
        _rate(features.loc[mobile_chrome, "bank_connected"], mobile_chrome)
        - _rate(features.loc[desktop_chrome, "bank_connected"], desktop_chrome)
    )
    report.add(
        "pattern.mobile_safari_is_specific",
        desktop_gap <= 0.05 and mobile_chrome_gap <= 0.05,
        desktop_safari_vs_chrome_abs_gap=desktop_gap,
        mobile_chrome_vs_desktop_chrome_abs_gap=mobile_chrome_gap,
    )

    channel_counts = features["acquisition_channel"].value_counts()
    top_channel = str(channel_counts.index[0])
    social = features["acquisition_channel"] == VOLUME_CHANNEL
    others = ~social
    submission_gap = _rate(features.loc[others, "submitted"], others) - _rate(features.loc[social, "submitted"], social)
    approved_social = social & (features["decision"] == "approved")
    approved_other = others & (features["decision"] == "approved")
    funded_gap = _rate(features.loc[approved_other, "funded"], approved_other) - _rate(
        features.loc[approved_social, "funded"], approved_social
    )
    decided_social = social & features["decision"].notna()
    decided_other = others & features["decision"].notna()
    approval_gap = abs(
        _rate(features.loc[decided_social, "decision"] == "approved", decided_social)
        - _rate(features.loc[decided_other, "decision"] == "approved", decided_other)
    )
    early = ~features["late"]
    early_social_approved = early & approved_social
    early_other_approved = early & approved_other
    early_funded_gap = _rate(features.loc[early_other_approved, "funded"], early_other_approved) - _rate(
        features.loc[early_social_approved, "funded"], early_social_approved
    )
    report.add(
        "pattern.volume_channel",
        top_channel == VOLUME_CHANNEL
        and submission_gap >= 0.10
        and funded_gap >= 0.08
        and early_funded_gap >= 0.06
        and approval_gap <= 0.03,
        top_channel=top_channel,
        channel_counts={str(k): int(v) for k, v in channel_counts.items()},
        submission_gap_others_minus_volume=submission_gap,
        approved_to_funded_gap_others_minus_volume=funded_gap,
        early_approved_to_funded_gap=early_funded_gap,
        approval_abs_gap=approval_gap,
    )

    decided = features["decision"].notna()
    manual = decided & features["manual_review_flag"]
    auto = decided & ~features["manual_review_flag"]
    long = decided & (features["decision_duration_minutes"] > LONG_DECISION_MINUTES)
    manual_share = _rate(manual, decided)
    long_manual_share = _rate(long & manual, long)
    duration_ratio = _median(features.loc[manual, "decision_duration_minutes"]) / _median(
        features.loc[auto, "decision_duration_minutes"]
    )
    report.add(
        "pattern.manual_review_tail",
        manual_share < 0.22 and long_manual_share > 0.75 and duration_ratio > 10,
        manual_share=manual_share,
        long_decision_manual_share=long_manual_share,
        median_duration_ratio_manual_over_auto=duration_ratio,
        long_decision_cut_minutes=LONG_DECISION_MINUTES,
        n_decided=int(decided.sum()),
        n_long=int(long.sum()),
    )

    def approval_rate(mask: pd.Series) -> float:
        decided_mask = mask & features["decision"].notna()
        return _rate(features.loc[decided_mask, "decision"] == "approved", decided_mask)

    def approved_to_funded(mask: pd.Series) -> float:
        approved_mask = mask & (features["decision"] == "approved")
        return _rate(features.loc[approved_mask, "funded"], approved_mask)

    def funding_rate(mask: pd.Series) -> float:
        return _rate(features.loc[mask, "funded"], mask)

    late = features["late"]
    approval_lift = approval_rate(late) - approval_rate(~late)
    funded_drop = approved_to_funded(~late) - approved_to_funded(late)
    funding_change = funding_rate(late) - funding_rate(~late)
    variant_late = _rate(late & (features["experiment_variant"] == "treatment"), late)
    variant_early = _rate(~late & (features["experiment_variant"] == "treatment"), ~late)
    within_variant = True
    within_detail = {}
    for arm in VARIANTS:
        arm_rows = features["experiment_variant"] == arm
        lift = approval_rate(late & arm_rows) - approval_rate(~late & arm_rows)
        within_detail[arm] = lift
        within_variant = within_variant and lift >= 0.04
    report.add(
        "pattern.approval_without_funding_gain",
        approval_lift >= 0.05 and funded_drop >= 0.03 and funding_change <= 0.005 and within_variant
        and abs(variant_late - variant_early) < 0.02,
        approval_lift_late_minus_early=approval_lift,
        approved_to_funded_drop_early_minus_late=funded_drop,
        funding_rate_change_late_minus_early=funding_change,
        treatment_share_late=variant_late,
        treatment_share_early=variant_early,
        approval_lift_by_variant=within_detail,
    )

    id_started = features["id_started"]
    friction = id_started & (features["device_type"] == IDENTITY_FRICTION_DEVICE)
    other_id = id_started & (features["device_type"] != IDENTITY_FRICTION_DEVICE)
    success_gap = _rate(features.loc[other_id, "id_verified"], other_id) - _rate(
        features.loc[friction, "id_verified"], friction
    )
    friction_verified = features["device_type"] == IDENTITY_FRICTION_DEVICE
    duration_gap_ratio = _median(features.loc[friction_verified, "identity_minutes"]) / _median(
        features.loc[~friction_verified & features["id_verified"], "identity_minutes"]
    )
    report.add(
        "pattern.identity_friction_segment",
        success_gap >= 0.12 and duration_gap_ratio >= 2,
        device=IDENTITY_FRICTION_DEVICE,
        success_gap_other_minus_segment=success_gap,
        completer_duration_ratio=duration_gap_ratio,
        n_segment_started=int(friction.sum()),
    )

    started = features["bank_started"]
    treatment = features["experiment_variant"] == "treatment"
    control = features["experiment_variant"] == "control"
    completion_lift = _rate(features.loc[started & treatment, "bank_connected"], started & treatment) - _rate(
        features.loc[started & control, "bank_connected"], started & control
    )
    decided_t = treatment & features["decision"].notna()
    decided_c = control & features["decision"].notna()
    approval_diff = abs(
        _rate(features.loc[decided_t, "decision"] == "approved", decided_t)
        - _rate(features.loc[decided_c, "decision"] == "approved", decided_c)
    )
    id_t = treatment & features["id_started"]
    id_c = control & features["id_started"]
    identity_failure = lambda mask: features.loc[mask, "id_failed"] & ~features.loc[mask, "id_verified"]
    identity_diff = abs(_rate(identity_failure(id_t), id_t) - _rate(identity_failure(id_c), id_c))
    submitted_t = treatment & features["submitted"]
    submitted_c = control & features["submitted"]
    minutes = (features["submitted_at"] - features["started_at"]).dt.total_seconds() / 60.0
    median_t = _median(minutes[submitted_t])
    median_c = _median(minutes[submitted_c])
    relative_time = abs(median_t - median_c) / median_c
    safari_share_t = _rate(
        started & treatment & (features["device_type"] == "mobile") & (features["browser"] == "safari"),
        started & treatment,
    )
    safari_share_c = _rate(
        started & control & (features["device_type"] == "mobile") & (features["browser"] == "safari"),
        started & control,
    )
    report.add(
        "pattern.treatment_bank_completion",
        completion_lift >= 0.06
        and approval_diff < 0.02
        and identity_diff < 0.02
        and relative_time < 0.05
        and abs(safari_share_t - safari_share_c) < 0.02,
        completion_lift=completion_lift,
        n_started_treatment=int((started & treatment).sum()),
        n_started_control=int((started & control).sum()),
        approval_abs_diff=approval_diff,
        identity_failure_abs_diff=identity_diff,
        median_time_to_submit_treatment=median_t,
        median_time_to_submit_control=median_c,
        relative_time_to_submit_diff=relative_time,
        mobile_safari_share_of_starters_treatment=safari_share_t,
        mobile_safari_share_of_starters_control=safari_share_c,
    )
    metrics["treatment_completion_lift"] = completion_lift
    metrics["approval_lift_late_minus_early"] = approval_lift
    return metrics


def runtime_block() -> dict[str, str]:
    import duckdb as duckdb_mod
    import numpy as numpy_mod
    import pandas as pandas_mod
    import pyarrow as pyarrow_mod

    return {
        "python": platform.python_version(),
        "numpy": numpy_mod.__version__,
        "pandas": pandas_mod.__version__,
        "pyarrow": pyarrow_mod.__version__,
        "duckdb": duckdb_mod.__version__,
    }


def run(data_dir: Path) -> dict:
    report = Report()
    missing = [name for name in TABLE_NAMES if not (data_dir / f"{name}.parquet").exists()]
    if missing or not (data_dir / "manifest.json").exists():
        report.add("files.present", False, missing=missing, manifest=(data_dir / "manifest.json").exists())
        return {"passed": False, "checks": report.checks}
    try:
        shown_dir = str(data_dir.resolve().relative_to(ROOT))
    except ValueError:
        shown_dir = str(data_dir)
    report.add("files.present", True, data_dir=shown_dir)
    check_columns(report, data_dir)
    con = connect(data_dir)
    manifest = check_manifest(report, con, data_dir)
    check_structure(report, con)
    features = load_features(con)
    metrics = check_patterns(report, features)
    hashes = {f"{name}.parquet": file_sha256(data_dir / f"{name}.parquet") for name in TABLE_NAMES}
    payload = {
        "passed": report.passed,
        "generator_version": GENERATOR_VERSION,
        "seed": SEED,
        "n_applications": int(manifest["observed_row_counts"]["applications"]),
        "row_counts": manifest["observed_row_counts"],
        "checks": report.checks,
        "pattern_metrics": metrics,
        "sha256": hashes,
        "runtime": runtime_block(),
    }
    return payload


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description="Run LendFlow synthetic-data sanity checks.")
    parser.add_argument("--data-dir", type=Path, default=DEFAULT_DATA)
    parser.add_argument(
        "--report",
        type=Path,
        default=None,
        help="Where to write sanity_report.json (default: <data-dir>/sanity_report.json).",
    )
    args = parser.parse_args(argv)
    data_dir = args.data_dir
    payload = run(data_dir)
    report_path = args.report or (data_dir / "sanity_report.json")
    if data_dir.exists():
        report_path.write_text(json.dumps(payload, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    failed = [item["id"] for item in payload["checks"] if item["result"] != "pass"]
    passed = [item for item in payload["checks"] if item["result"] == "pass"]
    print(f"passed={payload['passed']} checks={len(passed)} failed={len(failed)}")
    if "row_counts" in payload:
        for name, count in payload["row_counts"].items():
            print(f"{name}={count}")
    for item in payload["checks"]:
        if item["result"] != "pass":
            detail = {key: value for key, value in item.items() if key not in {"id", "result"}}
            print(f"FAIL {item['id']} {json.dumps(detail, default=str)}")
    if failed:
        sys.exit(1)


if __name__ == "__main__":
    main()
