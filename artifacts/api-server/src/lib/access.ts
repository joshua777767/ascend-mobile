const LIFETIME_PRO_EMAILS = new Set(["jquag7@gmail.com"]);

export function isLifetimeProAccount(email: string): boolean {
  return LIFETIME_PRO_EMAILS.has(email.trim().toLowerCase());
}