# Nexora

**Create. Collaborate. Do more with AI.** — an all-in-one AI workspace with 13 tools, a personal workspace, real-time collaboration, Stripe billing and a full admin console.

```
backend/    Express · TypeScript · MongoDB (Mongoose) · Socket.IO · Stripe · Cloudinary   → Render
frontend/   React 18 · Vite · TypeScript · Tailwind · Framer Motion · TanStack Query       → Vercel
.github/    CI (lint · typecheck · test · build · audit · secret scan) + gated deploy
```

## Quick start

Requirements: Node ≥ 18.18 (22 recommended) and MongoDB (local Docker or Atlas).

```bash
docker compose up -d mongo                 # or use an Atlas URI
cp backend/.env.example backend/.env       # fill in values (see below)
cp frontend/.env.example frontend/.env     # leave empty in dev (Vite proxies /api)
npm run install:all
npm run dev:api                            # http://localhost:5000  (GET /health)
npm run dev:web                            # http://localhost:5173
```

No provider keys yet? Set `AI_MOCK=true` in `backend/.env`. Every tool then returns clearly-labelled simulated output so you can click through the entire product. Turn it off for real generations.

Admin console: `/admin/login` using `ADMIN_EMAIL` / `ADMIN_PASSWORD` from the environment. There is no admin registration route.

## Environment

| Variable | Purpose |
|---|---|
| `MONGODB_URI` | Database |
| `CLIENT_URL`, `CORS_EXTRA_ORIGINS` | Allowed browser origins (credentials are sent) |
| `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` | ≥ 32 random chars. The API refuses to boot in production with defaults |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | Single admin account (env-only) |
| `OPENROUTER_API_KEY`, `GROQ_API_KEY`, `HF_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN`, `CLIPDROP_API_KEY` | The five providers. **No model names are configured** — models are discovered live (see below) |
| `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRO_PRICE_ID` | Billing (use **test** keys first) |
| `CLOUDINARY_*` | Binary storage. Without it, files fall back to local `backend/storage/` (dev only) |
| `CREDIT_RESET_OFFSET_MINUTES` | Daily-reset boundary offset from UTC (330 = IST midnight) |
| `ATLAS_VECTOR_SEARCH`, `ATLAS_VECTOR_INDEX` | Optional Atlas Vector Search for PDF AI (see below) |
| `VITE_API_URL` (frontend) | API base URL in production, e.g. `https://nexora-api.onrender.com` |

### Stripe

```bash
# 1. put sk_test_… in backend/.env, then create the ₹400/month product + price:
npm run stripe:setup            # prints STRIPE_PRO_PRICE_ID=price_…
# 2. forward webhooks locally:
stripe listen --forward-to localhost:5000/api/billing/webhook   # prints STRIPE_WEBHOOK_SECRET
```
Webhook events handled: `checkout.session.completed`, `customer.subscription.created|updated|deleted`, `invoice.payment_succeeded|paid`, `invoice.payment_failed`. **The plan changes only inside the verified webhook** — never from the browser redirect. Replayed events are ignored (idempotency ledger). Test card: `4242 4242 4242 4242`.

## What is built

**13 tools** — AI Writer, Resume & Cover AI, Code Assistant, PDF AI (RAG with page citations), AI Agent (planned multi-step with live status), Text→Speech, Speech→Text (upload or record), Image→Text (upload or URL), Background Remover, Image Enhancer (before/after slider), Data Analyzer (stats + charts + AI insights), Text→Image, Video→Text.
Free: Writer, Resume, Code, PDF AI, Agent. Everything else is Pro (₹400/mo). No text-to-video.

**Product** — cinematic first-visit intro, 15-section landing page, onboarding, dashboard, workspace (artifacts, uploads, favorites, shared), collaboration (viewer/editor), history with export (PDF/JSON), billing, profile/security, support (reports + real-time chat), notifications.

**Admin** — Dashboard · Users (detail, credits, plan, deactivate, delete) · AI Management (provider health, fallbacks, failed generations) · Billing (+ plans & credit costs editor) · Support (reports + live chat) · Communication (announcements, scheduling) · Analytics (+ PDF export) · System (errors, activity, settings, audit logs).

## Architecture notes

