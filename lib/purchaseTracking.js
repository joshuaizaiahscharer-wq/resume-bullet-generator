const supabase = require("./supabase");

/**
 * Save a Shopify purchase in Supabase.
 *
 * Expected table (SQL):
 *
 * create table if not exists public.purchases (
 *   id bigserial primary key,
 *   shopify_order_id text not null unique,
 *   email text not null,
 *   product text not null,
 *   financial_status text not null,
 *   created_at timestamptz not null default now()
 * );
 */
async function savePurchase({ shopifyOrderId, email, product, financialStatus }) {
  if (!shopifyOrderId) {
    throw new Error("Missing shopifyOrderId.");
  }

  const payload = {
    shopify_order_id: String(shopifyOrderId),
    email: String(email || "").trim().toLowerCase(),
    product: String(product || "Resume Template Pack"),
    financial_status: String(financialStatus || "").toLowerCase(),
  };

  let insertResult = await supabase
    .from("purchases")
    .insert([payload])
    .select("id, shopify_order_id, email, product, financial_status, created_at")
    .single();

  if (!insertResult.error) {
    return insertResult.data;
  }

  // If duplicate order id, fetch existing record for idempotency.
  const msg = String(insertResult.error.message || "").toLowerCase();
  const isDuplicate = insertResult.error.code === "23505" || msg.includes("duplicate");

  if (isDuplicate) {
    const existing = await supabase
      .from("purchases")
      .select("id, shopify_order_id, email, product, financial_status, created_at")
      .eq("shopify_order_id", String(shopifyOrderId))
      .maybeSingle();

    if (existing.error) {
      throw new Error(`Failed to fetch existing purchase: ${existing.error.message}`);
    }

    if (!existing.data) {
      throw new Error("Duplicate purchase detected but existing row was not found.");
    }

    return existing.data;
  }

  throw new Error(`Failed to save purchase: ${insertResult.error.message}`);
}

module.exports = {
  savePurchase,
};
