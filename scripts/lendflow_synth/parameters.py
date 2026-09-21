"""Generator contract. Magnitudes live here. The analytical spec locks the patterns, not these numbers."""

from __future__ import annotations

GENERATOR_VERSION = "1.0.0"

# Fixed seed. Same code and dependency pins reproduce the same tables.
SEED = 20260921

# Exactly this many applications. The contract tolerance is the band below.
N_APPLICATIONS = 100_000
N_REPEAT_APPLICATIONS = 4_000
N_APPLICANTS = N_APPLICATIONS - N_REPEAT_APPLICATIONS
APPLICATION_COUNT_TOLERANCE = (98_000, 102_000)

WINDOW_START = "2025-01-06T00:00:00"
WINDOW_END_EXCLUSIVE = "2025-06-30T00:00:00"
# Applications with started_at on or after this instant are the later period.
LATE_PERIOD_START = "2025-05-05T00:00:00"

REPEAT_MIN_GAP_DAYS = 7
REPEAT_ELIGIBILITY_DAYS = 14
RETURNING_USER_RATE = 0.16
RETURNING_CREATED_DAYS = (30, 400)  # inclusive low, exclusive high

EXPERIMENT_NAME = "bank_connection_clarity"
VARIANTS = ("control", "treatment")
TREATMENT_PROBABILITY = 0.5

VOLUME_CHANNEL = "social_prospecting"
IDENTITY_FRICTION_DEVICE = "tablet"

AGE_BANDS = (
    ("18_24", 0.12),
    ("25_34", 0.28),
    ("35_44", 0.24),
    ("45_54", 0.18),
    ("55_64", 0.12),
    ("65_plus", 0.06),
)

INCOME_BANDS = (
    ("lt_30k", 0.14),
    ("30k_50k", 0.22),
    ("50k_75k", 0.24),
    ("75k_100k", 0.18),
    ("100k_150k", 0.14),
    ("gte_150k", 0.08),
)

EMPLOYMENT_TYPES = (
    ("employed", 0.68),
    ("self_employed", 0.12),
    ("gig", 0.10),
    ("retired", 0.06),
    ("other", 0.04),
)

# OTHER is a collapsed remainder, not a postal code.
STATES = (
    ("CA", 0.12),
    ("TX", 0.09),
    ("FL", 0.07),
    ("NY", 0.06),
    ("IL", 0.05),
    ("PA", 0.05),
    ("OH", 0.04),
    ("GA", 0.04),
    ("NC", 0.04),
    ("MI", 0.04),
    ("NJ", 0.03),
    ("VA", 0.03),
    ("AZ", 0.03),
    ("TN", 0.03),
    ("WA", 0.03),
    ("CO", 0.03),
    ("MA", 0.03),
    ("IN", 0.03),
    ("MO", 0.03),
    ("MD", 0.03),
    ("WI", 0.02),
    ("OTHER", 0.08),
)

CHANNELS = (
    ("social_prospecting", 0.30),
    ("paid_search", 0.22),
    ("organic_search", 0.18),
    ("direct", 0.18),
    ("partner_referral", 0.12),
)

DEVICES = (
    ("mobile", 0.62),
    ("desktop", 0.30),
    ("tablet", 0.08),
)

BROWSER_BY_DEVICE = {
    "mobile": (("chrome", 0.46), ("safari", 0.42), ("samsung_internet", 0.12)),
    "desktop": (("chrome", 0.64), ("edge", 0.20), ("safari", 0.10), ("firefox", 0.06)),
    "tablet": (("safari", 0.58), ("chrome", 0.42)),
}

RISK_BANDS = ("low", "moderate", "elevated", "high")

# Conditional on income_band, in RISK_BANDS order. Synthetic segment, not a credit model.
RISK_GIVEN_INCOME = {
    "lt_30k": (0.10, 0.30, 0.36, 0.24),
    "30k_50k": (0.16, 0.34, 0.32, 0.18),
    "50k_75k": (0.26, 0.38, 0.24, 0.12),
    "75k_100k": (0.34, 0.38, 0.20, 0.08),
    "100k_150k": (0.42, 0.36, 0.16, 0.06),
    "gte_150k": (0.48, 0.34, 0.13, 0.05),
}

# Reach probabilities. Channel effects stop before bank-connection completion.
P_PERSONAL = {"social_prospecting": 0.58, "other": 0.88}
P_BANK_START = {"social_prospecting": 0.72, "other": 0.93}
P_SUBMIT_GIVEN_IDENTITY = {"social_prospecting": 0.70, "other": 0.94}

