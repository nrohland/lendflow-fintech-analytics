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
| `/ask` | Can an analyst ask the governed layer a fixed question? | `product_metrics` and `fct_experiment_results` |

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

`web/vercel.json` sets the Next.js framework. The site is the five routes above, including `/ask`.

No environment variables. Ask LendFlow does not call a model provider, so there is no provider key to set. The route is a static page plus client-side matching over the committed snapshot. Root Directory stays `web`. Build command stays `npm run build`.

## Ask LendFlow

`/ask` is linked from the shell nav. It answers a fixed catalog from the snapshot already imported by the dashboard. The same question returns the same answer. There is no live model.

The catalog covers funnel drop-off, funding conversion by start month, manual-review decision time, the bank-connection experiment (completion among applications that start bank connection, plus guardrails), and the mobile × paid-search funnel. That last question is two published slices. The export has no device-by-channel row, so the page does not estimate the intersection.

A question outside the catalog returns no figure. Read-only SQL on an answer is the select against `marts.product_metrics` or `marts.fct_experiment_results`. The experiment answers also show the compiled `fct_experiment_results` SQL stored on the snapshot. The page does not open DuckDB.

The slice control on the other pages is hidden on `/ask`. Answers name the slice they read.

## What the experiment page will not fill in

`fct_experiment_results.null_rejected_at_alpha` is the alpha 0.05 test. Ship, Iterate, and Do not ship stay unselected while `product_decision` is null. Guardrail rows have no pass or fail flag. The numeric margin for "approximately unchanged" is unset.
