/**
 * Cryptographic Utilities
 * ========================
 * 
 * Handles all cryptographic operations:
 * - Password hashing with Argon2id (memory-hard, GPU resistant)
 * - Token generation (cryptographically secure)
 * - Hash verification
 * - Device fingerprint generation
 * 
 * SECURITY PRINCIPLES:
 * - Never return plaintext passwords
 * - Always use constant-time comparison
 * - Argon2id parameters tuned for security (100ms hash time)
 * - Tokens use crypto.randomBytes (cryptographically secure PRNG)
 * 
 * WHY ARGON2ID (not bcrypt):
 * - Memory-hard: Resistant to GPU/ASIC attacks
 * - Time & space params: Can be increased as hardware improves
 * - Industry standard: OWASP recommendation, used by AWS/Google
 * - Bcrypt limitation: 72-byte input limit (silently truncates passwords)
 */

import crypto from 'crypto';
import argon2 from 'argon2';

/**
 * Password hashing configuration
 * Tuned for ~100ms per hash on modern hardware
 * t=2 iterations, m=65540 memory (64MB per hash)
 */
const ARGON2_CONFIG = {
  type: argon2.argon2id,
  timeCost: 2,        // iterations
  memoryCost: 65540,  // KB
  parallelism: 1,     // threads
  raw: false,         // return encoded string
  hashLength: 32,     // bytes
  saltLength: 16      // bytes
};

/**
 * Hash a password using Argon2id
 * 
 * ALWAYS use this for password storage, never bcrypt alone
 * 
 * @param password Raw password string (min 12 chars, enforced in model)
 * @returns Promise<string> Encoded hash (includes salt, ready for storage)
 * 
 * @example
 * const hash = await hashPassword('MyP@ssw0rd!');
 * // Result: $argon2id$v=19$m=65540,t=2,p=1$...salt...$...hash...
 */
export async function hashPassword(password: string): Promise<string> {
  if (!password || typeof password !== 'string') {
    throw new Error('Password must be a non-empty string');
  }
  
  if (password.length < 6) {
    throw new Error('Password must be at least 6 characters');
  }
  
  try {
    return await argon2.hash(password, ARGON2_CONFIG);
  } catch (error) {
    throw new Error(`Password hashing failed: ${(error as Error).message}`);
  }
}

/**
 * Verify a password against its hash
 * Uses constant-time comparison to prevent timing attacks
 * 
 * SECURITY: Always use this, never strcmp/===
 * 
 * @param password Raw password string (from login form)
 * @param hash Stored hash (from database)
 * @returns Promise<boolean> True if password matches
 * 
 * @example
 * const isValid = await verifyPassword(loginPassword, storedHash);
 * if (!isValid) throw new UnauthorizedError();
 */
export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  if (!password || !hash) {
    return false;
  }

  try {
    return await argon2.verify(hash, password);
  } catch (error) {
    // Log invalid hash format, but don't throw (user sees "invalid password")
    console.warn('Password verification error:', (error as Error).message);
    return false;
  }
}

/**
 * Generate a cryptographically secure random token
 * Used for: refresh tokens, email verification, password reset tokens
 * 
 * SECURITY: crypto.randomBytes is cryptographically secure PRNG
 * Never use Math.random() for security tokens
 * 
 * @param length Number of bytes (typically 32-64)
 * @returns string Hex-encoded random bytes
 * 
 * @example
 * const refreshToken = generateToken(32);
 * // Result: "a1f2b3c4d5e6f7g8h9i0j1k2l3m4n5o6..."
 */
export function generateToken(length: number = 32): string {
  if (length < 16) {
    throw new Error('Token length must be at least 16 bytes');
  }
  
  return crypto.randomBytes(length).toString('hex');
}

/**
 * Hash a token for storage
 * Tokens themselves are not stored, only their hashes
 * When token is used, hash it again and compare
 * 
 * SECURITY: If DB is breached, attackers can't use leaked hashes
 * 
 * @param token Plain token
 * @returns string Bcrypt hash (different from password hash)
 * 
 * @example
 * const tokenHash = hashToken(refreshToken);
 * // Store tokenHash in DB
 * // On refresh, hash the token again and compare
 */
export async function hashToken(token: string): Promise<string> {
  if (!token) {
    throw new Error('Token cannot be empty');
  }
  
  // Use bcrypt for tokens (simpler, faster than argon2 for tokens)
  // Only tokens, not passwords
  const bcryptjs = await import('bcryptjs');
  const salt = await bcryptjs.genSalt(10);
  return await bcryptjs.hash(token, salt);
}

/**
 * Verify a token against its hash
 * 
 * @param token Plain token (from request header/cookie)
 * @param hash Stored hash (from database)
 * @returns Promise<boolean> True if token matches hash
 */