# Bank connection. Keys are (segment, variant). segment is mobile_safari or other.
# Completion is not drawn on its own: a first failure, then an optional recovery.
P_BANK_FAIL = {
    ("other", "control"): 0.22,
    ("other", "treatment"): 0.12,
    ("mobile_safari", "control"): 0.70,
    ("mobile_safari", "treatment"): 0.55,
}
P_BANK_RECOVER = {
    ("other", "control"): 0.30,
    ("other", "treatment"): 0.50,
    ("mobile_safari", "control"): 0.20,
    ("mobile_safari", "treatment"): 0.32,
}
P_SECOND_BANK_FAIL_IF_RECOVER = 0.30
P_SECOND_BANK_FAIL_IF_ABANDON = 0.45

P_IDENTITY_START = 0.98
P_ID_FAIL = {"tablet": 0.55, "other": 0.10}
P_ID_RECOVER = {"tablet": 0.35, "other": 0.55}
P_SECOND_ID_FAIL_IF_RECOVER = 0.25
P_SECOND_ID_FAIL_IF_ABANDON = 0.40

P_APPROVE = {
    "early": {"low": 0.76, "moderate": 0.52, "elevated": 0.24, "high": 0.07},
    "late": {"low": 0.78, "moderate": 0.58, "elevated": 0.48, "high": 0.18},
}
P_REFER_IF_NOT_APPROVED = 0.24

P_MANUAL = {"low": 0.04, "moderate": 0.09, "elevated": 0.16, "high": 0.26}
P_MANUAL_QUICK = 0.12
# A thin right tail on the auto path, so long decisions are not a hard partition.
P_AUTO_DELAYED = 0.02

# Vehicle selection given approval, before the volume-channel multiplier.
P_VEHICLE = {
    "early": {"low": 0.86, "moderate": 0.86, "elevated": 0.78, "high": 0.70},
    "late": {"low": 0.80, "moderate": 0.80, "elevated": 0.42, "high": 0.30},
}
SOCIAL_VEHICLE_MULTIPLIER = 0.68

P_CONTRACT = 0.88
P_CONTRACT_LATE_MARGINAL = 0.72
SOCIAL_CONTRACT_MULTIPLIER = 0.85

P_STIP_BASE = 0.10
P_STIP_LATE_CORE = 0.14
P_STIP_LATE_MARGINAL = 0.50
P_STIP_SOCIAL_FLOOR = 0.24
P_FUND_IF_STIP = 0.55
P_FUND_IF_CLEAR = 0.95

# Duration medians in minutes. Sigma is the lognormal shape.
DURATION_SIGMA = 0.35
D_PERSONAL = (7.0, 0.35, 0.5)
D_TO_BANK = (2.5, 0.35, 0.4)
D_BANK_GAP = (3.0, 0.30, 0.4)
D_TO_IDENTITY = (1.5, 0.30, 0.3)
D_IDENTITY = (5.5, 0.35, 0.8)
D_IDENTITY_FRICTION = (26.0, 0.30, 8.0)
D_IDENTITY_FAIL_GAP = (3.5, 0.30, 0.5)
D_IDENTITY_FAIL_GAP_FRICTION = (8.0, 0.30, 1.5)
D_TO_SUBMIT = (8.0, 0.35, 1.0)
D_PRE_UW = (1.2, 0.25, 0.5)
D_DECISION_AUTO = (18.0, 0.40, 6.0)
D_DECISION_AUTO_DELAYED = (30.0 * 60.0, 0.35, 10.0 * 60.0)
D_DECISION_MANUAL = (36.0 * 60.0, 0.40, 8.0 * 60.0)
D_DECISION_MANUAL_QUICK = (90.0, 0.35, 30.0)
D_TO_VEHICLE = (12.0 * 60.0, 0.45, 30.0)
D_TO_CONTRACT_START = (40.0, 0.40, 5.0)
D_CONTRACT = (25.0, 0.35, 4.0)
D_TO_FUNDING = (6.0 * 60.0, 0.40, 20.0)
D_FUNDING = (16.0 * 60.0, 0.40, 60.0)
PRE_UW_MAX_SECONDS = 180

APPLICATION_STATUSES = (
    "started",
    "personal_info_completed",
    "bank_connection_started",
    "bank_connected",
    "identity_verified",
    "submitted",
    "approved",
    "referred",
    "declined",
    "vehicle_selected",
    "contracted",
    "funded",
)

DECISIONS = ("approved", "referred", "declined")
DECISION_PATHS = ("auto", "manual")
FUNDING_STATUSES = ("funded", "not_funded")

EVENT_NAMES = (
    "application_started",
    "personal_info_completed",
    "bank_connection_started",
    "bank_connection_failed",
    "bank_connected",
    "identity_verification_started",
    "identity_verification_failed",
    "identity_verified",
    "application_submitted",
    "underwriting_started",
    "manual_review_started",
    "decision_approved",
    "decision_declined",
    "decision_referred",
    "vehicle_selected",
    "contract_started",
    "contract_signed",
    "funding_started",
    "loan_funded",
)

SINGLETON_EVENTS = tuple(
    name
    for name in EVENT_NAMES
    if name not in ("bank_connection_failed", "identity_verification_failed")
)

