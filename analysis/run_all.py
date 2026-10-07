"""Run the full pipeline: fetch data, audit, label experiments, figures, LaTeX tables."""
from __future__ import annotations

import time

import audit
import figures
import labels
import tables
from common import WEB_DATA, load


def main() -> None:
    t0 = time.time()
    df = load()
    print(f"Loaded {len(df):,} patient-years")
    print("Audit ...")
    audit.run(df)
    print("Label-choice experiment ...")
    labels.run(df)
    print("Figures ...")
    figures.run()
    print("Tables ...")
    tables.run()
    size = sum(p.stat().st_size for p in WEB_DATA.glob("*.json"))
    assert size < 600_000, f"site data too large: {size} bytes"
    print(f"Done in {time.time() - t0:.0f}s; site data {size / 1000:.0f} kB")


if __name__ == "__main__":
    main()
