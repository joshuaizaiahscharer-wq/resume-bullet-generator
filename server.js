// Local development entry point.
const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");

const envLocalPath = path.join(process.cwd(), ".env.local");
if (fs.existsSync(envLocalPath)) {
  dotenv.config({ path: envLocalPath });
}
dotenv.config();

// Auto-set SITE_URL from Replit's domain if not already configured
if (!process.env.SITE_URL && process.env.REPLIT_DEV_DOMAIN) {
  process.env.SITE_URL = `https://${process.env.REPLIT_DEV_DOMAIN}`;
}

const app = require("./api/index");

const PORT = process.env.PORT || 5000;

async function start() {
  if (app._authReady) {
    await app._authReady;
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running at http://0.0.0.0:${PORT}`);
    console.log(`Site URL: ${process.env.SITE_URL || "not set"}`);
  });

  // ─── Daily blog post generation (6:00 AM UTC) ──────────────────────────────
  try {
    const cron = require("node-cron");
    const { runDailyBlogGeneration } = require("./server/blogGeneratorService");

    // Runs every day at 06:00 UTC.
    cron.schedule("0 6 * * *", () => {
      console.log("[blog-cron] Daily cron triggered.");
      runDailyBlogGeneration();
    });

    console.log("[blog-cron] Daily blog generation scheduled (06:00 UTC).");
  } catch (cronErr) {
    console.warn("[blog-cron] Failed to start scheduler:", cronErr.message);
  }
}

start().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
