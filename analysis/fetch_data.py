"""Download the public synthetic dataset released with Obermeyer et al. (2019).

The file is published by the authors at gitlab.com/labsysmed/dissecting-bias.
It carries no explicit licence, so it is fetched on demand into data/raw/
(which is git-ignored) and never redistributed with this repository.
"""
from __future__ import annotations

import hashlib
import sys
import urllib.request
from pathlib import Path

URL = "https://gitlab.com/labsysmed/dissecting-bias/-/raw/master/data/data_new.csv"
ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "data" / "raw" / "data_new.csv"


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def fetch(force: bool = False) -> Path:
    RAW.parent.mkdir(parents=True, exist_ok=True)
    if RAW.exists() and not force:
        return RAW
    print(f"Downloading {URL}")
    tmp = RAW.with_suffix(".part")
    urllib.request.urlretrieve(URL, tmp)
    tmp.replace(RAW)
    print(f"Saved {RAW.relative_to(ROOT)} ({RAW.stat().st_size / 1e6:.1f} MB, sha256 {sha256(RAW)[:12]}…)")
    return RAW


if __name__ == "__main__":
    fetch(force="--force" in sys.argv)
