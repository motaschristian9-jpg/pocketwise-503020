# Pocketwise — 50/30/20 Allowance Planner

An installable, mobile-first, **offline-first** personal finance app for students. Built with React, Vite and a browser-local ledger. No account required. Inspired by the previous Folio finance app's local-first approach and the supplied product/architecture/HCI playbook.

## Features
- Add an allowance or income whenever it arrives, with automatic 50% Needs, 30% Wants, 20% Savings allocation.
- Record necessary vs optional spending with available-balance validation.
- **Rollover:** When an income is recorded on a later calendar date, positive unused Needs + Wants are pooled with the new income and split again 50/30/20. Existing Savings remain untouched. This is a *redistribution*, not new earnings; the income total excludes the rollover. The rollover journal records the transfer without double-counting money.
- Savings envelope and a **record-only** bank/e-wallet transfer flow (GCash, Maya, banks, cash). This does **not** connect to or send money to a provider.
- Dashboard: balances, allocation cards, last-seven-day income/spending chart, recent activity and contextual guidance.
- AI Coach: deterministic offline budgeting guidance; optional online Gemini model via a Vercel serverless endpoint and an app-ledger retrieval context (lightweight structured-data RAG). No vector database or embeddings are required for this small dataset.
- PWA install, offline caching, dark mode, JSON export/restore and data deletion.

## Deploy to GitHub and Vercel

1. Push the **contents of this folder** to a GitHub repository (not the parent folder or a ZIP). Do not upload `node_modules` or `.env`.
2. In Vercel → Add New → Project → import repository. Framework **Vite**. Build command `npm run build`, output directory `dist`.
3. Deploy. Open HTTPS URL on Chrome Android and use **Install app** / **Add to Home screen**.
4. Optional cloud AI: Vercel Project → Settings → Environment Variables → `GEMINI_API_KEY` = your Gemini API key. Redeploy. Never place the key in Vite variables, frontend files or GitHub. `GEMINI_MODEL` optional (default `gemini-2.5-flash`).
5. Open the site once online to cache assets; test airplane mode and backup/restore.

Run locally: `npm install && npm run dev`. Production build: `npm run build`.

## Privacy, limits and cautions
- Data is stored in browser `localStorage` on this device and origin. Clearing browser/site data may erase it; export a backup regularly. No cloud sync or accounts.
- Offline AI is **rule-based** guidance, not a downloaded language model. Online AI sends the question, recent/matched entries and totals to Gemini through your own Vercel function. No API key is exposed to the browser. For a public deployment, add authentication, rate limits and abuse controls to `/api/coach` before enabling a paid API key; otherwise visitors can use your quota.
- The retrieval mechanism is structured finance-record retrieval, not embedding/vector search. This is a suitable first RAG implementation for small local data.
- The app currently supports **PHP only** and fixed 50/30/20 allocation.
- The app does not connect to real banks or e-wallets, transfer funds, provide regulated advice or guarantee savings.
- The app has no server database. Vercel serves the static frontend and the optional AI function. For Render static hosting, the optional Vercel function won't run without an equivalent backend.
- Rollover occurs **when you add income on a later date**, not automatically at midnight. Same-day incomes are split independently. Leftovers remain in their buckets until the next later-date income. Negative balances are prevented when recording expenses.

## Test checklist
1. Add ₱100: Needs ₱50, Wants ₱30, Savings ₱20.
2. Spend ₱20 from Needs and ₱10 from Wants: Needs ₱30, Wants ₱20, Savings ₱20.
3. On a later date, add ₱100: rollover pool ₱50 + ₱100 = ₱150; allocation ₱75/₱45/₱30. Existing ₱20 savings remains, so balances are Needs ₱75, Wants ₱45, Savings ₱50. (The original scenario's leftover amount can be ₱30 instead; same formula.)
4. Check that recorded income is ₱200, not ₱250.
5. Record a savings transfer: savings envelope decreases, transfer history increases; no actual transfer happens.
6. Disconnect internet: existing app loads after caching; Coach falls back to rule-based tips.
7. Export backup, delete local data, restore backup.

See `docs/` for PRD, TRD, modules and design notes.
