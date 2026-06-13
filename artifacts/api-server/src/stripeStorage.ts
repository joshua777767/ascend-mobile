import { eq, sql } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";

export class StripeStorage {
  async getProduct(productId: string) {
    const result = await db.execute(sql`SELECT * FROM stripe.products WHERE id = ${productId}`);
    return (result.rows as any[])[0] || null;
  }

  async listProducts(active = true, limit = 20, offset = 0) {
    const result = await db.execute(
      sql`SELECT * FROM stripe.products WHERE active = ${active} LIMIT ${limit} OFFSET ${offset}`
    );
    return result.rows as any[];
  }

  async listProductsWithPrices(active = true, limit = 20, offset = 0) {
    const result = await db.execute(sql`
      WITH paginated_products AS (
        SELECT id, name, description, metadata, active
        FROM stripe.products
        WHERE active = ${active}
        ORDER BY id
        LIMIT ${limit} OFFSET ${offset}
      )
      SELECT
        p.id as product_id,
        p.name as product_name,
        p.description as product_description,
        p.active as product_active,
        p.metadata as product_metadata,
        pr.id as price_id,
        pr.unit_amount,
        pr.currency,
        pr.recurring,
        pr.active as price_active,
        pr.metadata as price_metadata
      FROM paginated_products p
      LEFT JOIN stripe.prices pr ON pr.product = p.id AND pr.active = true
      ORDER BY p.id, pr.unit_amount
    `);
    return result.rows as any[];
  }

  async getPrice(priceId: string) {
    const result = await db.execute(sql`SELECT * FROM stripe.prices WHERE id = ${priceId}`);
    return (result.rows as any[])[0] || null;
  }

  async listPrices(active = true, limit = 20, offset = 0) {
    const result = await db.execute(
      sql`SELECT * FROM stripe.prices WHERE active = ${active} LIMIT ${limit} OFFSET ${offset}`
    );
    return result.rows as any[];
  }

  async getPricesForProduct(productId: string) {
    const result = await db.execute(
      sql`SELECT * FROM stripe.prices WHERE product = ${productId} AND active = true`
    );
    return result.rows as any[];
  }

  async getSubscription(subscriptionId: string) {
    const result = await db.execute(
      sql`SELECT * FROM stripe.subscriptions WHERE id = ${subscriptionId}`
    );
    return (result.rows as any[])[0] || null;
  }

  async getSubscriptionByCustomer(customerId: string) {
    const result = await db.execute(
      sql`SELECT * FROM stripe.subscriptions WHERE customer = ${customerId} ORDER BY created DESC`
    );
    return result.rows as any[];
  }

  async getUser(id: number) {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, id));
    return user;
  }

  async getUserByStripeCustomerId(stripeCustomerId: string) {
    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.stripeCustomerId, stripeCustomerId));
    return user ?? null;
  }

  async updateUserStripeInfo(userId: number, stripeInfo: { stripeCustomerId?: string }) {
    const [user] = await db
      .update(usersTable)
      .set(stripeInfo)
      .where(eq(usersTable.id, userId))
      .returning();
    return user;
  }

  async updateUserSubscription(
    stripeCustomerId: string,
    update: {
      stripeSubscriptionId?: string | null;
      subscriptionStatus?: string | null;
    }
  ) {
    const [user] = await db
      .update(usersTable)
      .set(update)
      .where(eq(usersTable.stripeCustomerId, stripeCustomerId))
      .returning();
    return user ?? null;
  }
}

export const stripeStorage = new StripeStorage();
