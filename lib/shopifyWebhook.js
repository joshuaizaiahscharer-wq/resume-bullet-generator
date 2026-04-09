const crypto = require("crypto");

function verifyShopifyWebhook(rawBody, hmacHeader, webhookSecret) {
  if (!rawBody || !hmacHeader || !webhookSecret) {
    return false;
  }

  const digest = crypto
    .createHmac("sha256", webhookSecret)
    .update(rawBody, "utf8")
    .digest("base64");

  const hmacA = Buffer.from(digest);
  const hmacB = Buffer.from(hmacHeader);

  if (hmacA.length !== hmacB.length) {
    return false;
  }

  return crypto.timingSafeEqual(hmacA, hmacB);
}

function isOrderPaid(order) {
  // Accept common paid states from Shopify payloads.
  const financialStatus = String(order?.financial_status || "").toLowerCase();
  const displayFinancialStatus = String(order?.display_financial_status || "").toLowerCase();

  return (
    financialStatus === "paid" ||
    financialStatus === "partially_paid" ||
    displayFinancialStatus === "paid" ||
    displayFinancialStatus === "partially_paid"
  );
}

module.exports = {
  verifyShopifyWebhook,
  isOrderPaid,
};
