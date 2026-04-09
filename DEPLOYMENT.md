# Resume Bullet Generator — Vercel Deployment

## Project Structure

```
/
├── api/
│   └── index.js           ← Serverless function, handles all routes
├── data/
│   └── jobs.js            ← Job data for SEO pages
├── index.html             ← Home page (static)
├── style.css              ← Styles (static)
├── script.js              ← Frontend JS (static)
├── server.js              ← Local dev launcher
├── package.json           ← Node dependencies + build script
├── vercel.json            ← Vercel config with rewrites
├── .env                   ← Local secrets (not deployed)
├── .env.example           ← Environment template
└── .gitignore             ← Git ignore rules
```

## Local Development

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set environment variables** in `.env` (copy `.env.example` and fill in your values):
   ```
   OPENAI_API_KEY=sk-...your-key...
   PORT=3000
   SITE_URL=http://localhost:3000
   SHOPIFY_STORE_URL=https://your-store.myshopify.com/products/resume-template-pack
   SHOPIFY_WEBHOOK_SECRET=your_shopify_webhook_secret
   PRODUCT_DOWNLOAD_URL=https://your-download-file-link
   SMTP_HOST=your_smtp_host
   SMTP_PORT=587
   SMTP_USER=your_smtp_user
   SMTP_PASS=your_smtp_password
   FROM_EMAIL=you@yourdomain.com
   ```

3. **Run locally:**
   ```bash
   npm start
   ```
   Visit http://localhost:3000

## Deploy to Vercel

### Option 1: Git Push (Recommended)

1. **Connect your repo** to Vercel (GitHub, GitLab, Bitbucket)
2. **Set environment variables** in Vercel project settings:
   - `OPENAI_API_KEY` → your actual OpenAI key
   - `SITE_URL` → `https://myresumebullets.com` (or your domain)
   - `SHOPIFY_STORE_URL` → `https://your-store.myshopify.com/products/resume-template-pack`
   - `SHOPIFY_WEBHOOK_SECRET` → your Shopify webhook secret
   - `PRODUCT_DOWNLOAD_URL` → `https://your-download-file-link`
   - `SMTP_HOST` → your SMTP host
   - `SMTP_PORT` → `587`
   - `SMTP_USER` → your SMTP username
   - `SMTP_PASS` → your SMTP password
   - `FROM_EMAIL` → `you@yourdomain.com`
3. **Push to production branch** — Vercel auto-deploys

### Option 2: Vercel CLI

```bash
# Install Vercel CLI (global)
npm i -g vercel

# Deploy
vercel

# Deploy to production
vercel --prod
```

When prompted, link the existing Vercel project.

### Set Environment Variables in Vercel

1. Go to **Vercel Dashboard** → Your Project → **Settings** → **Environment Variables**
2. Add:
   - **Name:** `OPENAI_API_KEY`  
     **Value:** `sk-...your-key...`  
     **Environments:** Production, Preview, Development

   - **Name:** `SITE_URL`  
     **Value:** `https://myresumebullets.com`  
     **Environments:** Production

   - **Name:** `SHOPIFY_STORE_URL`  
     **Value:** `https://your-store.myshopify.com/products/resume-template-pack`  
     **Environments:** Production

   - **Name:** `SHOPIFY_WEBHOOK_SECRET`  
     **Value:** `your_shopify_webhook_secret`  
     **Environments:** Production

   - **Name:** `PRODUCT_DOWNLOAD_URL`  
     **Value:** `https://your-download-file-link`  
     **Environments:** Production

   - **Name:** `SMTP_HOST`  
     **Value:** `your_smtp_host`  
     **Environments:** Production

   - **Name:** `SMTP_PORT`  
     **Value:** `587`  
     **Environments:** Production

   - **Name:** `SMTP_USER`  
     **Value:** `your_smtp_user`  
     **Environments:** Production

   - **Name:** `SMTP_PASS`  
     **Value:** `your_smtp_password`  
     **Environments:** Production

   - **Name:** `FROM_EMAIL`  
     **Value:** `you@yourdomain.com`  
     **Environments:** Production

3. Click **Save**
4. Redeploy to apply changes

## Production Endpoints

Once deployed, these URLs will work:

- `https://myresumebullets.com/` — Homepage
- `https://myresumebullets.com/jobs` — All job pages
- `https://myresumebullets.com/resume-bullet-points-for-bartender` — Job-specific page
- `https://myresumebullets.com/resume-bullet-points-for-cashier` — Another example
- `POST https://myresumebullets.com/api/generate` — API endpoint for AI generation
- `https://myresumebullets.com/robots.txt` — SEO crawler config
- `https://myresumebullets.com/sitemap.xml` — Sitemap for indexing

## Troubleshooting

**Error: DEPLOYMENT_NOT_FOUND**
- Ensure `OPENAI_API_KEY` is set in Vercel environment variables
- Check that the build succeeds in Vercel Deploy logs
- Verify `vercel.json` is in the project root

**API returns 500**
- Check Vercel Function logs
- Verify `OPENAI_API_KEY` is correct and has quota

**Static files (HTML, CSS, JS) not loading**
- Confirm they're in the project root (not inside api/)
- Verify `app.use(express.static(...))` in api/index.js

## Adding More Job Pages

1. Edit `data/jobs.js`
2. Add a new job object:
   ```javascript
   {
     slug: "electrician",
     title: "Electrician",
     metaDescription: "...",
     intro: "...",
     bullets: ["...", "..."],
   }
   ```
3. Redeploy — new route auto-generates:
   - `https://myresumebullets.com/resume-bullet-points-for-electrician`

## Questions?

- [Vercel Docs](https://vercel.com/docs)
- [Express on Vercel](https://vercel.com/docs/frameworks/express)
