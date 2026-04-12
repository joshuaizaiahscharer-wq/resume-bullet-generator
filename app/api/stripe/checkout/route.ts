import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "");

export async function POST() {
  if (!process.env.STRIPE_SECRET_KEY) {
    return Response.json({ error: "STRIPE_SECRET_KEY is not configured." }, { status: 500 });
  }

  const priceId =
    process.env.STRIPE_CHECK_MY_RESUME_PRICE_ID || "price_1TLX4E12xoyNnQNyqanmPF7z";
  if (!priceId) {
    return Response.json(
      { error: "STRIPE_CHECK_MY_RESUME_PRICE_ID is not configured." },
      { status: 500 }
    );
  }

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || process.env.SITE_URL;
  if (!baseUrl) {
    return Response.json({ error: "NEXT_PUBLIC_BASE_URL or SITE_URL is required." }, { status: 500 });
  }

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    success_url: `${baseUrl}/check-my-resume?paid=true`,
    cancel_url: `${baseUrl}/check-my-resume`,
  });

  return Response.json({ url: session.url });
}
