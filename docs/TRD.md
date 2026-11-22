# Technical design

- React 19 + Vite 7, CSS design tokens, Recharts, lucide-react.
- Local-first data in localStorage, versioned JSON ledger; append-only events for income, expense, transfer, adjustment and rollover annotations. Amounts are integer centavos.
- `src/finance.js` contains deterministic accounting, retrieval and offline advice. `src/main.jsx` contains UI and flows.
- Vite PWA plugin precaches production assets and supports home-screen installation.
- Optional `api/coach.js` Vercel serverless endpoint calls Gemini with a secret environment variable.
- Structured RAG: retrieve current aggregates, last 20 events and up to 12 question-matched events. Provide as bounded context, with no vector service needed.
- Security: validate inputs, constrain AI prompt length, avoid putting API keys in browser. Production AI needs rate limiting/auth or provider quota controls.
- Limitation: browser storage is device- and origin-specific, subject to clearing and quota; backup is essential.
