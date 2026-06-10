import { Router, type IRouter } from "express";
import { stripeStorage } from "../stripeStorage";
import { stripeService } from "../stripeService";
import { getUncachableStripeClient } from "../stripeClient";
import { getUserId } from "../middlewares/auth";

const router: IRouter = Router();

// In-memory cache for Stripe products/prices (5-minute TTL)
let productCache: { data: any[]; timestamp: number } | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000;

// Get subscription status
router.get("/subscription", async (req, res): Promise<void> => {
  const userId = getUserId(req);
  const user = await stripeStorage.getUser(userId);
  if (!user?.stripeCustomerId) {
    res.json({ subscription: null, customerId: null });
    return;
  }

  // Check for active subscriptions
  const subs = await stripeStorage.getSubscriptionByCustomer(user.stripeCustomerId);
  const active = subs.find((s: any) => s.status === "active" || s.status === "trialing");

  res.json({
    subscription: active || null,
    customerId: user.stripeCustomerId,
    status: active?.status || "inactive",
  });
});

// Create checkout session
router.post("/checkout", async (req, res): Promise<void> => {
  const userId = getUserId(req);
  const user = await stripeStorage.getUser(userId);
  if (!user) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const { priceId, trial } = req.body;
  if (!priceId) {
    res.status(400).json({ error: "Price ID is required" });
    return;
  }

  // Create or get customer
  let customerId = user.stripeCustomerId;
  if (!customerId) {
    const customer = await stripeService.createCustomer(user.email, user.id);
    await stripeStorage.updateUserStripeInfo(user.id, { stripeCustomerId: customer.id });
    customerId = customer.id;
  }

  const baseUrl = process.env.REPLIT_DOMAINS
    ? `https://${process.env.REPLIT_DOMAINS.split(",")[0]}`
    : `http://localhost:80`;

  const trialPeriodDays = trial === true ? 7 : undefined;
  const successPath = trial === true ? "/onboarding?checkout=success" : "/dashboard?checkout=success";

  const session = await stripeService.createCheckoutSession(
    customerId,
    priceId,
    `${baseUrl}${successPath}`,
    `${baseUrl}/pricing?checkout=cancel`,
    trialPeriodDays
  );

  res.json({ url: session.url });
});

// Create customer portal session
router.post("/portal", async (req, res): Promise<void> => {
  const userId = getUserId(req);
  const user = await stripeStorage.getUser(userId);
  if (!user?.stripeCustomerId) {
    res.status(400).json({ error: "No subscription found" });
    return;
  }

  const baseUrl = process.env.REPLIT_DOMAINS
    ? `https://${process.env.REPLIT_DOMAINS.split(",")[0]}`
    : `http://localhost:80`;

  const session = await stripeService.createCustomerPortalSession(
    user.stripeCustomerId,
    `${baseUrl}/settings`
  );

  res.json({ url: session.url });
});

/**
 * Fetch products from Stripe API directly, used when DB sync tables aren't available.
 */
async function fetchProductsFromStripe() {
  const stripe = await getUncachableStripeClient();
  const products = await stripe.products.list({ active: true, limit: 20 });
  const prices = await stripe.prices.list({ active: true, limit: 50 });

  const productsMap = new Map();
  for (const p of products.data) {
    productsMap.set(p.id, {
      id: p.id,
      name: p.name,
      description: p.description,
      active: p.active,
      prices: [],
    });
  }
  for (const pr of prices.data) {
    if (pr.product && productsMap.has(pr.product)) {
      productsMap.get(pr.product).prices.push({
        id: pr.id,
        unitAmount: pr.unit_amount,
        currency: pr.currency,
        recurring: pr.recurring ? {
          interval: pr.recurring.interval,
          interval_count: pr.recurring.interval_count,
        } : null,
        active: pr.active,
      });
    }
  }
  return Array.from(productsMap.values());
}

// List products with prices
router.get("/products", async (_req, res): Promise<void> => {
  // Try in-memory cache first
  if (productCache && Date.now() - productCache.timestamp < CACHE_TTL_MS) {
    res.json({ data: productCache.data });
    return;
  }

  try {
    // Try database first
    const rows = await stripeStorage.listProductsWithPrices();
    const productsMap = new Map();
    for (const row of rows as any[]) {
      if (!productsMap.has(row.product_id)) {
        productsMap.set(row.product_id, {
          id: row.product_id,
          name: row.product_name,
          description: row.product_description,
          active: row.product_active,
          prices: [],
        });
      }
      if (row.price_id) {
        productsMap.get(row.product_id).prices.push({
          id: row.price_id,
          unitAmount: row.unit_amount,
          currency: row.currency,
          recurring: row.recurring,
          active: row.price_active,
        });
      }
    }
    const data = Array.from(productsMap.values());
    productCache = { data, timestamp: Date.now() };
    res.json({ data });
  } catch {
    // Fallback: fetch directly from Stripe API
    try {
      const data = await fetchProductsFromStripe();
      productCache = { data, timestamp: Date.now() };
      res.json({ data });
    } catch {
      // Stripe API not configured — return empty list with error flag
      res.json({ data: [], error: "Stripe is not configured. Please connect Stripe in Integrations." });
    }
  }
});

export default router;
