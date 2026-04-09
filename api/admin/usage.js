// api/admin/usage.js
// Returns top 20 most searched job titles with counts.
//
// Protected by ADMIN_PASSWORD environment variable.
// Pass the password as a query param:  GET /api/admin/usage?password=YOUR_PASSWORD
//
// Security note: service_role key never leaves the server. Only aggregated
// counts (no user PII) are returned in the response.

require("dotenv").config();
const supabase = require("../../lib/supabase");

function isMissingUserIdColumn(error) {
  const msg = String(error?.message || "").toLowerCase();
  return msg.includes("user_id") && msg.includes("does not exist");
}

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed." });
  }

  // ── Password check ──────────────────────────────────────────────────────────
  const adminPassword = process.env.ADMIN_PASSWORD;
  const provided = req.query.password || "";

  if (!adminPassword) {
    return res.status(500).json({ error: "ADMIN_PASSWORD env var is not set." });
  }

  if (provided !== adminPassword) {
    return res.status(401).json({ error: "Unauthorized." });
  }

  // ── Query ───────────────────────────────────────────────────────────────────
  try {
    // Supabase JS client does not support raw GROUP BY, so we fetch recent rows
    // and aggregate in JS. Capped at 5000 rows — plenty for a hobby project.
    let { data, error } = await supabase
      .from("generator_usage")
      .select("normalized_job_title, created_at, user_id")
      .order("created_at", { ascending: false })
      .limit(5000);

    // Backward-compatible fallback for older databases where user_id was not
    // added yet. This keeps the admin page working instead of failing hard.
    if (error && isMissingUserIdColumn(error)) {
      const fallback = await supabase
        .from("generator_usage")
        .select("normalized_job_title, created_at")
        .order("created_at", { ascending: false })
        .limit(5000);

      data = fallback.data;
      error = fallback.error;
    }

    if (error) {
      console.error("[/api/admin/usage] Supabase error:", error.message);
      return res.status(500).json({ error: error.message });
    }

    const rows = data ?? [];

    // Count occurrences of each normalized job title.
    const counts = new Map();
    for (const row of rows) {
      const title = (row.normalized_job_title || "").trim();
      if (title) counts.set(title, (counts.get(title) || 0) + 1);
    }

    // Sort by count descending, take top 20.
    const topJobs = [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([job, count]) => ({ job, count }));

    const recentJobs = rows.slice(0, 50).map((row) => ({
      job: (row.normalized_job_title || "").trim(),
      userId: row.user_id || null,
      createdAt: row.created_at,
    }));

    return res.status(200).json({
      totalRecords: rows.length,
      topJobs,
      recentJobs,
    });
  } catch (err) {
    console.error("[/api/admin/usage] Unexpected error:", err.message);
    return res.status(500).json({ error: err.message });
  }
};
