# SynChain Gemini and transactional email

The global Copilot button opens a conversation grounded in the current database
snapshot. Reports opens deterministic insights first; **Generate AI report** adds
a Gemini narrative for the selected focus. Findings include the source metrics,
snapshot time, data limitations and whether Gemini or local rules produced them.
The report can be downloaded without generating it again.

## Configuration

Keep credentials only in the ignored `backend/.env` file or server environment.
Never add them to Vite variables or commit them. The existing numbered entries
`GEMINI_API_KEY_1` through `GEMINI_API_KEY_5` work unchanged. Alternatively set
`GEMINI_API_KEY`, or a comma-separated `GEMINI_API_KEYS`. All populated Gemini
entries are deduplicated. The unrelated `AI_PROVIDER_KEY` is deliberately ignored.
Restart the backend after changing credentials or models. `.env.example` lists
all supported request, timeout and SMTP settings. No migration is needed.

`GEMINI_MODEL` selects the chatbot model; `GEMINI_REPORT_MODEL` selects the report
model. Both default to `gemini-2.5-flash`, using Google's async HTTPS
`generateContent` API through the existing `httpx` dependency. Reports use
`responseJsonSchema` and are validated again with Pydantic. Use a model supporting
structured output for reports; change the configured model when its availability
changes. See [Google's model catalog](https://ai.google.dev/gemini-api/docs/models)
and [GenerateContent API](https://ai.google.dev/api/generate-content).

## Pool behavior and limits

- Requests rotate among healthy credentials. Duplicate credentials are not counted twice.
- Rejected credentials are disabled until restart; transient failures have bounded
  failover and increasing cooldown. No request forces a cooling key into service.
- A provider `429` pauses the entire pool and honors `Retry-After`/`RetryInfo`.
  [Google quotas apply per project, not per key](https://ai.google.dev/gemini-api/docs/rate-limits).
  Rotation does not increase quota or prevent security breaches.
- Chat and report generation share a per-process requests-per-minute budget,
  concurrency cap, overall deadline and output-token cap. Set the local budget
  below your project's limits. Google still enforces model, token and daily quotas.
- Local limits and cooldowns are in memory. Multiple worker processes or replicas
  need a shared gateway/rate limiter and coordinated project budgets before scaling.
- Missing keys, provider errors, incomplete/safety-blocked responses and invalid
  reports produce explicitly labeled local responses. Database failures produce
  `503`; missing source data is not replaced with fabricated records.

## Data and authorization

The new chatbot and AI report/insight endpoints require an active signed-in user.
The snapshot contains bounded numeric aggregates from canonical inventory,
suppliers, products, warehouses and shipments. These entities are currently shared
workspace data in SynChain's schema; this feature does not introduce tenant
isolation. User-owned orders, imports, integrations, contacts and credentials are
excluded. Only chat text, bounded conversation history and the aggregate snapshot
are sent to Gemini. Client-provided metric values are ignored. No model tools can
modify data, send emails or run simulations.

The conversation stays in browser memory and clears when the signed-in layout is
unmounted. AI prose remains advisory; schema validation and valid evidence links
do not prove every generated claim. Compare claims with the attached metric values.
Reports are not persisted in the database; use the screen's download control to
retain a snapshot.

Authenticated API routes (under `/api/v1`):

| Route | Behavior |
| --- | --- |
| `POST /copilot/chat` | `{message, history?, context?}`; returns reply, provenance, sources, status and retry information. Existing `text`, `sender`, `timestamp` fields remain available. |
| `GET /ai/insights?focus=overview` | Deterministic evidence-based insights; no provider call. |
| `POST /ai/reports/generate` | `{focus: "overview" \| "inventory" \| "suppliers" \| "shipments"}`; validated report or labeled fallback. |

Chat accepts at most 4,000 characters per message/history turn, 20 history turns,
24,000 history characters and 4,096 characters of optional context. It accepts
only `user`/`assistant` history roles. `context.current_page` is an allowlisted UI
hint, never evidence. Authentication and request validation happen on the server.

## Email

Configure `SMTP_HOST`, `SMTP_USERNAME` (or legacy `SMTP_USER`), `SMTP_PASSWORD`,
`SMTP_FROM_EMAIL` and `FRONTEND_URL`. Port 465 uses implicit TLS; other ports,
including 587, require STARTTLS. Certificates are always validated. Account links
require an HTTPS frontend URL except localhost development. Each message includes
plain text and escaped HTML, with URL-encoded tokens.

SMTP initializes lazily, so missing mail configuration does not prevent application
startup. Results distinguish relay acceptance, permanent rejection, configuration
failure and uncertain delivery. Only safe transient failures are retried. An
uncertain send is not retried automatically to avoid duplicate messages. Accepted
means the SMTP relay accepted the message, not that it reached an inbox.

`POST /auth/resend-verification` now creates a hashed, expiring token and queues an
actual verification message. A per-user one-minute cooldown limits repeated
requests. Public auth responses remain generic to avoid account enumeration.
The diagnostic `/test/test-email` endpoint requires an active administrator and
can only target that administrator's own address. No report is emailed automatically.

## Verification

Run the isolated no-network suite without provisioning PostgreSQL or sending mail:

```powershell
cd backend
python -m pytest unit_tests -q -p no:cacheprovider
```

These tests cover pool rotation/quotas/concurrency, credential-safe failures,
chat authorization/grounding/validation, report schemas/metrics, and SMTP and
verification resends. The pre-existing `backend/tests` suite provisions a separate
PostgreSQL schema and requires a working database connection.

```powershell
cd synchain-frontend
npm run build
```
