"""Загрузка конфигов из папки config/ в корне репозитория."""
from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[2]
CONFIG_DIR = Path(os.environ.get("ASTRO_CONFIG_DIR", ROOT / "config"))
DB_PATH = os.environ.get("ASTRO_DB", str(ROOT / "backend" / "astro.db"))


def load_yaml(path: Path) -> dict:
    with open(path, encoding="utf-8") as f:
        return yaml.safe_load(f)


@dataclass
class Config:
    thresholds: dict
    crew: dict
    scenarios: dict[str, dict]
    protocols: dict[str, dict]
    rule_to_protocol: dict[str, str] = field(default_factory=dict)


def load_config(config_dir: Path = CONFIG_DIR) -> Config:
    scenarios = {}
    for p in sorted((config_dir / "scenarios").glob("*.yaml")):
        data = load_yaml(p)
        scenarios[data["id"]] = data
    protocols = {}
    rule_to_protocol = {}
    for p in sorted((config_dir / "protocols").glob("*.yaml")):
        data = load_yaml(p)
        protocols[data["id"]] = data
        for rule in data.get("rules", []):
            rule_to_protocol[rule] = data["id"]
    return Config(
        thresholds=load_yaml(config_dir / "thresholds.yaml"),
        crew=load_yaml(config_dir / "crew.yaml"),
        scenarios=scenarios,
        protocols=protocols,
        rule_to_protocol=rule_to_protocol,
    )
