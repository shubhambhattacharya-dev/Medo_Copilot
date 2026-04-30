import crypto from "crypto";

// Ensure this key is exactly 32 bytes (256 bits) long in your environment variables.
// You can generate one via: openssl rand -hex 32
const getMasterKey = () => {
  const key = process.env.ENCRYPTION_MASTER_KEY;
  if (!key) {
    throw new Error("ENCRYPTION_MASTER_KEY is not defined in environment variables");
  }
  // Convert hex to buffer, ensure it's exactly 32 bytes
  const buffer = Buffer.from(key, "hex");
  if (buffer.length !== 32) {
    throw new Error(`ENCRYPTION_MASTER_KEY must be exactly 64 hex characters (32 bytes), got ${key.length} characters`);
  }
  return buffer;
};

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const TAG_LENGTH = 16;

/**
 * Encrypts a string using AES-256-GCM.
 * Returns a hex string containing the IV, Tag, and Encrypted Data.
 */
export function encrypt(text: string): string {
  try {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, getMasterKey(), iv);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const tag = cipher.getAuthTag();
    
    // Format: iv:tag:encryptedData
    return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted}`;
  } catch (err) {
    console.error("Encryption failed:", err);
    throw new Error("Failed to encrypt data");
  }
}

/**
 * Decrypts a string previously encrypted with encrypt().
 */
export function decrypt(encryptedData: string): string {
  try {
    const parts = encryptedData.split(':');
    if (parts.length !== 3) {
      throw new Error("Invalid encrypted data format");
    }
    
    const iv = Buffer.from(parts[0], 'hex');
    const tag = Buffer.from(parts[1], 'hex');
    const encryptedText = parts[2];
    
    const decipher = crypto.createDecipheriv(ALGORITHM, getMasterKey(), iv);
    decipher.setAuthTag(tag);
    
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (err) {
    console.error("Decryption failed:", err);
    throw new Error("Failed to decrypt data. Check if ENCRYPTION_MASTER_KEY has changed.");
  }
}