# Stage rank for timestamp order. Failure events sit inside their stage.
EVENT_STAGE_RANK = {
    "application_started": 10,
    "personal_info_completed": 20,
    "bank_connection_started": 30,
    "bank_connection_failed": 40,
    "bank_connected": 50,
    "identity_verification_started": 60,
    "identity_verification_failed": 70,
    "identity_verified": 80,
    "application_submitted": 90,
    "underwriting_started": 100,
    "manual_review_started": 110,
    "decision_approved": 120,
    "decision_referred": 120,
    "decision_declined": 120,
    "vehicle_selected": 130,
    "contract_started": 140,
    "contract_signed": 150,
    "funding_started": 160,
    "loan_funded": 170,
}

BANK_ERROR_CODES = (
    "session_timeout",
    "institution_unavailable",
    "credential_rejected",
    "user_abandoned",
)
IDENTITY_ERROR_CODES = (
    "document_unreadable",
    "selfie_mismatch",
    "session_expired",
    "user_abandoned",
)

FAILURE_EVENTS = ("bank_connection_failed", "identity_verification_failed")

TABLE_NAMES = (
    "applicants",
    "applications",
    "events",
    "underwriting_decisions",
    "funding_events",
    "experiments",
)

APPLICANT_COLUMNS = (
    "applicant_id",
    "created_at",
    "age_band",
    "income_band",
    "employment_type",
    "state",
    "returning_user",
)
APPLICATION_COLUMNS = (
    "application_id",
    "applicant_id",
    "started_at",
    "submitted_at",
    "decision_at",
    "contracted_at",
    "funded_at",
    "acquisition_channel",
    "device_type",
    "browser",
    "application_status",
    "underwriting_path",
    "experiment_variant",
)
EVENT_COLUMNS = (
    "event_id",
    "applicant_id",
    "application_id",
    "session_id",
    "event_timestamp",
    "event_name",
    "device_type",
    "browser",
    "acquisition_channel",
    "experiment_variant",
    "error_code",
)
DECISION_COLUMNS = (
    "application_id",
    "decision_timestamp",
    "decision",
    "decision_path",
    "manual_review_flag",
    "decision_duration_minutes",
    "risk_band",
)
FUNDING_COLUMNS = (
    "application_id",
    "funding_status",
    "funding_timestamp",
    "funding_duration_hours",
    "stipulation_flag",
)
EXPERIMENT_COLUMNS = (
    "application_id",
    "experiment_name",
    "variant",
    "assigned_at",
)

COLUMNS = {
    "applicants": APPLICANT_COLUMNS,
    "applications": APPLICATION_COLUMNS,
    "events": EVENT_COLUMNS,
    "underwriting_decisions": DECISION_COLUMNS,
    "funding_events": FUNDING_COLUMNS,
    "experiments": EXPERIMENT_COLUMNS,
}


def _pairs(spec: tuple[tuple[str, float], ...], name: str) -> tuple[tuple[str, ...], tuple[float, ...]]:
    labels = tuple(item[0] for item in spec)
    probs = tuple(float(item[1]) for item in spec)
    total = sum(probs)
    if abs(total - 1.0) > 1e-12:
        raise ValueError(f"{name} probabilities sum to {total}")
    return labels, probs


def _check_named_probs(table: dict, name: str) -> None:
    for key, probs in table.items():
        total = float(sum(probs))
        if abs(total - 1.0) > 1e-12:
            raise ValueError(f"{name}[{key}] sums to {total}")


AGE_LABELS, AGE_PROBS = _pairs(AGE_BANDS, "AGE_BANDS")
INCOME_LABELS, INCOME_PROBS = _pairs(INCOME_BANDS, "INCOME_BANDS")
EMPLOYMENT_LABELS, EMPLOYMENT_PROBS = _pairs(EMPLOYMENT_TYPES, "EMPLOYMENT_TYPES")
STATE_LABELS, STATE_PROBS = _pairs(STATES, "STATES")
CHANNEL_LABELS, CHANNEL_PROBS = _pairs(CHANNELS, "CHANNELS")
DEVICE_LABELS, DEVICE_PROBS = _pairs(DEVICES, "DEVICES")

_check_named_probs(RISK_GIVEN_INCOME, "RISK_GIVEN_INCOME")
for _device, _browsers in BROWSER_BY_DEVICE.items():
    _total = sum(prob for _, prob in _browsers)
    if abs(_total - 1.0) > 1e-12:
        raise ValueError(f"BROWSER_BY_DEVICE[{_device}] sums to {_total}")

if N_APPLICANTS <= 0 or N_REPEAT_APPLICATIONS <= 0:
    raise ValueError("applicant and repeat counts must be positive")
if not (APPLICATION_COUNT_TOLERANCE[0] <= N_APPLICATIONS <= APPLICATION_COUNT_TOLERANCE[1]):
    raise ValueError("N_APPLICATIONS is outside the documented tolerance")
