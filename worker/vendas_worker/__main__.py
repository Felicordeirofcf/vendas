"""Execução avulsa: python -m vendas_worker telegram|conversions (ex.: Render Cron Job)."""
import json
import sys

from .app import run_job

if __name__ == "__main__":
    name = sys.argv[1] if len(sys.argv) > 1 else ""
    if name not in ("telegram", "conversions"):
        sys.exit("uso: python -m vendas_worker telegram|conversions")
    print(json.dumps(run_job(name), ensure_ascii=False))
