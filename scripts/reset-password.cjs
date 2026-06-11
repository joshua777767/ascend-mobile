const { scrypt, randomBytes } = require('crypto');
const { promisify } = require('util');
const scryptAsync = promisify(scrypt);
const KEY_LEN = 64;

async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const derived = await scryptAsync(password, salt, KEY_LEN);
  return salt + ':' + derived.toString('hex');
}

(async () => {
  const password = process.argv[2] || 'Quaglia1!';
  const hash = await hashPassword(password);
  console.log(hash);
})();
