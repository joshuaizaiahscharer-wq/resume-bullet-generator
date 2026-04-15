"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { PRODUCTS } from "@/lib/products";
import dynamic from "next/dynamic";

const Checkout = dynamic(() => import("@/components/checkout"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[400px] items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  ),
});

export default function PricingSection() {
  const [selectedProduct, setSelectedProduct] = useState<string | null>(null);

  return (
    <section id="pricing" className="relative py-24">
      {/* Background effect */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-primary/5 to-transparent" />

      <div className="relative mx-auto max-w-7xl px-6">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Simple, transparent pricing
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Choose the plan that works best for your job search. No hidden fees.
          </p>
        </div>

        {selectedProduct ? (
          <div className="mx-auto mt-16 max-w-xl">
            <div className="mb-6 flex items-center justify-between">
              <h3 className="text-xl font-semibold text-foreground">
                Complete your purchase
              </h3>
              <button
                onClick={() => setSelectedProduct(null)}
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                Back to plans
              </button>
            </div>
            <div className="rounded-2xl border border-border bg-card p-4">
              <Checkout productId={selectedProduct} />
            </div>
          </div>
        ) : (
          <div className="mx-auto mt-16 grid max-w-5xl gap-6 lg:grid-cols-3">
            {PRODUCTS.map((product) => (
              <div
                key={product.id}
                className={`relative rounded-2xl border p-6 transition ${
                  product.popular
                    ? "border-primary bg-card glow-blue"
                    : "border-border bg-card/50 hover:border-primary/50"
                }`}
              >
                {product.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-4 py-1 text-xs font-semibold text-primary-foreground">
                    Most Popular
                  </div>
                )}
                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-foreground">
                    {product.name}
                  </h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {product.description}
                  </p>
                </div>
                <div className="mb-6">
                  <span className="text-4xl font-bold text-foreground">
                    {product.priceDisplay.split("/")[0]}
                  </span>
                  {product.priceDisplay.includes("/") && (
                    <span className="text-muted-foreground">
                      /{product.priceDisplay.split("/")[1]}
                    </span>
                  )}
                </div>
                <ul className="mb-8 space-y-3">
                  {product.features.map((feature) => (
                    <li
                      key={feature}
                      className="flex items-start gap-2 text-sm text-muted-foreground"
                    >
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => setSelectedProduct(product.id)}
                  className={`w-full rounded-lg py-3 text-sm font-semibold transition ${
                    product.popular
                      ? "bg-primary text-primary-foreground hover:bg-primary/90"
                      : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                  }`}
                >
                  Get Started
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
