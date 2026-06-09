import Stripe from "stripe";

async function getStripeCredentials(): Promise<{ secretKey: string }> {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY
    ? "repl " + process.env.REPL_IDENTITY
    : process.env.WEB_REPL_RENEWAL
      ? "depl " + process.env.WEB_REPL_RENEWAL
      : null;

  if (!hostname || !xReplitToken) {
    throw new Error(
      "Missing Replit environment variables. " +
      "Ensure the Stripe integration is connected via the Integrations tab."
    );
  }

  const resp = await fetch(
    `https://${hostname}/api/v2/connection?include_secrets=true&connector_names=stripe`,
    {
      headers: { Accept: "application/json", X_REPLIT_TOKEN: xReplitToken },
      signal: AbortSignal.timeout(10_000),
    }
  );

  if (!resp.ok) {
    throw new Error(`Failed to fetch Stripe credentials: ${resp.status} ${resp.statusText}`);
  }

  const data = (await resp.json()) as any;
  const settings = data.items?.[0]?.settings;

  if (!settings?.secret_key) {
    throw new Error(
      "Stripe integration not connected or missing secret key. " +
      "Connect Stripe via the Integrations tab first."
    );
  }

  return { secretKey: settings.secret_key };
}

async function getUncachableStripeClient(): Promise<Stripe> {
  const { secretKey } = await getStripeCredentials();
  return new Stripe(secretKey);
}

async function createProducts() {
  try {
    const stripe = await getUncachableStripeClient();

    console.log("Creating products and prices in Stripe...");

    const existing = await stripe.products.search({
      query: "name:'Ascend Pro' AND active:'true'",
    });

    if (existing.data.length > 0) {
      console.log("Ascend Pro product already exists.");
      const product = existing.data[0];
      const prices = await stripe.prices.list({ product: product.id, active: true });
      console.log(`Product: ${product.id}`);
      prices.data.forEach((p) => {
        const amount = p.unit_amount ? `$${(p.unit_amount / 100).toFixed(2)}` : "N/A";
        const interval = (p as any).recurring?.interval || "one-time";
        console.log(`  Price: ${p.id} \u2014 ${amount}/${interval}`);
      });
      return;
    }

    const product = await stripe.products.create({
      name: "Ascend Pro",
      description: "Full AI coaching system with daily schedules, meal feedback, workouts, and coach chat.",
    });
    console.log(`Created product: ${product.name} (${product.id})`);

    const monthlyPrice = await stripe.prices.create({
      product: product.id,
      unit_amount: 999,
      currency: "usd",
      recurring: { interval: "month" },
    });
    console.log(`Created monthly price: $9.99/month (${monthlyPrice.id})`);

    const annualPrice = await stripe.prices.create({
      product: product.id,
      unit_amount: 9999,
      currency: "usd",
      recurring: { interval: "year" },
    });
    console.log(`Created annual price: $99.99/year (${annualPrice.id})`);

    console.log("\n\u2713 Products and prices created successfully!");
  } catch (error: any) {
    console.error("Error creating products:", error.message);
    process.exit(1);
  }
}

createProducts();
