async function getRevenueCatCredentials(): Promise<{ apiKey: string }> {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY
    ? "repl " + process.env.REPL_IDENTITY
    : process.env.WEB_REPL_RENEWAL
      ? "depl " + process.env.WEB_REPL_RENEWAL
      : null;

  if (!hostname || !xReplitToken) {
    throw new Error(
      "Missing Replit environment variables. " +
      "Ensure the RevenueCat integration is connected via the Integrations tab."
    );
  }

  const resp = await fetch(
    `https://${hostname}/api/v2/connection?include_secrets=true&connector_names=revenuecat`,
    {
      headers: { Accept: "application/json", X_REPLIT_TOKEN: xReplitToken },
      signal: AbortSignal.timeout(10_000),
    }
  );

  if (!resp.ok) {
    throw new Error(`Failed to fetch RevenueCat credentials: ${resp.status} ${resp.statusText}`);
  }

  const data = (await resp.json()) as any;
  const settings = data.items?.[0]?.settings;

  if (!settings?.api_key) {
    throw new Error(
      "RevenueCat integration not connected or missing API key. " +
      "Connect RevenueCat via the Integrations tab first."
    );
  }

  return { apiKey: settings.api_key };
}

export async function getUncachableRevenueCatClient() {
  const { apiKey } = await getRevenueCatCredentials();
  const { createClient } = await import("@replit/revenuecat-sdk/client");
  return createClient({
    baseUrl: "https://api.revenuecat.com/v2",
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  });
}
