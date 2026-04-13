# Resume Bullet Generator

An AI-powered resume bullet point generator with blog, admin dashboard, and resume tools.

## Architecture

- **Runtime**: Node.js 20 (Express.js)
- **Entry point**: `server.js` → loads `api/index.js`
- **Port**: 5000 (bound to 0.0.0.0 for Replit compatibility)
- **Static files**: Served from project root via `express.static`

## Key Files

- `server.js` — main entry point, starts Express on port 5000
- `api/index.js` — all routes and business logic (Express app)
- `lib/supabase.js` — lazy Supabase client (server-side only, uses SERVICE_ROLE_KEY)
- `lib/blogPages.js` — static blog post rendering
- `lib/usageTracking.js` — usage tracking helpers
- `data/jobs.js` — job listing data
- `data/jobClusters.js` — job cluster content

## Environment Variables Required

Set these as Replit Secrets:

| Variable | Description |
|---|---|
| `OPENAI_API_KEY` | OpenAI API key for AI features |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server-side only) |
| `SUPABASE_ANON_KEY` | Supabase anon/public key |
| `ADMIN_PASSWORD` | Password for admin dashboard |
| `STRIPE_SECRET_KEY` | Stripe secret key (payments) |
| `STRIPE_PRICE_ID` | Stripe price ID for resume builder |
| `PAYMENT_STATE_SECRET` | Secret for signing payment state cookies |
| `SITE_URL` | Public URL of the site (e.g. https://yourapp.replit.app) |
| `GMAIL_USER` | Gmail address for support notifications (optional) |
| `GMAIL_APP_PASSWORD` | Gmail app password (optional) |
| `SUPPORT_NOTIFY_EMAIL` | Email to receive support notifications (optional) |

## Workflow

- **Start application**: `npm run dev` → runs `node server.js` on port 5000

## Migration Notes (Vercel → Replit)

- Changed port from 3000 to 5000 and bound to `0.0.0.0` for Replit
- Made OpenAI client lazy (instantiated on first use, not at module load)
- Added `dev` script to package.json
- `vercel.json` rewrites are handled natively by Express routes
