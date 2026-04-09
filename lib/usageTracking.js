// lib/usageTracking.js
//
// Records a generator usage event to the `generator_usage` Supabase table.
// This is fire-and-forget — if logging fails it logs a warning but does NOT
// throw, so the user-facing generator response is never affected.
//
// Expected Supabase table schema:
// ─────────────────────────────────────────────────────────────────────────────
// create table generator_usage (
//   id                   uuid        default gen_random_uuid() primary key,
//   job_title            text        not null,
//   normalized_job_title text        not null,
//   created_at           timestamptz default now(),
//   page_path            text,
//   page_type            text,
//   user_id              text,
//   user_agent           text,
//   ip_address           text
// );
// ─────────────────────────────────────────────────────────────────────────────

const supabase = require("./supabase");

/**
 * Save one generator usage event.
 *
 * @param {object} params
 * @param {string} params.jobTitle      - Raw job title as entered by the user.
 * @param {string} [params.pagePath]    - URL path where the generator was used (e.g. "/").
 * @param {string} [params.pageType]    - Page type label (e.g. "bullets", "summary").
 * @param {string} [params.userId]      - Authenticated user id when available.
 * @param {string} [params.userAgent]   - Browser user-agent string.
 * @param {string} [params.ipAddress]   - Visitor IP address.
 */
async function recordGeneratorUsage({
  jobTitle,
  pagePath = null,
  pageType = null,
  userId = null,
  userAgent = null,
  ipAddress = null,
}) {
  try {
    const trimmed = (jobTitle || "").trim().slice(0, 100);

    if (!trimmed) return; // nothing to record

    // Normalized: lowercase + trimmed (simple and predictable for analytics).
    const normalized = trimmed.toLowerCase();

    const { error } = await supabase.from("generator_usage").insert([
      {
        job_title: trimmed,
        normalized_job_title: normalized,
        page_path: pagePath,
        page_type: pageType,
        user_id: userId,
        user_agent: userAgent,
        ip_address: ipAddress,
      },
    ]);

    if (error) {
      // Log but do not throw — usage tracking must never break generation.
      console.warn("[usageTracking] Failed to insert row:", error.message);
    }
  } catch (err) {
    console.warn("[usageTracking] Unexpected error:", err.message);
  }
}

module.exports = { recordGeneratorUsage };
