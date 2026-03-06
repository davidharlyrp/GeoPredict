"""
Centralized parameter configuration reader for the backend.

Reads parameters.json (single source of truth) and derives:
- ALL_FIELDS: all parameter keys
- NUMERIC_FEATURES: numeric feature columns for ML
- CATEGORICAL_FEATURES: categorical (select) feature columns for ML
- FEATURE_COLUMNS: all feature columns (input to model)
- TARGET_COLUMNS: all target columns (model outputs)
- PARAMETER_LIST: full list of param dicts for dynamic Pydantic/API use
"""

import os
import json

_CONFIG_PATH = os.path.join(os.path.dirname(__file__), "parameters.json")

with open(_CONFIG_PATH, "r", encoding="utf-8") as f:
    PARAMETER_LIST: list[dict] = json.load(f)

# All field keys
ALL_FIELDS: list[str] = [p["key"] for p in PARAMETER_LIST]

# Features (input to model)
NUMERIC_FEATURES: list[str] = [
    p["key"] for p in PARAMETER_LIST
    if p["role"] == "feature" and p["type"] == "number"
]

CATEGORICAL_FEATURES: list[str] = [
    p["key"] for p in PARAMETER_LIST
    if p["role"] == "feature" and p["type"] == "select"
]

FEATURE_COLUMNS: list[str] = NUMERIC_FEATURES + CATEGORICAL_FEATURES

# Targets (model outputs)
TARGET_COLUMNS: list[str] = [
    p["key"] for p in PARAMETER_LIST
    if p["role"] == "target"
]

# Required fields
REQUIRED_FIELDS: list[str] = [
    p["key"] for p in PARAMETER_LIST
    if p.get("required", False)
]
