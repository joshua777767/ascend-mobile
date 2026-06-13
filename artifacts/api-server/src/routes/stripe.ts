import { Router, type IRouter } from "express";
import { stripeStorage } from "../stripeStorage";
import { stripeService } from "../stripeService";
import { getUserId } from "../middlewares/auth";

const router: IRouter = Router();

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

export default router;
