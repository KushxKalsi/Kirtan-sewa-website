import crypto from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(crypto.scrypt);

// Passwords are stored as "scrypt$<salt>$<hash>" (base64), never in plain text.
export async function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = await scrypt(String(password), salt, 64);
  return `scrypt$${salt.toString('base64')}$${hash.toString('base64')}`;
}

const DUMMY = 'scrypt$AAAAAAAAAAAAAAAAAAAAAA==$' + Buffer.alloc(64).toString('base64');

/** True when the password matches. Unknown accounts still take the same time, so phone numbers can't be probed. */
export async function checkPassword(password, stored) {
  const [kind, salt, hash] = String(stored || DUMMY).split('$');
  if (kind !== 'scrypt' || !salt || !hash) return false;
  const expected = Buffer.from(hash, 'base64');
  const given = await scrypt(String(password), Buffer.from(salt, 'base64'), expected.length);
  return crypto.timingSafeEqual(expected, given) && !!stored;
}

export function passwordProblem(password) {
  const p = String(password || '');
  if (p.length < 6) return 'Password must be at least 6 characters.';
  if (p.length > 100) return 'Password is too long.';
  return '';
}

/**
 * Signed session tokens for customers ("user") and team members ("member"):
 * role.id.version.expiry.signature. Changing a password bumps the version, which logs out other devices.
 */
export function sessions(secret) {
  const sign = (s) => crypto.createHmac('sha256', secret).update(s).digest('base64url');
  const same = (a, b) => a.length === b.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
  return {
    make(role, id, version = 0, ttl = 1000 * 60 * 60 * 24 * 60) {
      const body = `${role}.${id}.${version}.${Date.now() + ttl}`;
      return `${body}.${sign(body)}`;
    },
    read(token) {
      const parts = String(token || '').split('.');
      if (parts.length !== 5) return null;
      const [role, id, version, exp, sig] = parts;
      if (!same(sign(parts.slice(0, 4).join('.')), sig) || Number(exp) < Date.now()) return null;
      return { role, id, version: Number(version) };
    },
    // Private files (team documents) are opened with a short-lived signed link, since <img> can't send a token.
    fileQuery(id, ttl = 1000 * 60 * 60 * 6) {
      const exp = Date.now() + ttl;
      return `exp=${exp}&sig=${sign(`file.${id}.${exp}`)}`;
    },
    fileOk(id, exp, sig) {
      return typeof sig === 'string' && Number(exp) > Date.now() && same(sign(`file.${id}.${exp}`), sig);
    },
  };
}
