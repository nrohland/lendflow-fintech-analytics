PYTHONPATH := scripts
export PYTHONPATH

VENV := .venv
PY := $(VENV)/bin/python

.PHONY: install generate check data

install:
	python3 -m venv $(VENV)
	$(PY) -m pip install --upgrade pip
	$(PY) -m pip install -r requirements.txt

generate:
	$(PY) -m lendflow_synth

check:
	$(PY) scripts/check_synthetic_data.py

data: generate check
