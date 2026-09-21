# `data/synthetic/`

These Parquet tables are synthetic. They are not a lender's customers, applications, or decisions. See [docs/data-generation.md](../docs/data-generation.md) for the seed, the regenerate command, and the column rules.

```bash
make install
make data
```

`make data` overwrites this directory and writes `sanity_report.json`.

`make marts` writes a separate export under `data/marts/`. That directory is gitignored. See [docs/dbt.md](../docs/dbt.md).
