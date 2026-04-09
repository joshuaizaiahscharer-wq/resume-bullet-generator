const crypto = require("crypto");
const supabase = require("./supabase");

function generateAccessTokenValue() {
  return crypto.randomBytes(32).toString("hex");
}

function isPurchasePaid(financialStatus) {
  const normalized = String(financialStatus || "").toLowerCase();
  return normalized === "paid" || normalized === "partially_paid";
}

/**
 * Save one secure access token for template builder.
 *
 * Expected table (SQL):
 *
 * create table if not exists public.download_access_tokens (
 *   id bigserial primary key,
 *   purchase_id bigint not null references public.purchases(id) on delete cascade,
 *   email text not null,
 *   token text not null unique,
 *   expires_at timestamptz not null,
 *   used_at timestamptz null,
 *   created_at timestamptz not null default now()
 * );
 */
async function createTemplateAccessToken({ purchaseId, email, expiresInHours = 24 }) {
  const token = generateAccessTokenValue();
  const expiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from("download_access_tokens")
    .insert([
      {
        purchase_id: purchaseId,
        email: String(email || "").trim().toLowerCase(),
        token,
        expires_at: expiresAt,
      },
    ])
    .select("id, purchase_id, email, token, expires_at, used_at, created_at")
    .single();

  if (error) {
    throw new Error(`Failed to create access token: ${error.message}`);
  }

  return data;
}

async function validateTemplateAccessToken(token) {
  const cleanToken = String(token || "").trim();
  if (!cleanToken) {
    return { ok: false, reason: "missing-token" };
  }

  const tokenResult = await supabase
    .from("download_access_tokens")
    .select("id, purchase_id, email, token, expires_at, used_at, created_at")
    .eq("token", cleanToken)
    .maybeSingle();

  if (tokenResult.error) {
    return { ok: false, reason: "token-query-failed", error: tokenResult.error.message };
  }

  const tokenRow = tokenResult.data;
  if (!tokenRow) {
    return { ok: false, reason: "token-not-found" };
  }

  if (tokenRow.expires_at && new Date(tokenRow.expires_at).getTime() < Date.now()) {
    return { ok: false, reason: "token-expired" };
  }

  const purchaseResult = await supabase
    .from("purchases")
    .select("id, shopify_order_id, email, product, financial_status, created_at")
    .eq("id", tokenRow.purchase_id)
    .maybeSingle();

  if (purchaseResult.error) {
    return { ok: false, reason: "purchase-query-failed", error: purchaseResult.error.message };
  }

  const purchase = purchaseResult.data;
  if (!purchase) {
    return { ok: false, reason: "purchase-not-found" };
  }

  if (!isPurchasePaid(purchase.financial_status)) {
    return { ok: false, reason: "purchase-not-paid" };
  }

  return { ok: true, token: tokenRow, purchase };
}

module.exports = {
  createTemplateAccessToken,
  validateTemplateAccessToken,
};