- **Dynamic model discovery** (`backend/src/services/providers/catalog.ts` + one adapter per provider): there are no hardcoded model names. On each request Nexora asks the provider what is available *right now* — OpenRouter `/models` (free = both token prices exactly 0, filtered by input/output modality), Groq `/models` (exactly what your key can access), Cloudflare Workers AI model search (per task, deprecated/LoRA skipped, request shaped from each model's own input schema) and the Hugging Face hub (models an inference provider currently serves, gated repos skipped). Lists are cached for 10 minutes, ranked by a size/instruct heuristic, and the adapter walks down the list: a 404/429/timeout/empty answer moves to the next model; a bad key or exhausted credits stops that provider so the router falls back to the next one. Dead models are remembered for 30 minutes; there is an overall 100-second budget per request. PDF AI pins each document to the embedding model that indexed it (falling back to keyword ranking if that model is unreachable).
  - OpenRouter free models require *Settings → Privacy → allow free endpoints that may publish prompts*; otherwise every free model answers 404 "data policy".

- **Provider router** (`backend/src/services/providerRouter.ts`): each tool has an ordered provider list (as specified). Capability-aware, with an in-process circuit breaker, health metrics in MongoDB, and full attempt logs. A fallback still counts as **one** generation and is charged **once**; if every provider fails, nothing is charged.
- **Credits** (`credit.service.ts`): validate → atomically *reserve* → run → persist → *commit* (single transaction record) or *release*. Concurrent requests cannot overspend. Free credits **reset** (never accumulate) at the configured midnight; Pro gets a monthly grant. Every change is a `CreditTransaction`.
- **Access control**: plan checks, ownership checks and collaboration roles are enforced on the server for every route. The UI lock screens are convenience only.
- **PDF AI**: PDFs are parsed per page, chunked with overlap, embedded (Hugging Face → Cloudflare → deterministic local embedder), and retrieved with Atlas `$vectorSearch` when enabled, otherwise exact cosine ranking scoped to the owner.  
  Atlas index definition (collection `docchunks`, name = `ATLAS_VECTOR_INDEX`): fields `embedding` (`knnVector`/`vector`, dims 384 for the HF model) plus filter fields `documentId`, `ownerId`.
- **Account recovery without email**: a one-time recovery code is shown at sign-up (only its hash is stored). Email + code → short-lived reset token → new password (which rotates the code and revokes sessions).
- **Sessions**: 15-minute access cookie + 7-day refresh cookie (httpOnly, `SameSite=None; Secure` in production), token versioning for instant revocation, lockout after repeated failures. State-changing requests require a custom `X-Nexora-Client` header (CORS allow-list gates it) as CSRF defence.
- **Security**: Helmet, strict CORS, rate limits (global/auth/AI/upload), Mongo-operator stripping + Zod validation on every input, magic-byte file validation, SSRF guard on server-side URL fetches, prompt-injection fencing for untrusted content, centralised error handler with no internals leaked, secrets only in env, audit log for admin actions.

## Testing

```bash
npm test          # backend (Jest + supertest) and frontend (Jest + Testing Library)
npm run lint
npm run build
```
Backend tests cover provider routing/fallback/circuit breaker, credit reservation & daily reset, auth/session/admin separation, Pro enforcement, CSRF, Stripe webhook signature/idempotency/upgrade/downgrade, SSRF, file sniffing, sanitization, RAG chunking/ranking, data analysis and PDF export. They run **without** a database or provider keys. Frontend tests cover route guards, login/register/recovery, onboarding, the intro sequence, pagination, tabs, dialogs and stores.

## Deploy

1. **MongoDB Atlas** → set `MONGODB_URI`.
2. **Render**: create a Web Service from `render.yaml` (root `backend`). Add the secrets. Copy the Deploy Hook URL into the GitHub secret `RENDER_DEPLOY_HOOK`.
3. **Stripe**: add a webhook endpoint `https://<api>/api/billing/webhook` with the events above; put the signing secret in `STRIPE_WEBHOOK_SECRET`.
4. **Vercel**: import the repo with root `frontend`, set `VITE_API_URL`. Add `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` as GitHub secrets for the gated deploy workflow.
5. Set `CLIENT_URL` on the API to the Vercel URL so CORS and cookies work.

## Known limits (honest list)

- Scanned/image-only PDFs have no text layer and are rejected with a clear message (no OCR step yet).
- Data Analyzer accepts CSV/TSV/JSON; `.xlsx` is intentionally excluded to avoid the vulnerable `xlsx` npm package.
- Provider model names change often — they are env-configurable; check each provider’s current free-tier models.
- Collaboration updates are pushed in real time (socket events), but simultaneous edits to the same text are last-write-wins, not CRDT-merged.
- Local-disk storage is for development only; production should use Cloudinary.