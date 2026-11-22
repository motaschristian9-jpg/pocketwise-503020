# Modules and build order

1. **Ledger** — income, expense, savings transfer, integer-cent arithmetic, rollover. Interface: `src/finance.js`.
2. **Dashboard** — live envelope cards, chart, summary, recent activity.
3. **Activity** — filterable ledger and add expense flow.
4. **Savings** — envelope, transfer marking, history, provider labels.
5. **Coach** — local deterministic responses, retrieval, optional serverless AI.
6. **Preferences** — rollover setting, theme, export/restore/delete.
7. **PWA & deployment** — offline shell, manifest, Vercel API.
