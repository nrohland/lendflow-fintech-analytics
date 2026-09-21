PYTHONPATH := scripts
export PYTHONPATH

VENV := .venv
PY := $(VENV)/bin/python

export LENDFLOW_PARQUET_ROOT := $(CURDIR)/data/synthetic
export LENDFLOW_DUCKDB := $(CURDIR)/transform/target/lendflow.duckdb
export LENDFLOW_EXPORT_ROOT := $(CURDIR)/data/marts
export DO_NOT_TRACK := 1
export DBT_SEND_ANONYMOUS_USAGE_STATS := false

.PHONY: install generate check data dbt-build dbt-parse dbt-export marts dbt-checkpoint dbt-doctor

install:
	python3 -m venv $(VENV)
	$(PY) -m pip install --upgrade pip
	$(PY) -m pip install -r requirements.txt

generate:
	$(PY) -m lendflow_synth

check:
	$(PY) scripts/check_synthetic_data.py

data: generate check

dbt-build:
	$(VENV)/bin/dbt build --project-dir transform --profiles-dir transform --vars '{parquet_root: $(LENDFLOW_PARQUET_ROOT)}'

dbt-parse:
	$(VENV)/bin/dbt parse --project-dir transform --profiles-dir transform --vars '{parquet_root: $(LENDFLOW_PARQUET_ROOT)}'

dbt-export:
	$(PY) scripts/export_marts.py

marts: dbt-build dbt-export

dbt-checkpoint: dbt-parse
	$(VENV)/bin/pre-commit run --all-files

dbt-doctor: dbt-parse
	npx --yes dbt-doctor@0.3.4 transform --offline --full --preset default --lint --fail-on none --manifest target/manifest.json
