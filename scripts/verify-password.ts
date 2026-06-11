import { scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const scryptAsync = promisify(scrypt);
const KEY_LEN = 64;

async function verifyPassword(password: string, stored: string | null): Promise<boolean> {
  if (!stored) return false;
  const [salt, key] = stored.split(":");
  if (!salt || !key) return false;
  const keyBuf = Buffer.from(key, "hex");
  const derived = (await scryptAsync(password, salt, KEY_LEN)) as Buffer;
  if (keyBuf.length !== derived.length) return false;
  return timingSafeEqual(keyBuf, derived);
}

async function main() {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, "joshquag2010@icloud.com"));
  if (!user) {
    console.log("User not found");
    return;
  }

  const match = await verifyPassword("reGkar-sigke4-nomhej", user.passwordHash);
  console.log("Password match:", match);
  console.log("Has password hash:", !!user.passwordHash);
  console.log("Hash length:", user.passwordHash?.length);
  console.log("Has colon:", user.passwordHash?.includes(":"));
}

main().catch(console.error);
