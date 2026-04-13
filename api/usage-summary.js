// api/usage-summary.js
// Standalone Vercel function for generator usage analytics.

require("dotenv").config();
const supabase = require("../lib/supabase");

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed." });
  }

  try {
    const { data, error } = await supabase
      .from("generator_usage")
      .select("normalized_job_title, created_at")
      .order("created_at", { ascending: false })
      .limit(5000);

    if (error) {
      console.error("[/api/usage-summary] Supabase error:", error.message);
      return res.status(500).json({ status: "error", message: error.message });
    }

    const rows = data ?? [];
    const now = Date.now();
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;

    const dayCounts = new Map();
    const titleCounts = new Map();
    let last7Days = 0;
    let last30Days = 0;

    for (const row of rows) {
      const ts = Date.parse(row.created_at);
      if (!Number.isNaN(ts)) {
        if (ts >= sevenDaysAgo) last7Days += 1;
        if (ts >= thirtyDaysAgo) last30Days += 1;
      }

      const dayKey = (row.created_at || "").slice(0, 10);
      if (dayKey) {
        dayCounts.set(dayKey, (dayCounts.get(dayKey) || 0) + 1);
      }

      const title = (row.normalized_job_title || "").trim();
      if (title) {
        titleCounts.set(title, (titleCounts.get(title) || 0) + 1);
      }
    }

    const byDay = [...dayCounts.entries()]
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const topJobTitles = [...titleCounts.entries()]
      .map(([jobTitle, count]) => ({ jobTitle, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return res.status(200).json({
      status: "connected",
      totals: {
        totalEvents: rows.length,
        last7Days,
        last30Days,
      },
      byDay,
      topJobTitles,
    });
  } catch (err) {
    console.error("[/api/usage-summary] Unexpected error:", err.message);
    return res.status(500).json({ status: "error", message: err.message });
  }
};
