# LendFlow dashboard

Next.js app in [web/](../web/). It reads a snapshot of the governed mart export. It does not query DuckDB at request time.

Thesis: **Approval isn't the finish line. Funding is.**

Pages:

| Route | Question | Source |
| --- | --- | --- |
| `/` | Are we funding the applications we approve? | `product_metrics` |
| `/funnel` | Where is the friction? | `product_metrics` step rows, plus portfolio cuts |
| `/operations` | Where do underwriting and funding wait? | `product_metrics` |
| `/experiment` | Did bank-connection clarity change completion? | `fct_experiment_results` |

Ask LendFlow is a later contract.

## Where the numbers come from

```text
make marts
  → dbt build
  → scripts/export_marts.py
       data/marts/*.parquet          gitignored facts
       data/marts/metrics.json       gitignored full document, including compiled SQL
       web/src/data/dashboard.json   committed snapshot the app imports
```

`dashboard.json` holds `product_metrics`, `fct_experiment_results`, the stage catalog from `fct_application_funnel`, row counts, the source window, and the compiled SQL for `fct_experiment_results`. `product_decision` stays null. SLA attainment stays `unshipped`.

The app does not recompute rates. Filters are single slices the mart already stores: device, browser, channel, start month, and start week. A device filter does not cross with a channel, because that intersection is not a slice.

`device_browser`, `underwriting_path`, and `risk_band` appear as labeled portfolio cuts. They are not combined with the page filter.

## Local run

From the repository root, with Node 22 and the Python toolchain from [dbt.md](dbt.md):

```bash
make install
make marts
make web-install
make web-dev
```

`make web-dev` serves [http://localhost:3000](http://localhost:3000).

`make marts` rebuilds DuckDB and rewrites `web/src/data/dashboard.json`. Commit that file when the marts change. `data/marts/` stays gitignored.

A production build, without starting the server:

```bash
make web-build
```

No `.env` file is required.

## Vercel

Hobby is enough. The deploy builds static pages from the committed snapshot. It does not run dbt, DuckDB, or a warehouse.

1. Import the GitHub repository.
2. Set **Root Directory** to `web`.
3. Framework preset: Next.js. Build command: `npm run build`. Install command: `npm ci`.
4. Leave environment variables empty.
5. Deploy.

`web/vercel.json` sets the Next.js framework. The site is the four routes above.

## What the experiment page will not fill in

`fct_experiment_results.null_rejected_at_alpha` is the alpha 0.05 test. Ship, Iterate, and Do not ship stay unselected while `product_decision` is null. Guardrail rows have no pass or fail flag. The numeric margin for "approximately unchanged" is unset.
