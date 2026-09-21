"""Build the six synthetic tables and write them to Parquet.

Variant changes bank-connection failure and recovery only.
The later calendar period changes approval and post-approval funding only.
The volume channel changes early-funnel reach and post-approval funding only.
Tablet changes identity failure, recovery, and duration only.
Mobile Safari changes bank-connection failure and recovery only.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import numpy as np
import pandas as pd
import pyarrow as pa
import pyarrow.parquet as pq

from lendflow_synth.parameters import (
    AGE_LABELS,
    AGE_PROBS,
    APPLICATION_COLUMNS,
    BANK_ERROR_CODES,
    BROWSER_BY_DEVICE,
    CHANNEL_LABELS,
    CHANNEL_PROBS,
    COLUMNS,
    D_BANK_GAP,
    D_CONTRACT,
    D_DECISION_AUTO,
    D_DECISION_AUTO_DELAYED,
    D_DECISION_MANUAL,
    D_DECISION_MANUAL_QUICK,
    D_FUNDING,
    D_IDENTITY,
    D_IDENTITY_FAIL_GAP,
    D_IDENTITY_FAIL_GAP_FRICTION,
    D_IDENTITY_FRICTION,
    D_PERSONAL,
    D_PRE_UW,
    D_TO_BANK,
    D_TO_CONTRACT_START,
    D_TO_FUNDING,
    D_TO_IDENTITY,
    D_TO_SUBMIT,
    D_TO_VEHICLE,
    DEVICE_LABELS,
    DEVICE_PROBS,
    EMPLOYMENT_LABELS,
    EMPLOYMENT_PROBS,
    EXPERIMENT_COLUMNS,
    EXPERIMENT_NAME,
    FUNDING_COLUMNS,
    GENERATOR_VERSION,
    IDENTITY_ERROR_CODES,
    IDENTITY_FRICTION_DEVICE,
    INCOME_LABELS,
    INCOME_PROBS,
    LATE_PERIOD_START,
    N_APPLICANTS,
    N_APPLICATIONS,
    N_REPEAT_APPLICATIONS,
    P_APPROVE,
    P_AUTO_DELAYED,
    P_BANK_FAIL,
    P_BANK_RECOVER,
    P_BANK_START,
    P_CONTRACT,
    P_CONTRACT_LATE_MARGINAL,
    P_FUND_IF_CLEAR,
    P_FUND_IF_STIP,
    P_ID_FAIL,
    P_ID_RECOVER,
    P_IDENTITY_START,
    P_MANUAL,
    P_MANUAL_QUICK,
    P_PERSONAL,
    P_REFER_IF_NOT_APPROVED,
    P_SECOND_BANK_FAIL_IF_ABANDON,
    P_SECOND_BANK_FAIL_IF_RECOVER,
    P_SECOND_ID_FAIL_IF_ABANDON,
    P_SECOND_ID_FAIL_IF_RECOVER,
    P_STIP_BASE,
    P_STIP_LATE_CORE,
    P_STIP_LATE_MARGINAL,
    P_STIP_SOCIAL_FLOOR,
    P_SUBMIT_GIVEN_IDENTITY,
    P_VEHICLE,
    PRE_UW_MAX_SECONDS,
    REPEAT_ELIGIBILITY_DAYS,
    REPEAT_MIN_GAP_DAYS,
    RETURNING_CREATED_DAYS,
    RETURNING_USER_RATE,
    RISK_BANDS,
    RISK_GIVEN_INCOME,
    SEED,
    SOCIAL_CONTRACT_MULTIPLIER,
    SOCIAL_VEHICLE_MULTIPLIER,
    STATE_LABELS,
    STATE_PROBS,
    TABLE_NAMES,
    TREATMENT_PROBABILITY,
    VOLUME_CHANNEL,
    WINDOW_END_EXCLUSIVE,
    WINDOW_START,
    APPLICATION_COUNT_TOLERANCE,
    DECISION_COLUMNS,
    APPLICANT_COLUMNS,
)

ROOT = Path(__file__).resolve().parents[2]
DEFAULT_OUTPUT = ROOT / "data" / "synthetic"
NAT = np.datetime64("NaT", "us")
DECISION_EVENT = {
    "approved": "decision_approved",
    "referred": "decision_referred",
    "declined": "decision_declined",
}


def default_output_dir() -> Path:
    return DEFAULT_OUTPUT


def _draw(rng: np.random.Generator, n: int, labels: tuple[str, ...], probs: tuple[float, ...]) -> np.ndarray:
    cdf = np.cumsum(np.asarray(probs, dtype=np.float64))
    cdf /= cdf[-1]
    idx = np.searchsorted(cdf, rng.random(n), side="left")
    idx = np.minimum(idx, len(labels) - 1)
    return np.asarray(labels, dtype=object)[idx]


def _minutes(rng: np.random.Generator, n: int, spec: tuple[float, float, float]) -> np.ndarray:
    median, sigma, minimum = spec
    draws = rng.lognormal(mean=float(np.log(median)), sigma=float(sigma), size=n)
    return np.maximum(draws, minimum)


def _seconds(minutes: float, floor: int = 30) -> int:
    return max(floor, int(round(float(minutes) * 60.0)))


def _add_seconds(ts: np.datetime64, seconds: int) -> np.datetime64:
    return ts + np.timedelta64(int(seconds), "s")


def _require_unit_interval(name: str, values: np.ndarray) -> None:
    if np.any(values < 0.0) or np.any(values > 1.0) or np.any(~np.isfinite(values)):
        raise ValueError(f"{name} left [0, 1]")


def _lookup(keys: np.ndarray, table: dict[str, float], default: float | None = None) -> np.ndarray:
    out = np.empty(len(keys), dtype=np.float64)
    seen = np.zeros(len(keys), dtype=bool)
    for key, value in table.items():
        mask = keys == key
        out[mask] = value
        seen |= mask
    if default is None:
        if not seen.all():
            missing = sorted(set(keys[~seen].tolist()))
            raise KeyError(f"missing keys {missing}")
    else:
        out[~seen] = default
    return out


def _period_risk_lookup(late: np.ndarray, risk: np.ndarray, table: dict[str, dict[str, float]]) -> np.ndarray:
    out = np.empty(len(risk), dtype=np.float64)
    for period, is_late in (("early", False), ("late", True)):
        for band, value in table[period].items():
            out[(late == is_late) & (risk == band)] = value
    if not np.isfinite(out).all():
        raise ValueError("period/risk lookup left a gap")
    return out


def build_frames(seed: int = SEED) -> dict[str, pd.DataFrame]:
    rng = np.random.Generator(np.random.PCG64(seed))
    population = _draw_population(rng)
    outcomes = _draw_outcomes(rng, population)
    return _assemble(population, outcomes)


def _draw_population(rng: np.random.Generator) -> dict[str, np.ndarray]:
    n_people = N_APPLICANTS
    n = N_APPLICATIONS

    age = _draw(rng, n_people, AGE_LABELS, AGE_PROBS)
    income = _draw(rng, n_people, INCOME_LABELS, INCOME_PROBS)
    employment = _draw(rng, n_people, EMPLOYMENT_LABELS, EMPLOYMENT_PROBS)
    state = _draw(rng, n_people, STATE_LABELS, STATE_PROBS)
    returning = rng.random(n_people) < RETURNING_USER_RATE
    created_days = rng.integers(
        RETURNING_CREATED_DAYS[0],
        RETURNING_CREATED_DAYS[1] + 1,
        size=n_people,
    )

    start_s = np.datetime64(WINDOW_START, "s")
    end_s = np.datetime64(WINDOW_END_EXCLUSIVE, "s")
    span = int((end_s - start_s) / np.timedelta64(1, "s"))
    first_started = (start_s + rng.integers(0, span, size=n_people).astype("timedelta64[s]")).astype(
        "datetime64[us]"
    )

    cutoff = end_s.astype("datetime64[us]") - np.timedelta64(REPEAT_ELIGIBILITY_DAYS, "D")
    eligible = np.flatnonzero(first_started < cutoff)
    if len(eligible) < N_REPEAT_APPLICATIONS:
        raise RuntimeError(
            f"only {len(eligible)} applicants can take a second application; need {N_REPEAT_APPLICATIONS}"
        )
    chosen = rng.choice(eligible, size=N_REPEAT_APPLICATIONS, replace=False)
    end_us = end_s.astype("datetime64[us]")
    room_s = ((end_us - first_started[chosen]) / np.timedelta64(1, "s")).astype(np.int64)
    min_gap_s = REPEAT_MIN_GAP_DAYS * 24 * 60 * 60
    extra = min_gap_s + rng.integers(0, room_s - min_gap_s)
    second_started = first_started[chosen] + extra.astype("timedelta64[s]")

    applicant_index = np.empty(n, dtype=np.int32)
    applicant_index[:n_people] = np.arange(n_people)
    applicant_index[n_people:] = chosen
    started = np.empty(n, dtype="datetime64[us]")
    started[:n_people] = first_started
    started[n_people:] = second_started.astype("datetime64[us]")

    created = first_started.copy()
    created[returning] = first_started[returning] - created_days[returning].astype("timedelta64[D]")

    channel = _draw(rng, n, CHANNEL_LABELS, CHANNEL_PROBS)
    device = _draw(rng, n, DEVICE_LABELS, DEVICE_PROBS)
    browser = np.empty(n, dtype=object)
    browser_u = rng.random(n)
    for device_name, pairs in BROWSER_BY_DEVICE.items():
        labels = tuple(label for label, _ in pairs)
        probs = tuple(prob for _, prob in pairs)
        mask = device == device_name
        cdf = np.cumsum(np.asarray(probs, dtype=np.float64))
        cdf /= cdf[-1]
        idx = np.searchsorted(cdf, browser_u[mask], side="left")
        idx = np.minimum(idx, len(labels) - 1)
        browser[mask] = np.asarray(labels, dtype=object)[idx]

    variant = np.where(rng.random(n) < TREATMENT_PROBABILITY, "treatment", "control").astype(object)

    risk = np.empty(n_people, dtype=object)
    risk_u = rng.random(n_people)
    for income_band, probs in RISK_GIVEN_INCOME.items():
        mask = income == income_band
        cdf = np.cumsum(np.asarray(probs, dtype=np.float64))
        idx = np.searchsorted(cdf, risk_u[mask], side="left")
        idx = np.minimum(idx, len(RISK_BANDS) - 1)
        risk[mask] = np.asarray(RISK_BANDS, dtype=object)[idx]

    return {
        "age": age,
        "income": income,
        "employment": employment,
        "state": state,
        "returning": returning,
        "created": created,
        "applicant_index": applicant_index,
        "started": started,
        "channel": channel,
        "device": device,
        "browser": browser,
        "variant": variant,
        "risk": risk[applicant_index],
    }


def _draw_outcomes(rng: np.random.Generator, pop: dict[str, np.ndarray]) -> dict[str, np.ndarray]:
    n = N_APPLICATIONS
    channel = pop["channel"]
    device = pop["device"]
    browser = pop["browser"]
    variant = pop["variant"]
    risk = pop["risk"]
    late = pop["started"] >= np.datetime64(LATE_PERIOD_START, "us")
    social = channel == VOLUME_CHANNEL
    mobile_safari = (device == "mobile") & (browser == "safari")
    friction = device == IDENTITY_FRICTION_DEVICE
    marginal = np.isin(risk, ("elevated", "high"))

    p_personal = np.where(social, P_PERSONAL[VOLUME_CHANNEL], P_PERSONAL["other"])
    p_bank_start = np.where(social, P_BANK_START[VOLUME_CHANNEL], P_BANK_START["other"])
    p_submit = np.where(social, P_SUBMIT_GIVEN_IDENTITY[VOLUME_CHANNEL], P_SUBMIT_GIVEN_IDENTITY["other"])

    bank_segment = np.where(mobile_safari, "mobile_safari", "other")
    p_bank_fail = np.empty(n, dtype=np.float64)
    p_bank_recover = np.empty(n, dtype=np.float64)
    for segment in ("other", "mobile_safari"):
        for arm in ("control", "treatment"):
            mask = (bank_segment == segment) & (variant == arm)
            p_bank_fail[mask] = P_BANK_FAIL[(segment, arm)]
            p_bank_recover[mask] = P_BANK_RECOVER[(segment, arm)]
    _require_unit_interval("p_bank_fail", p_bank_fail)
    _require_unit_interval("p_bank_recover", p_bank_recover)

    p_id_fail = np.where(friction, P_ID_FAIL[IDENTITY_FRICTION_DEVICE], P_ID_FAIL["other"])
    p_id_recover = np.where(friction, P_ID_RECOVER[IDENTITY_FRICTION_DEVICE], P_ID_RECOVER["other"])

    p_approve = _period_risk_lookup(late, risk, P_APPROVE)
    p_manual = _lookup(risk, P_MANUAL)
    p_vehicle = _period_risk_lookup(late, risk, P_VEHICLE)
    p_vehicle = np.where(social, p_vehicle * SOCIAL_VEHICLE_MULTIPLIER, p_vehicle)
    p_contract = np.where(late & marginal, P_CONTRACT_LATE_MARGINAL, P_CONTRACT)
    p_contract = np.where(social, p_contract * SOCIAL_CONTRACT_MULTIPLIER, p_contract)
    p_stip = np.full(n, P_STIP_BASE, dtype=np.float64)
    p_stip = np.where(late & ~marginal, P_STIP_LATE_CORE, p_stip)
    p_stip = np.where(late & marginal, P_STIP_LATE_MARGINAL, p_stip)
    p_stip = np.where(social, np.maximum(p_stip, P_STIP_SOCIAL_FLOOR), p_stip)
    for name, values in (
        ("p_personal", p_personal),
        ("p_bank_start", p_bank_start),
        ("p_submit", p_submit),
        ("p_approve", p_approve),
        ("p_manual", p_manual),
        ("p_vehicle", p_vehicle),
        ("p_contract", p_contract),
        ("p_stip", p_stip),
        ("p_id_fail", p_id_fail),
        ("p_id_recover", p_id_recover),
    ):
        _require_unit_interval(name, values)

    reach_personal = rng.random(n) < p_personal
    reach_bank_start = reach_personal & (rng.random(n) < p_bank_start)
    first_bank_fail = reach_bank_start & (rng.random(n) < p_bank_fail)
    bank_recover = first_bank_fail & (rng.random(n) < p_bank_recover)
    bank_complete = reach_bank_start & (~first_bank_fail | bank_recover)
    second_bank_p = np.where(bank_recover, P_SECOND_BANK_FAIL_IF_RECOVER, P_SECOND_BANK_FAIL_IF_ABANDON)
    n_bank_fails = first_bank_fail.astype(np.int8)
    n_bank_fails = n_bank_fails + (first_bank_fail & (rng.random(n) < second_bank_p)).astype(np.int8)

    reach_id_start = bank_complete & (rng.random(n) < P_IDENTITY_START)
    first_id_fail = reach_id_start & (rng.random(n) < p_id_fail)
    id_recover = first_id_fail & (rng.random(n) < p_id_recover)
    id_success = reach_id_start & (~first_id_fail | id_recover)
    second_id_p = np.where(id_recover, P_SECOND_ID_FAIL_IF_RECOVER, P_SECOND_ID_FAIL_IF_ABANDON)
    n_id_fails = first_id_fail.astype(np.int8)
    n_id_fails = n_id_fails + (first_id_fail & (rng.random(n) < second_id_p)).astype(np.int8)

    reach_submit = id_success & (rng.random(n) < p_submit)
    is_manual = reach_submit & (rng.random(n) < p_manual)
    manual_quick = is_manual & (rng.random(n) < P_MANUAL_QUICK)
    auto_delayed = reach_submit & ~is_manual & (rng.random(n) < P_AUTO_DELAYED)
    approved = reach_submit & (rng.random(n) < p_approve)
    referred = reach_submit & ~approved & (rng.random(n) < P_REFER_IF_NOT_APPROVED)
    declined = reach_submit & ~approved & ~referred

    stipulation = approved & (rng.random(n) < p_stip)
    p_fund = np.where(stipulation, P_FUND_IF_STIP, P_FUND_IF_CLEAR)
    reach_vehicle = approved & (rng.random(n) < p_vehicle)
    reach_contract = reach_vehicle & (rng.random(n) < p_contract)
    reach_funded = reach_contract & (rng.random(n) < p_fund)

    durations = {
        "personal": _minutes(rng, n, D_PERSONAL),
        "to_bank": _minutes(rng, n, D_TO_BANK),
        "bank_gap": np.column_stack([_minutes(rng, n, D_BANK_GAP) for _ in range(3)]),
        "to_identity": _minutes(rng, n, D_TO_IDENTITY),
        # Both lognormals are drawn for every row so the random stream does not depend on how many tablets were sampled.
        "id_span": np.where(friction, _minutes(rng, n, D_IDENTITY_FRICTION), _minutes(rng, n, D_IDENTITY)),
        "id_fail": np.where(
            friction[:, None],
            np.column_stack([_minutes(rng, n, D_IDENTITY_FAIL_GAP_FRICTION) for _ in range(2)]),
            np.column_stack([_minutes(rng, n, D_IDENTITY_FAIL_GAP) for _ in range(2)]),
        ),
        "to_submit": _minutes(rng, n, D_TO_SUBMIT),
        "pre_uw": _minutes(rng, n, D_PRE_UW),
        "decision_auto": _minutes(rng, n, D_DECISION_AUTO),
        "decision_auto_delayed": _minutes(rng, n, D_DECISION_AUTO_DELAYED),
        "decision_manual": _minutes(rng, n, D_DECISION_MANUAL),
        "decision_manual_quick": _minutes(rng, n, D_DECISION_MANUAL_QUICK),
        "to_vehicle": _minutes(rng, n, D_TO_VEHICLE),
        "to_contract_start": _minutes(rng, n, D_TO_CONTRACT_START),
        "contract": _minutes(rng, n, D_CONTRACT),
        "to_funding": _minutes(rng, n, D_TO_FUNDING),
        "funding": _minutes(rng, n, D_FUNDING),
    }

    bank_errors = rng.integers(0, len(BANK_ERROR_CODES), size=(n, 2))
    id_errors = rng.integers(0, len(IDENTITY_ERROR_CODES), size=(n, 2))

    return {
        "late": late,
        "reach_personal": reach_personal,
        "reach_bank_start": reach_bank_start,
        "bank_complete": bank_complete,
        "n_bank_fails": n_bank_fails,
        "reach_id_start": reach_id_start,
        "id_success": id_success,
        "n_id_fails": n_id_fails,
        "reach_submit": reach_submit,
        "is_manual": is_manual,
        "manual_quick": manual_quick,
        "auto_delayed": auto_delayed,
        "approved": approved,
        "referred": referred,
        "declined": declined,
        "stipulation": stipulation,
        "reach_vehicle": reach_vehicle,
        "reach_contract": reach_contract,
        "reach_funded": reach_funded,
        "durations": durations,
        "bank_errors": bank_errors,
        "id_errors": id_errors,
    }


def _assemble(pop: dict[str, np.ndarray], out: dict[str, np.ndarray]) -> dict[str, pd.DataFrame]:
    n = N_APPLICATIONS
    n_people = N_APPLICANTS
    applicant_ids = np.array([f"apl_{i + 1:08d}" for i in range(n_people)])
    application_ids = np.array([f"app_{i + 1:08d}" for i in range(n)])
    session_ids = np.array([f"ses_{i + 1:08d}" for i in range(n)])
    app_applicant_ids = applicant_ids[pop["applicant_index"]]

    submitted_at = np.full(n, NAT)
    decision_at = np.full(n, NAT)
    contracted_at = np.full(n, NAT)
    funded_at = np.full(n, NAT)
    funding_timestamp = np.full(n, NAT)
    duration_minutes = np.full(n, np.nan)
    funding_hours = np.full(n, np.nan)
    status = np.empty(n, dtype=object)
    decision = np.empty(n, dtype=object)
    path = np.empty(n, dtype=object)
    decision[:] = None
    path[:] = None

    ev_id: list[str] = []
    ev_applicant: list[str] = []
    ev_application: list[str] = []
    ev_session: list[str] = []
    ev_ts: list[np.datetime64] = []
    ev_name: list[str] = []
    ev_device: list[str] = []
    ev_browser: list[str] = []
    ev_channel: list[str] = []
    ev_variant: list[str] = []
    ev_error: list[str | None] = []
    next_event = 1

    durations = out["durations"]

    def push(i: int, ts: np.datetime64, name: str, error: str | None, last: np.datetime64 | None) -> np.datetime64:
        nonlocal next_event
        if last is not None and ts <= last:
            raise RuntimeError(f"timestamp did not advance on {application_ids[i]} at {name}")
        ev_id.append(f"evt_{next_event:08d}")
        next_event += 1
        ev_applicant.append(app_applicant_ids[i])
        ev_application.append(application_ids[i])
        ev_session.append(session_ids[i])
        ev_ts.append(ts)
        ev_name.append(name)
        ev_device.append(pop["device"][i])
        ev_browser.append(pop["browser"][i])
        ev_channel.append(pop["channel"][i])
        ev_variant.append(pop["variant"][i])
        ev_error.append(error)
        return ts

    for i in range(n):
        t = pop["started"][i]
        last = push(i, t, "application_started", None, None)
        status[i] = "started"
        if not out["reach_personal"][i]:
            continue

        t = _add_seconds(t, _seconds(durations["personal"][i]))
        last = push(i, t, "personal_info_completed", None, last)
        status[i] = "personal_info_completed"
        if not out["reach_bank_start"][i]:
            continue

        t = _add_seconds(t, _seconds(durations["to_bank"][i]))
        last = push(i, t, "bank_connection_started", None, last)
        status[i] = "bank_connection_started"
        for k in range(int(out["n_bank_fails"][i])):
            t = _add_seconds(t, _seconds(durations["bank_gap"][i, k]))
            code = BANK_ERROR_CODES[int(out["bank_errors"][i, k])]
            last = push(i, t, "bank_connection_failed", code, last)
        if not out["bank_complete"][i]:
            continue

        t = _add_seconds(t, _seconds(durations["bank_gap"][i, 2]))
        last = push(i, t, "bank_connected", None, last)
        status[i] = "bank_connected"
        if not out["reach_id_start"][i]:
            continue

        t = _add_seconds(t, _seconds(durations["to_identity"][i]))
        last = push(i, t, "identity_verification_started", None, last)
        for k in range(int(out["n_id_fails"][i])):
            t = _add_seconds(t, _seconds(durations["id_fail"][i, k]))
            code = IDENTITY_ERROR_CODES[int(out["id_errors"][i, k])]
            last = push(i, t, "identity_verification_failed", code, last)
        if not out["id_success"][i]:
            continue

        t = _add_seconds(t, _seconds(durations["id_span"][i]))
        last = push(i, t, "identity_verified", None, last)
        status[i] = "identity_verified"
        if not out["reach_submit"][i]:
            continue

        t = _add_seconds(t, _seconds(durations["to_submit"][i]))
        last = push(i, t, "application_submitted", None, last)
        submitted_at[i] = t
        status[i] = "submitted"

        if out["is_manual"][i]:
            dec_minutes = (
                durations["decision_manual_quick"][i]
                if out["manual_quick"][i]
                else durations["decision_manual"][i]
            )
        elif out["auto_delayed"][i]:
            dec_minutes = durations["decision_auto_delayed"][i]
        else:
            dec_minutes = durations["decision_auto"][i]
        dec_s = _seconds(dec_minutes, floor=8 * 60)
        uw_s = min(PRE_UW_MAX_SECONDS, _seconds(durations["pre_uw"][i], floor=30))
        if uw_s >= dec_s - 90:
            uw_s = 60
        t_uw = _add_seconds(submitted_at[i], uw_s)
        last = push(i, t_uw, "underwriting_started", None, last)
        t_decision = _add_seconds(submitted_at[i], dec_s)
        if out["is_manual"][i]:
            review_s = uw_s + max(30, (dec_s - uw_s) // 3)
            if review_s >= dec_s:
                review_s = dec_s - 30
            last = push(i, _add_seconds(submitted_at[i], review_s), "manual_review_started", None, last)
        if out["approved"][i]:
            label = "approved"
        elif out["referred"][i]:
            label = "referred"
        elif out["declined"][i]:
            label = "declined"
        else:
            raise RuntimeError(f"submitted application {application_ids[i]} has no decision")
        last = push(i, t_decision, DECISION_EVENT[label], None, last)
        decision_at[i] = t_decision
        decision[i] = label
        path[i] = "manual" if out["is_manual"][i] else "auto"
        duration_minutes[i] = dec_s / 60.0
        status[i] = label
        if label != "approved":
            continue

        if not out["reach_vehicle"][i]:
            continue
        t = _add_seconds(t_decision, _seconds(durations["to_vehicle"][i], floor=60))
        last = push(i, t, "vehicle_selected", None, last)
        status[i] = "vehicle_selected"
        if not out["reach_contract"][i]:
            continue

        t = _add_seconds(t, _seconds(durations["to_contract_start"][i]))
        last = push(i, t, "contract_started", None, last)
        t = _add_seconds(t, _seconds(durations["contract"][i]))
        last = push(i, t, "contract_signed", None, last)
        contracted_at[i] = t
        status[i] = "contracted"
        t = _add_seconds(t, _seconds(durations["to_funding"][i], floor=60))
        last = push(i, t, "funding_started", None, last)
        if not out["reach_funded"][i]:
            continue

        t = _add_seconds(t, _seconds(durations["funding"][i], floor=60))
        push(i, t, "loan_funded", None, last)
        funded_at[i] = t
        funding_timestamp[i] = t
        funding_hours[i] = int((t - contracted_at[i]) / np.timedelta64(1, "s")) / 3600.0
        status[i] = "funded"

    applicants = pd.DataFrame(
        {
            "applicant_id": applicant_ids,
            "created_at": pd.to_datetime(pop["created"], utc=True),
            "age_band": pd.Series(pop["age"], dtype="string"),
            "income_band": pd.Series(pop["income"], dtype="string"),
            "employment_type": pd.Series(pop["employment"], dtype="string"),
            "state": pd.Series(pop["state"], dtype="string"),
            "returning_user": pop["returning"].astype(bool),
        }
    )
    applications = pd.DataFrame(
        {
            "application_id": pd.Series(application_ids, dtype="string"),
            "applicant_id": pd.Series(app_applicant_ids, dtype="string"),
            "started_at": pd.to_datetime(pop["started"], utc=True),
            "submitted_at": pd.to_datetime(submitted_at, utc=True),
            "decision_at": pd.to_datetime(decision_at, utc=True),
            "contracted_at": pd.to_datetime(contracted_at, utc=True),
            "funded_at": pd.to_datetime(funded_at, utc=True),
            "acquisition_channel": pd.Series(pop["channel"], dtype="string"),
            "device_type": pd.Series(pop["device"], dtype="string"),
            "browser": pd.Series(pop["browser"], dtype="string"),
            "application_status": pd.Series(status, dtype="string"),
            "underwriting_path": pd.Series(path, dtype="string"),
            "experiment_variant": pd.Series(pop["variant"], dtype="string"),
        }
    )
    events = pd.DataFrame(
        {
            "event_id": pd.Series(ev_id, dtype="string"),
            "applicant_id": pd.Series(ev_applicant, dtype="string"),
            "application_id": pd.Series(ev_application, dtype="string"),
            "session_id": pd.Series(ev_session, dtype="string"),
            "event_timestamp": pd.to_datetime(np.array(ev_ts, dtype="datetime64[us]"), utc=True),
            "event_name": pd.Series(ev_name, dtype="string"),
            "device_type": pd.Series(ev_device, dtype="string"),
            "browser": pd.Series(ev_browser, dtype="string"),
            "acquisition_channel": pd.Series(ev_channel, dtype="string"),
            "experiment_variant": pd.Series(ev_variant, dtype="string"),
            "error_code": pd.Series(ev_error, dtype="string"),
        }
    )

    decided = np.fromiter((value is not None for value in decision), dtype=bool, count=n)
    decisions = pd.DataFrame(
        {
            "application_id": pd.Series(application_ids[decided], dtype="string"),
            "decision_timestamp": pd.to_datetime(decision_at[decided], utc=True),
            "decision": pd.Series(decision[decided], dtype="string"),
            "decision_path": pd.Series(path[decided], dtype="string"),
            "manual_review_flag": (path[decided] == "manual"),
            "decision_duration_minutes": duration_minutes[decided],
            "risk_band": pd.Series(pop["risk"][decided], dtype="string"),
        }
    )
    approved_mask = decision == "approved"
    funding = pd.DataFrame(
        {
            "application_id": pd.Series(application_ids[approved_mask], dtype="string"),
            "funding_status": pd.Series(
                np.where(~np.isnat(funded_at[approved_mask]), "funded", "not_funded"),
                dtype="string",
            ),
            "funding_timestamp": pd.to_datetime(funding_timestamp[approved_mask], utc=True),
            "funding_duration_hours": pd.Series(funding_hours[approved_mask], dtype="Float64"),
            "stipulation_flag": out["stipulation"][approved_mask].astype(bool),
        }
    )
    experiments = pd.DataFrame(
        {
            "application_id": pd.Series(application_ids, dtype="string"),
            "experiment_name": pd.Series(EXPERIMENT_NAME, index=range(n), dtype="string"),
            "variant": pd.Series(pop["variant"], dtype="string"),
            "assigned_at": pd.to_datetime(pop["started"], utc=True),
        }
    )

    frames = {
        "applicants": applicants.loc[:, list(APPLICANT_COLUMNS)],
        "applications": applications.loc[:, list(APPLICATION_COLUMNS)],
        "events": events.loc[:, list(COLUMNS["events"])],
        "underwriting_decisions": decisions.loc[:, list(DECISION_COLUMNS)],
        "funding_events": funding.loc[:, list(FUNDING_COLUMNS)],
        "experiments": experiments.loc[:, list(EXPERIMENT_COLUMNS)],
    }
    for name, frame in frames.items():
        key = COLUMNS[name][0]
        frames[name] = frame.sort_values(key, kind="mergesort").reset_index(drop=True)
    if len(frames["applications"]) != N_APPLICATIONS:
        raise RuntimeError("application count drifted")
    return frames


def _schema_for(table: str) -> pa.Schema:
    timestamp = pa.timestamp("us", tz="UTC")
    nullable = {
        "submitted_at",
        "decision_at",
        "contracted_at",
        "funded_at",
        "funding_timestamp",
        "underwriting_path",
        "error_code",
        "funding_duration_hours",
    }
    timestamp_columns = {
        "created_at",
        "started_at",
        "submitted_at",
        "decision_at",
        "contracted_at",
        "funded_at",
        "event_timestamp",
        "decision_timestamp",
        "funding_timestamp",
        "assigned_at",
    }
    bool_columns = {"returning_user", "manual_review_flag", "stipulation_flag"}
    float_columns = {"decision_duration_minutes", "funding_duration_hours"}
    fields = []
    for column in COLUMNS[table]:
        if column in timestamp_columns:
            dtype: pa.DataType = timestamp
        elif column in bool_columns:
            dtype = pa.bool_()
        elif column in float_columns:
            dtype = pa.float64()
        else:
            dtype = pa.string()
        fields.append(pa.field(column, dtype, nullable=column in nullable))
    return pa.schema(fields)


def write_frames(frames: dict[str, pd.DataFrame], output: Path) -> dict[str, int]:
    output.mkdir(parents=True, exist_ok=True)
    counts: dict[str, int] = {}
    for name in TABLE_NAMES:
        frame = frames[name]
        table = pa.Table.from_pandas(frame, schema=_schema_for(name), preserve_index=False)
        pq.write_table(table, output / f"{name}.parquet", compression="snappy")
        counts[name] = int(len(frame))
    manifest = {
        "schema_version": 1,
        "generator_version": GENERATOR_VERSION,
        "seed": SEED,
        "n_applications": N_APPLICATIONS,
        "n_applicants": N_APPLICANTS,
        "application_count_tolerance": {
            "low": APPLICATION_COUNT_TOLERANCE[0],
            "high": APPLICATION_COUNT_TOLERANCE[1],
        },
        "window_start": WINDOW_START + "Z",
        "window_end_exclusive": WINDOW_END_EXCLUSIVE + "Z",
        "late_period_start": LATE_PERIOD_START + "Z",
        "experiment_name": EXPERIMENT_NAME,
        "row_counts": counts,
        "tables": list(TABLE_NAMES),
    }
    (output / "manifest.json").write_text(json.dumps(manifest, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    return counts


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description="Write the LendFlow synthetic Parquet tables.")
    parser.add_argument(
        "--output",
        type=Path,
        default=None,
        help=f"Directory for the six Parquet tables (default: {DEFAULT_OUTPUT})",
    )
    args = parser.parse_args(argv)
    output = args.output or default_output_dir()
    frames = build_frames(SEED)
    counts = write_frames(frames, output)
    print(f"seed={SEED} output={output}")
    for name in TABLE_NAMES:
        print(f"{name}={counts[name]}")


if __name__ == "__main__":
    main()
