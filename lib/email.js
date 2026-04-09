const nodemailer = require("nodemailer");

let transporter;

function getMailer() {
  if (transporter) {
    return transporter;
  }

  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !port || !user || !pass) {
    throw new Error("Missing SMTP configuration. Check SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS.");
  }

  transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: {
      user,
      pass,
    },
  });

  return transporter;
}

function buildEmailContent({ productName, downloadUrl, orderNumber }) {
  const supportEmail = "support@example.com"; // Replace with your real support address.

  const subject = `Your ${productName} builder access link`;

  const text = [
    `Thank you for your purchase${orderNumber ? ` (${orderNumber})` : ""}!`,
    "",
    `Your product: ${productName}`,
    "Click this secure link to build and download your template:",
    downloadUrl,
    "",
    "This private link expires in 24 hours.",
    "",
    "If you have any issues, reply to this email or contact support:",
    supportEmail,
  ].join("\n");

  const html = `
    <div style="font-family: Inter, Segoe UI, Arial, sans-serif; color: #111827; line-height: 1.55; max-width: 640px; margin: 0 auto;">
      <h2 style="margin: 0 0 12px; color: #111827;">Thank you for your purchase!</h2>
      <p style="margin: 0 0 14px; color: #334155;">
        ${orderNumber ? `Order <strong>${orderNumber}</strong> confirmed.` : "Your order was confirmed."}
      </p>
      <p style="margin: 0 0 14px; color: #334155;">
        Product: <strong>${productName}</strong>
      </p>
      <p style="margin: 0 0 20px; color: #334155;">
        Click the button below to build and download your resume template.
      </p>
      <p style="margin: 0 0 24px;">
        <a href="${downloadUrl}" style="display: inline-block; background: #4f46e5; color: #ffffff; text-decoration: none; padding: 12px 20px; border-radius: 8px; font-weight: 600;">
          Open Template Builder
        </a>
      </p>
      <p style="margin: 0 0 14px; color: #64748b; font-size: 14px;">
        This private link expires in 24 hours.
      </p>
      <p style="margin: 0; color: #64748b; font-size: 14px;">
        Need help? Contact support at ${supportEmail}
      </p>
    </div>
  `;

  return { subject, text, html };
}

async function sendDigitalDownloadEmail({ toEmail, productName, downloadUrl, orderNumber }) {
  const from = process.env.FROM_EMAIL;
  if (!from) {
    throw new Error("Missing FROM_EMAIL configuration.");
  }

  if (!toEmail) {
    throw new Error("Missing recipient email.");
  }

  const { subject, text, html } = buildEmailContent({
    productName,
    downloadUrl,
    orderNumber,
  });

  const mailer = getMailer();
  return mailer.sendMail({
    from,
    to: toEmail,
    subject,
    text,
    html,
  });
}

module.exports = {
  sendDigitalDownloadEmail,
};
