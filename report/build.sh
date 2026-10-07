#!/bin/sh
# Build the IEEE report: run analysis/run_all.py first so figures and tables are current.
set -e
cd "$(dirname "$0")"
pdflatex -interaction=nonstopmode -halt-on-error main.tex >/dev/null
bibtex main >/dev/null
pdflatex -interaction=nonstopmode -halt-on-error main.tex >/dev/null
pdflatex -interaction=nonstopmode -halt-on-error main.tex >/dev/null
cp main.pdf MiniProject_EAIDS_Group2.pdf
echo "Wrote report/MiniProject_EAIDS_Group2.pdf"
