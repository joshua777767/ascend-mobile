import { Router, type IRouter } from "express";
import { stripeStorage } from "../stripeStorage";
import { getUncachableStripeClient } from "../stripeClient";

const router: IRouter = Router();

let productCache: { data: any[]; timestamp: number; keyMode: string } | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000;

async function fetchProductsFromStripe(): Promise<{ data: any[]; keyMode: string }> {
  const stripe = await getUncachableStripeClient();
  // Detect key mode from the API key the client was constructed with
  const keyMode = (stripe as any)._api?.auth?.startsWith?.("sk_live") ? "live"
    : (stripe as any)._api?.auth?.startsWith?.("sk_test") ? "test"
    : "unknown";

  const [products, prices] = await Promise.all([
    stripe.products.list({ active: true, limit: 20 }),
    stripe.prices.list({ active: true, limit: 50 }),
  ]);

  const productsMap = new Map<string, any>();
  for (const p of products.data) {
    productsMap.set(p.id, { id: p.id, name: p.name, description: p.description, active: p.active, prices: [] });
  }
  for (const pr of prices.data) {
    const productId = typeof pr.product === "string" ? pr.product : (pr.product as any)?.id;
    if (productId && productsMap.has(productId)) {
      productsMap.get(productId).prices.push({
        id: pr.id,
        unitAmount: pr.unit_amount,
        currency: pr.currency,
        recurring: pr.recurring ? { interval: pr.recurring.interval, interval_count: pr.recurring.interval_count } : null,
        active: pr.active,
      });
    }
  }
  return { data: Array.from(productsMap.values()), keyMode };
}

router.get("/stripe/products", async (_req, res): Promise<void> => {
  if (productCache && Date.now() - productCache.timestamp < CACHE_TTL_MS) {
    res.json({ data: productCache.data, keyMode: productCache.keyMode });
    return;
  }

  // Try DB-synced products first
  try {
    const rows = await stripeStorage.listProductsWithPrices();
    const productsMap = new Map<string, any>();
    for (const row of rows as any[]) {
      if (!productsMap.has(row.product_id)) {
        productsMap.set(row.product_id, {
          id: row.product_id, name: row.product_name,
          description: row.product_description, active: row.product_active, prices: [],
        });
      }
      if (row.price_id) {
        productsMap.get(row.product_id).prices.push({
          id: row.price_id, unitAmount: row.unit_amount, currency: row.currency,
          recurring: row.recurring, active: row.price_active,
        });
      }
    }
    const data = Array.from(productsMap.values());
    if (data.length > 0) {
      productCache = { data, timestamp: Date.now(), keyMode: "live" };
      res.json({ data, keyMode: "live" });
      return;
    }
    // DB empty — fall through to Stripe API
  } catch {
    // DB unavailable — fall through to Stripe API
  }

  // Fallback: hit Stripe API directly
  try {
    const { data, keyMode } = await fetchProductsFromStripe();
    productCache = { data, timestamp: Date.now(), keyMode };
    const errorMsg = data.length === 0
      ? keyMode === "test"
        ? "Stripe is in test mode — no live products found. Add your live Stripe secret key (sk_live_...) as STRIPE_SECRET_KEY in the Publish → Secrets pane."
        : "No active Stripe products found. Create a product with a recurring price in your Stripe Dashboard."
      : undefined;
    res.json({ data, keyMode, ...(errorMsg ? { error: errorMsg } : {}) });
  } catch (err: any) {
    const msg = err?.message ?? "Unknown error";
    const isMissingKey = msg.includes("Missing") || msg.includes("not connected") || msg.includes("missing secret key");
    res.json({
      data: [],
      keyMode: "none",
      error: isMissingKey
        ? "Stripe secret key not configured. Add STRIPE_SECRET_KEY (sk_live_...) to the Publish → Secrets pane."
        : `Stripe error: ${msg}`,
    });
  }
});

export default router;
