# Medo Copilot: Launch-Readiness Auditor

Medo Copilot audits whether a web app is ready to show customers, not just whether it technically loads. It combines deterministic checks, screenshots, static code analysis, Lighthouse/PageSpeed metrics, and AI review to produce prioritized launch-readiness findings.

## What It Checks

- UX clarity: headline, value proposition, CTA visibility, and mobile readability.
- Trust and conversion: social proof, clear next actions, and friction in the first screen.
- Accessibility and SEO basics: missing titles, meta descriptions, viewport tags, and image alt text.
- Performance: PageSpeed/Lighthouse scores when available.
- Backend/code risk: selected GitHub backend files, static security heuristics, and AI code review when configured.
- Evidence quality: each issue includes confidence and verification metadata.

## Accuracy Positioning

Medo Copilot is an evidence-based assistant, not a guarantee. Customer reports should treat findings as prioritized recommendations:

- Tool-verified findings are safe to present as detected issues.
- Screenshot/text findings are useful but may need product-context review.
- AI-inference findings should be reviewed manually before making strong claims.

Do not market the product as 100% accurate. A safer claim is:

> Medo Copilot provides an evidence-based launch-readiness audit using screenshots, page signals, Lighthouse metrics, static checks, and AI review. Results should be treated as prioritized recommendations and verified before production release.

## Tech Stack

- Next.js 16 App Router
- TypeScript strict mode
- Vercel AI SDK providers
- Playwright screenshot capture
- Cheerio static HTML extraction
- Neon serverless Postgres
- Clerk authentication
- Tailwind CSS and shadcn-style UI

## AI Models

Medo Copilot uses a multi-provider fallback chain for AI analysis:

| Provider | Default Model | Use Case |
|----------|--------------|----------|
| Google Gemini | `gemini-3.6-flash` | Vision analysis (primary) |
| Groq | `qwen/qwen3.6-27b` | Vision fallback (free tier) |
| OpenRouter | `anthropic/claude-3.5-sonnet` | Code analysis |
| Tencent | `tencent/hunyuan-a13b-instruct` | General analysis |
| Poolside | `poolside/laguna-m-1` | Code analysis |
| NVIDIA | `nvidia/llama-3.1-nemotron-70b-instruct` | Code analysis |
| Mimo | `mimo-1` | Alternative model |

Model upgrades are centralized in `src/lib/constants.ts` to handle deprecations in one place.

## Setup

```bash
npm ci
cp .env.example .env.local
npm run dev
```

Required production environment variables:

```env
DATABASE_URL=
ENCRYPTION_MASTER_KEY=64_hex_characters
GOOGLE_GENERATIVE_AI_API_KEY=
```

At least one AI provider key should be configured for production. Optional keys include `GROQ_API_KEY`, `OPENROUTER_API_KEY`, `PAGESPEED_API_KEY`, and `GITHUB_TOKEN`.

`DATABASE_URL` is required in production because audit persistence, user API key storage, and rate limiting all depend on Postgres. Production startup also requires `ENCRYPTION_MASTER_KEY` so stored user keys can be encrypted with AES-256-GCM.

## Database Migrations

Run migrations before deploying production:

```bash
npm run migrate
```

Runtime table creation is disabled in production. Development still creates missing tables for convenience.

## Free Public Launch Limits

The free public launch uses quota limits instead of billing:

- Anonymous users: 3 audit quota units per minute and 8 quota units per hour.
- Signed-in users: 8 audit quota units per minute and 30 quota units per hour.
- A standard URL audit costs 1 quota unit.
- Uploaded screenshot audits add 2 quota units.
- GitHub repository analysis adds 1 quota unit.
- Forced refreshes add 1 quota unit.

These limits protect expensive browser, Lighthouse, GitHub, and AI work while keeping the product usable for public trials. For paid SaaS, add account-level plans, billing enforcement, an audit history dashboard, monitoring alerts, and stronger abuse tooling such as CAPTCHA or Turnstile.

## Verification

Run the standard production checks:

```bash
npm run verify
```

Run browser end-to-end tests:

```bash
npm run test:e2e
```

Run everything:

```bash
npm run verify:full
```

## Deployment Checklist

- Configure `DATABASE_URL`, `ENCRYPTION_MASTER_KEY`, and at least one AI provider key.
- Run `npm run migrate` against the production database before deploy.
- Run `npm run verify`; run `npm run test:e2e` in an environment where Playwright can reach localhost.
- Confirm `/api/user/settings` is protected by Clerk middleware.
- Confirm anonymous report links load only audits with no owner and user-owned reports require the matching signed-in user.
- Confirm public quota limits are acceptable for the launch announcement volume.
- Add monitoring for `/api/analyze` latency, error rate, rate-limit responses, and audit-save failures.

## Customer Report Guidance

Every finding should include:

- Issue title
- Severity
- Confidence
- Evidence
- Evidence type
- Verified-by sources
- Suggested fix

This keeps reports honest: deterministic findings are separated from subjective AI recommendations.
