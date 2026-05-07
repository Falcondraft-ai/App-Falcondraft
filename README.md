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
