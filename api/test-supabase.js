// api/test-supabase.js
//
// NOTE: In this project, all routes are served by api/index.js (Express).
// The live endpoint is:  GET /api/test-supabase
// That route is defined in api/index.js and handled by Express.
//
// This file is a standalone reference showing how the same logic works as an
// isolated Vercel serverless function. You could deploy it as a separate
// function by updating vercel.json if you ever split the app into individual
// functions.
//
// ─────────────────────────────────────────────────────────────────────────────

require("dotenv").config();
const supabase = require("../lib/supabase");

/**
 * Vercel serverless function handler.
 * GET /api/test-supabase
 */
module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed." });
  }

  try {
    const { data, error } = await supabase
      .from("purchases")
      .select("id, email, product, created_at")
      .limit(5);

    if (error) {
      console.error("[test-supabase] Supabase error:", error.message);
      return res.status(500).json({ status: "error", message: error.message });
    }

    return res.status(200).json({ status: "connected", data: data ?? [] });
  } catch (err) {
    console.error("[test-supabase] Unexpected error:", err.message);
    return res.status(500).json({ status: "error", message: err.message });
  }
};

// ─── Example: record a purchase ───────────────────────────────────────────────
// Import this function wherever you need to log a purchase (e.g. inside the
// Shopify webhook handler after a successful paid order).
//
// async function recordPurchase(email, product) {
//   const { error } = await supabase
//     .from("purchases")
//     .insert([{ email, product }]);
//
//   if (error) {
//     console.error("[recordPurchase] insert error:", error.message);
//     throw error;
//   }
// }
