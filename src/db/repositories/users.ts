import * as Crypto from 'expo-crypto';
import { getDb } from '../client';
import { btoa } from '@/utils/base64';
import type { AppUser } from '@/types';

// Pre-fix scheme: btoa(password + salt) with a hardcoded, shared salt. This
// is reversible in one line (atob(hash)), and since backups bundle the
// `users` table verbatim into a file that gets shared/emailed/uploaded,
// anyone with a copy of a backup could recover every password instantly.
// Kept ONLY so existing accounts (and old backups/PWA exports) can still
// log in — `loginUser` transparently upgrades them to the real hash below
// on next successful login.
const LEGACY_SALT = 'shs-salt-2026';
function legacyHash(password: string): string {
  return btoa(password + LEGACY_SALT);
}

// Real hash: random 16-byte per-user salt + iterated SHA-256, stored as
// `v2$<iterations>$<saltHex>$<hashHex>`. `$` never appears in the legacy
// base64 alphabet, so the two formats can never collide.
const HASH_PREFIX = 'v2';
const ITERATIONS = 10000;

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function sha256Hex(input: string): Promise<string> {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, input, {
    encoding: Crypto.CryptoEncoding.HEX,
  });
}

async function iteratedHash(password: string, saltHex: string, iterations: number): Promise<string> {
  let value = `${saltHex}:${password}`;
  for (let i = 0; i < iterations; i++) {
    value = await sha256Hex(value);
  }
  return value;
}

async function newHash(password: string): Promise<string> {
  const saltHex = bytesToHex(Crypto.getRandomBytes(16));
  const hashHex = await iteratedHash(password, saltHex, ITERATIONS);
  return `${HASH_PREFIX}$${ITERATIONS}$${saltHex}$${hashHex}`;
}

async function verifyPassword(password: string, stored: string): Promise<boolean> {
  if (stored.startsWith(`${HASH_PREFIX}$`)) {
    const parts = stored.split('$');
    const iterations = Number(parts[1]) || ITERATIONS;
    const saltHex = parts[2] ?? '';
    const hashHex = parts[3] ?? '';
    const computed = await iteratedHash(password, saltHex, iterations);
    return computed === hashHex;
  }
  return stored === legacyHash(password);
}

export function getAllUsers(): AppUser[] {
  return getDb().getAllSync<AppUser>('SELECT username, passwordHash FROM users');
}

/** Backup restore, run as part of one outer transaction. */
export function replaceAllUsersRaw(users: AppUser[]) {
  const db = getDb();
  // Restoring a backup is supposed to replace everything — without this,
  // accounts that existed locally but aren't in the backup keep working.
  db.runSync('DELETE FROM users');
  for (const u of users) {
    db.runSync(
      'INSERT OR REPLACE INTO users (username, passwordHash) VALUES (?, ?)',
      u.username,
      u.passwordHash
    );
  }
}

export function replaceAllUsers(users: AppUser[]) {
  const db = getDb();
  db.withTransactionSync(() => replaceAllUsersRaw(users));
}

export async function registerUser(username: string, password: string): Promise<boolean> {
  const db = getDb();
  const existing = db.getFirstSync('SELECT username FROM users WHERE username = ?', username);
  if (existing) return false;
  const passwordHash = await newHash(password);
  db.runSync('INSERT INTO users (username, passwordHash) VALUES (?, ?)', username, passwordHash);
  return true;
}

export async function loginUser(username: string, password: string): Promise<boolean> {
  const db = getDb();
  const user = db.getFirstSync<AppUser>(
    'SELECT username, passwordHash FROM users WHERE username = ?',
    username
  );
  if (!user) return false;

  const ok = await verifyPassword(password, user.passwordHash);
  if (ok && !user.passwordHash.startsWith(`${HASH_PREFIX}$`)) {
    // Transparently upgrade the old reversible hash now that we know the password.
    const upgraded = await newHash(password);
    db.runSync('UPDATE users SET passwordHash = ? WHERE username = ?', upgraded, username);
  }
  return ok;
}

/**
 * Changes the password of an existing account. The current password must be
 * correct. Returns false (and changes nothing) if the account does not exist
 * or the current password is wrong.
 */
export async function changePassword(
  username: string,
  currentPassword: string,
  newPassword: string
): Promise<boolean> {
  const db = getDb();
  const user = db.getFirstSync<AppUser>(
    'SELECT username, passwordHash FROM users WHERE username = ?',
    username
  );
  if (!user) return false;
  const ok = await verifyPassword(currentPassword, user.passwordHash);
  if (!ok) return false;
  const passwordHash = await newHash(newPassword);
  db.runSync('UPDATE users SET passwordHash = ? WHERE username = ?', passwordHash, username);
  return true;
}
