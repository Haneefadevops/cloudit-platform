import crypto from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12
const AUTH_TAG_LENGTH = 16

function getEncryptionKey() {
  const secret = process.env.MEETING_CREDENTIAL_ENCRYPTION_KEY
    ?? process.env.ENCRYPTION_KEY
    ?? process.env.NEXTAUTH_SECRET
    ?? process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!secret) {
    throw new Error('Missing MEETING_CREDENTIAL_ENCRYPTION_KEY or fallback secret')
  }

  return crypto.createHash('sha256').update(secret).digest()
}

export function encryptJson(value: unknown) {
  if (value === null || value === undefined) return null

  const iv = crypto.randomBytes(IV_LENGTH)
  const cipher = crypto.createCipheriv(ALGORITHM, getEncryptionKey(), iv, {
    authTagLength: AUTH_TAG_LENGTH,
  })
  const plaintext = JSON.stringify(value)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()

  return Buffer.concat([iv, authTag, encrypted]).toString('base64')
}

export function decryptJson<T = unknown>(encryptedValue?: string | null): T | null {
  if (!encryptedValue) return null

  const payload = Buffer.from(encryptedValue, 'base64')
  const iv = payload.subarray(0, IV_LENGTH)
  const authTag = payload.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH)
  const encrypted = payload.subarray(IV_LENGTH + AUTH_TAG_LENGTH)
  const decipher = crypto.createDecipheriv(ALGORITHM, getEncryptionKey(), iv, {
    authTagLength: AUTH_TAG_LENGTH,
  })
  decipher.setAuthTag(authTag)

  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8')
  return JSON.parse(decrypted) as T
}
