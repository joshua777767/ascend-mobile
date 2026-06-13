import { Router, type IRouter } from "express";
import { stripeStorage } from "../stripeStorage";
import { getUncachableStripeClient } from "../stripeClient";

const router: IRouter = Router();

let productCache: { data: any[]; timestamp: number } | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000;

async function fetchProductsFromStripe() {
  const stripe = await getUncachableStripeClient();
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
  return Array.from(productsMap.values());
}

router.get("/stripe/products", async (_req, res): Promise<void> => {
  if (productCache && Date.now() - productCache.timestamp < CACHE_TTL_MS) {
    res.json({ data: productCache.data });
    return;
  }

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
      productCache = { data, timestamp: Date.now() };
      res.json({ data });
      return;
    }
    throw new Error("no db rows");
  } catch {
    try {
      const data = await fetchProductsFromStripe();
      productCache = { data, timestamp: Date.now() };
      res.json({ data });
    } catch {
      res.json({ data: [], error: "Stripe is not configured." });
    }
  }
});

export default router;
