# falcondraft-app

`falcondraft-app` is the internal application project for FalconDraft, a premium B2B SaaS foundation for commercial proposal automation. The product vision is simple: create a deal, add commercial context, generate a professional proposal package, validate it, then send it.

This repository currently contains Step 1 only: a clean technical base for the future app at `app.falcondraft.com`. The public marketing website remains separate and will use `falcondraft.com`.

## Stack

- Next.js App Router, React, TypeScript strict
- Tailwind CSS v4 and shadcn/ui
- Framer Motion, GSAP, Lucide React, Recharts
- Supabase-ready auth/data structure
- Drizzle ORM with RLS-ready schema placeholders
- React Hook Form, Zod, TanStack Query, Zustand
- Sonner toasts
- Stripe Billing-ready structure
- Resend-ready structure
- PostHog-ready structure
- Sentry-ready structure
- Playwright and Storybook
- Vercel and GitHub-ready project layout
- Optional 21st.dev Magic MCP readiness script

## Local Setup

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

Useful commands:

```bash
npm run lint
npm run build
npm run test:e2e
npm run storybook
npm run db:generate
```

If Playwright cannot install its bundled browser on your OS, use the local Chrome fallback:

```bash
npm run test:e2e:install-browser
npm run test:e2e
```

## Environment Variables

Copy `.env.example` to `.env.local` when you are ready to connect real services.

```bash
cp .env.example .env.local
```

Step 1 intentionally works with empty environment variables. Do not commit real secrets.

### Gmail OAuth

Gmail connections create drafts only; FalconDraft never sends commercial emails automatically.

Required server-side variables:

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_REDIRECT_URI`, ending with `/api/email/oauth/google/callback`
- `TOKEN_ENCRYPTION_KEY`, generated with `openssl rand -base64 32`
- `N8N_EMAIL_DRAFT_SECRET`, shared only with n8n for server-to-server draft creation

The Google OAuth consent screen must allow the exact callback URL configured in
`GOOGLE_REDIRECT_URI`. The app requests the Gmail draft scope only:
`https://www.googleapis.com/auth/gmail.compose`.

### n8n Gmail Draft Endpoint

n8n can create Gmail drafts through `POST /api/email/gmail/drafts/create`.
Authenticate with `Authorization: Bearer $N8N_EMAIL_DRAFT_SECRET` or
`x-n8n-email-draft-secret`. The request body must include `organization_id`,
`user_id`, `to`, `subject`, and `body`; `deal_id` is optional. A single PDF
attachment is supported through `attachments[0].contentBase64` or
`attachments[0].data` with `contentType: "application/pdf"`.

The endpoint creates Gmail drafts only. Gmail access and refresh tokens stay on
the FalconDraft server and are never exposed to n8n or the client.

## What Step 1 Prepared

- Minimal routes: `/`, `/login`, `/dashboard`
- shadcn/ui components installed in `components/ui`
- Supabase helpers in `lib/supabase`
- Drizzle schema and lazy database factory in `db`
- Mocked workflow API route in `app/api/workflows/[type]`
- Mocked Stripe webhook route in `app/api/stripe/webhook`
- Resend, PostHog, Stripe, and Sentry lazy setup files
- `.env.example` with all required placeholders
- Playwright smoke tests for the three minimal routes

## Architecture Notes

- Client-facing UI must stay premium, simple, and business-oriented.
- Internal providers and automation tools must not be exposed in client-facing wording.
- Every future tenant-scoped table must include `organization_id`.
- Future Supabase policies must restrict tenant data by organization membership.
- Analytics must never receive call notes, transcripts, proposal content, prices, or client-sensitive data.

## Next Step: Build The Premium Interface

Future routes:

- `/dashboard/deals`
- `/dashboard/deals/new`
- `/dashboard/deals/[id]`
- `/dashboard/documents`
- `/dashboard/settings`
- `/dashboard/settings/team`
- `/dashboard/settings/integrations`
- `/dashboard/settings/billing`
- `/admin`

Step 2 should design the premium FalconDraft experience around: create a deal, generate a professional proposal, validate, send.
