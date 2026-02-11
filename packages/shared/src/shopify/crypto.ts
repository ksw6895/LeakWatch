import crypto from 'crypto';

export function encryptAesGcm(plaintext: string, keyB64: string): string {
  const key = Buffer.from(keyB64, 'base64');
  if (key.length !== 32) {
    throw new Error('LW_ENCRYPTION_KEY_32B must decode to 32 bytes');
  }

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('base64')}.${encrypted.toString('base64')}.${tag.toString('base64')}`;
}

export function decryptAesGcm(ciphertext: string, keyB64: string): string {
  const [ivB64, encB64, tagB64] = ciphertext.split('.');
  if (!ivB64 || !encB64 || !tagB64) {
    throw new Error('invalid ciphertext format');
  }

  const key = Buffer.from(keyB64, 'base64');
  if (key.length !== 32) {
    throw new Error('LW_ENCRYPTION_KEY_32B must decode to 32 bytes');
  }

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encB64, 'base64')),
    decipher.final(),
  ]);

  return decrypted.toString('utf8');
}
