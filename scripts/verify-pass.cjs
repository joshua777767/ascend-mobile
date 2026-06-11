const { scrypt, timingSafeEqual } = require('crypto');
const { promisify } = require('util');
const scryptAsync = promisify(scrypt);
const KEY_LEN = 64;

async function verifyPassword(password, stored) {
  const [salt, key] = stored.split(':');
  if (!salt || !key) return false;
  const keyBuf = Buffer.from(key, 'hex');
  const derived = await scryptAsync(password, salt, KEY_LEN);
  if (keyBuf.length !== derived.length) return false;
  return timingSafeEqual(keyBuf, derived);
}

(async () => {
  const hash = process.argv[2];
  const password = process.argv[3];
  const match = await verifyPassword(password, hash);
  console.log(match ? 'MATCH' : 'NO_MATCH');
})();
