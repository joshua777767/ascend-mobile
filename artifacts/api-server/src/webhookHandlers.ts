import { getStripeSync } from "./stripeClient";
import { stripeStorage } from "./stripeStorage";
import { logger } from "./lib/logger";

// Stripe event types we care about for updating usersTable
type StripeEventType =
  | "checkout.session.completed"
  | "customer.subscription.updated"
  | "customer.subscription.deleted";

interface RawStripeEvent {
  type: string;
  data: { object: Record<string, unknown> };
}

export class WebhookHandlers {
  static async processWebhook(payload: Buffer, signature: string): Promise<void> {
    if (!Buffer.isBuffer(payload)) {
      throw new Error(
        "STRIPE WEBHOOK ERROR: Payload must be a Buffer. " +
        "Received type: " + typeof payload + ". " +
        "This usually means express.json() parsed the body before reaching this handler. " +
        "FIX: Ensure webhook route is registered BEFORE app.use(express.json())."
      );
    }

    // 1. Let stripe-replit-sync validate the signature and sync stripe.* tables
    const sync = await getStripeSync();
    await sync.processWebhook(payload, signature);

    // 2. Parse the already-verified payload to update usersTable.
    //    No re-verification needed — sync.processWebhook already validated the sig.
    try {
      const event = JSON.parse(payload.toString()) as RawStripeEvent;
      await WebhookHandlers.syncUserFromEvent(event);
    } catch (err) {
      // Non-fatal: auth/me and login both fall back to real-time Stripe API checks.
      logger.warn({ err }, "webhook: failed to sync user subscription from event");
    }
  }

  static async syncUserFromEvent(event: RawStripeEvent): Promise<void> {
    const obj = event.data.object;

    switch (event.type as StripeEventType) {
      case "checkout.session.completed": {
        const customerId = (obj.customer as string | null) ?? null;
        const subscriptionId = (obj.subscription as string | null) ?? null;
        const paymentStatus = (obj.payment_status as string | null) ?? null;

        if (!customerId) return;

        // Determine subscription status from the checkout session
        let subscriptionStatus: string;
        if (subscriptionId) {
          // For subscription mode, payment_status drives initial status:
          // "paid" → active, "no_payment_required" → trialing (free trial start)
          subscriptionStatus = paymentStatus === "no_payment_required" ? "trialing" : "active";
        } else {
          // One-time payment (unlikely in this app but handle defensively)
          subscriptionStatus = "active";
        }

        const updated = await stripeStorage.updateUserSubscription(customerId, {
          stripeSubscriptionId: subscriptionId,
          subscriptionStatus,
        });

        if (updated) {
          logger.info(
            { userId: updated.id, customerId, subscriptionId, subscriptionStatus },
            "webhook: checkout.session.completed — user subscription activated"
          );
        } else {
          logger.warn(
            { customerId },
            "webhook: checkout.session.completed — no user found for stripeCustomerId"
          );
        }
        break;
      }

      case "customer.subscription.updated": {
        const customerId = (obj.customer as string | null) ?? null;
        const subscriptionId = (obj.id as string | null) ?? null;
        const subscriptionStatus = (obj.status as string | null) ?? null;

        if (!customerId || !subscriptionStatus) return;

        const updated = await stripeStorage.updateUserSubscription(customerId, {
          stripeSubscriptionId: subscriptionId,
          subscriptionStatus,
        });

        if (updated) {
          logger.info(
            { userId: updated.id, customerId, subscriptionId, subscriptionStatus },
            "webhook: customer.subscription.updated — user subscription status synced"
          );
        }
        break;
      }

      case "customer.subscription.deleted": {
        const customerId = (obj.customer as string | null) ?? null;
        if (!customerId) return;

        const updated = await stripeStorage.updateUserSubscription(customerId, {
          subscriptionStatus: "canceled",
        });

        if (updated) {
          logger.info(
            { userId: updated.id, customerId },
            "webhook: customer.subscription.deleted — user subscription canceled"
          );
        }
        break;
      }

      default:
        // Other events don't affect user subscription state
        break;
    }
  }
}
