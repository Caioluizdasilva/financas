# Finanças

**Finanças** is a personal finance management web app (PWA) built to help people organize their money, plan monthly expenses, track debts and goals, and make more informed financial decisions.

The project is designed for everyday use on desktop and mobile devices. Its interface is in Brazilian Portuguese (pt-BR), and it uses a clean, responsive layout.

## Features

### Personal finance management
- Monthly financial overview with income, expenses, balances, reserves, and planned investments.
- Calendar for tracking due dates and scheduled financial events.
- Monthly planning, recurring bills, subscriptions, and installment tracking.
- Debt management, payment history, and repayment planning.
- Financial goals and plans, including contributions and progress tracking.
- Bank and account management.
- Annual financial projections and spending breakdowns.
- Local data export and import for backups.

### Financial intelligence and planning
- Rule-based financial insights and alerts based on recorded income, expenses, debt balances, and category budgets.
- Monthly spending limits by category, with threshold alerts.
- What-if simulator for savings goals and debt-payment prioritization, including a user-entered estimate of possible delay charges.
- Net-worth overview combining manually registered assets, the latest month's reserves/investments, and outstanding debts.
- CSV and OFX bank-statement import with a review step and basic duplicate detection before adding transactions.
- Existing recurring subscriptions, monthly calendar, and payment reminders remain available.
- Annual and monthly reports with CSV, PDF, and full JSON backup options.

> **Simulation and import notes:** Debt scenarios are estimates only and never change real debt records. Delay interest/fees must be checked against the creditor's contract. Statement imports are not a bank connection; review the preview carefully before confirming. CSV formats vary between institutions, so some files may need adjustment.

### Investments
- A dedicated investment dashboard for people who are learning how to invest.
- Reference indicators from the Central Bank of Brazil (BCB): Selic target rate, CDI, and IPCA.
- Automatic data refresh when the app starts, with a 24-hour cache, plus a manual refresh option.
- A scenario calculator to compare estimated outcomes for a CDB linked to CDI, Tesouro Selic, and savings.
- Beginner-friendly explanations of key concepts such as Selic, CDI, IPCA, CDB, Tesouro Direto, liquidity, FGC protection, and gross vs. net returns.
- Guidance on evaluating liquidity, credit risk, taxes, fees, investment horizon, and personal goals.

> **Important:** Investment calculations are educational estimates, not investment offers or personalized financial advice. The initial calculator uses simplified assumptions and does not represent live quotes from banks or brokerages. Always check the product's official terms, current rates, taxes, fees, liquidity, and issuer risk before investing. Past or estimated returns do not guarantee future results.

## Data sources

The investment dashboard currently retrieves reference time series from the **Central Bank of Brazil (Banco Central do Brasil)** public API (SGS):
- Series 432 — Selic target rate.
- Series 4389 — CDI rate.
- Series 433 — IPCA.

The displayed series can have different reference dates and publication schedules. The dashboard shows the date associated with each returned observation.

Useful references:
- [Central Bank of Brazil — Open Data](https://dadosabertos.bcb.gov.br/)
- [BCB SGS API documentation](https://dadosabertos.bcb.gov.br/dataset/seriehistorica)
- [ANBIMA Data](https://data.anbima.com.br/)
- [Tesouro Direto](https://www.tesourodireto.com.br/)
- [FGC — Credit Guarantee Fund](https://www.fgc.org.br/)

The app does not yet aggregate real-time, individually available CDB, LCI, or LCA offers from financial institutions. A simulated CDB percentage of CDI is an input for comparison, not a verified market offer.

## Technology

- HTML
- CSS
- Vanilla JavaScript
- Progressive Web App (PWA)
- Supabase integration for cloud authentication/synchronization when configured
- Browser storage for local app data and cached reference indicators

There is no frontend build step or package installation required for the static app. Third-party files the app needs to start (the Supabase client and the Poppins font) are kept in the repository so the installed PWA also opens without internet.

## Cloud sync

Each device remembers which version of your data it loaded. A save only replaces the cloud copy if it is still that same version, so a device with outdated data can never overwrite changes made on another one. If that happens, the app asks which version to keep. When you return to a tab that has no unsaved changes, it picks up changes made elsewhere automatically. Changes made while offline are sent as soon as the connection returns, and the browser warns before closing a tab with unsaved changes.

## Tests

```bash
node scripts/check-app.mjs           # syntax + every file needed offline is cached by sw.js
node --test tests/unit/*.test.mjs    # financial calculations (no browser needed)
python3 tests/sync/sync_test.py      # cloud sync and offline startup in a real browser
```

The browser tests need `pip install playwright` and Chrome (or `python -m playwright install chromium`). They use a simulated Supabase (`tests/mock-supabase.js`) with sample data (`tests/fixtures/state.json`), never your real account. The first two commands and the sync tests run on GitHub for every push and pull request.

To check that a CSS change does not alter the look of the app, capture every screen before and after and compare them pixel by pixel:

```bash
python3 tests/visual/shoot.py <folder-before> /tmp/before
python3 tests/visual/shoot.py . /tmp/after
python3 tests/visual/compare.py /tmp/before /tmp/after /tmp/diff
```

The captures cover all screens, dialogs, the sign-in page and the admin area, in light and dark themes, at desktop, laptop, tablet and phone sizes.

## Run locally

You can serve the project with Python:

```bash
python3 -m http.server 8000
```

Then open [http://localhost:8000](http://localhost:8000).

You can also use any static web server that serves the project files from the repository root.

## Deploy with GitHub Pages

1. Push the project files to the root of a GitHub repository.
2. Open **Settings → Pages**.
3. Select **Deploy from a branch**.
4. Choose the `main` branch and the `/(root)` folder.
5. Save and wait for GitHub Pages to publish the site.
6. Open the published URL on desktop or mobile. On mobile, use the browser's **Add to Home Screen** option to install the PWA.

## Project structure

- `index.html` — app shell and script/style references.
- `app.js` — application logic, navigation, views, forms, calculations, and investment dashboard.
- `style.css` — responsive interface styles and themes.
- `seed.js` — initial data and default configuration.
- `auth.js` — optional Supabase authentication and cloud integration.
- `manifest.webmanifest` and `sw.js` — PWA metadata and service worker (list new files the app needs to start in its `FILES`).
- `assets/` — local visual assets, including bank icon font files and the Poppins font.
- `vendor/` — pinned copy of the Supabase browser client.
- `tests/` — calculation, sync and visual tests (see above).
- `scripts/` — repository checks and the CSS consolidation tool.

## Privacy and backups

Financial information is sensitive. Keep your account credentials private and use the app's export feature to create backups. If cloud synchronization is enabled, review the Supabase project configuration and its access policies before storing personal financial data.

## Contributing

Issues and pull requests are welcome. Please describe the problem, the expected behavior, and the steps to reproduce bugs. For changes involving financial calculations, include the assumptions and data source so the results can be reviewed.

## Disclaimer

This project is a personal finance organization and educational tool. It is not a bank, broker, investment adviser, or substitute for professional financial guidance. Users are responsible for checking official product documentation and deciding whether an investment is suitable for their circumstances.