export async function verifyToken(
  token: string,
  hash: string
): Promise<boolean> {
  if (!token || !hash) {
    return false;
  }

  try {
    const bcryptjs = await import('bcryptjs');
    return await bcryptjs.compare(token, hash);
  } catch (error) {
    return false;
  }
}

/**
 * Generate a device fingerprint
 * Combination of: user agent + IP address + system timezone
 * Used to detect new devices / suspicious logins
 * 
 * NOT for tracking users, but for SECURITY
 * Same user, same device, same result
 * Same user, different device, different result
 * 
 * @param userAgent Browser/client identification
 * @param ipAddress Client IP address
 * @param timezone Client timezone (e.g., "America/New_York")
 * @returns string SHA256 hash of device characteristics
 * 
 * @example
 * const deviceId = generateDeviceFingerprint(
 *   'Mozilla/5.0...',
 *   '192.168.1.1',
 *   'UTC'
 * );
 */
export function generateDeviceFingerprint(
  userAgent: string,
  ipAddress: string,
  timezone: string = 'UTC'
): string {
  if (!userAgent || !ipAddress) {
    throw new Error('userAgent and ipAddress are required');
  }

  const deviceString = `${userAgent}|${ipAddress}|${timezone}`;
  return crypto
    .createHash('sha256')
    .update(deviceString)
    .digest('hex');
}

/**
 * Generate CSRF token
 * Per-session, used to prevent cross-site request forgery
 * 
 * Format: random bytes, hex-encoded
 * Stored in: session (server-side), cookie (client-side)
 * Validated: Automatic on state-changing requests (POST/PATCH/DELETE)
 * 
 * @returns string CSRF token (64 bytes = 128 hex chars)
 * 
 * @example
 * const csrfToken = generateCSRFToken();
 * // Send to frontend in form/header
 * // Frontend includes in all POST/PATCH/DELETE
 */
export function generateCSRFToken(): string {
  return generateToken(64);
}

/**
 * Hash a value using SHA256
 * For: checksums, verification, non-password hashing
 * DO NOT use for passwords (use hashPassword instead)
 * 
 * @param value String to hash
 * @returns string Hex-encoded SHA256 hash
 */
export function sha256Hash(value: string): string {
  return crypto
    .createHash('sha256')
    .update(value)
    .digest('hex');
}

/**
 * HMAC signature
 * For: webhook verification (Stripe, PayPal, etc)
 * 
 * @param payload Data to sign
 * @param secret Signing secret
 * @param algorithm Hash algorithm (default: sha256)
 * @returns string Hex signature
 * 
 * @example
 * const signature = hmacSign(stripeWebhookBody, stripeSecret);
 */
export function hmacSign(
  payload: string,
  secret: string,
  algorithm: string = 'sha256'
): string {
  return crypto
    .createHmac(algorithm, secret)
    .update(payload)
    .digest('hex');
}

/**
 * Verify an HMAC signature
 * Constant-time comparison to prevent timing attacks
 * 
 * @param payload Original data
 * @param signature Provided signature
 * @param secret Signing secret
 * @returns boolean True if signature is valid
 */
export function hmacVerify(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const expected = hmacSign(payload, secret);
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected)
  );
}

/**
 * Encrypt data using AES-256-GCM
 * For: sensitive data at rest (PII, payment details)
 * 
 * NEVER store raw credit card numbers
 * NEVER store raw SSNs
 * ONLY use Stripe tokenization for payment data
 * 
 * @param plaintext Data to encrypt
 * @param encryptionKey 32-byte key (from environment)
 * @returns Encrypted data with IV and auth tag
 */
export function encryptData(
  plaintext: string,
  encryptionKey: string
): string {
  if (!encryptionKey || encryptionKey.length < 32) {
    throw new Error('Encryption key must be at least 32 characters');
  }

  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(
    'aes-256-gcm',
    Buffer.from(encryptionKey.slice(0, 32)),
    iv
  );

  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag();

  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

/**
 * Decrypt AES-256-GCM encrypted data
 * 
 * @param encryptedData Encrypted data (format: iv:authTag:ciphertext)
 * @param encryptionKey Same key used for encryption
 * @returns Decrypted plaintext
 */
export function decryptData(
  encryptedData: string,
  encryptionKey: string
): string {
  if (!encryptionKey || encryptionKey.length < 32) {
    throw new Error('Encryption key must be at least 32 characters');
  }

  const [ivHex, authTagHex, ciphertext] = encryptedData.split(':');
  
  if (!ivHex || !authTagHex || !ciphertext) {
    throw new Error('Invalid encrypted data format');
  }

  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    Buffer.from(encryptionKey.slice(0, 32)),
    iv
  );

  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}
