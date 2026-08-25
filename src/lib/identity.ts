import { createHash, randomBytes } from 'node:crypto';

export function hashIdentifier(value: string) {
  return createHash('sha256').update(value.trim()).digest('hex');
}

export function createConsentCode() {
  return `JIVA-${randomBytes(3).toString('hex').toUpperCase()}`;
}

export function normalizeIdentifier(value: FormDataEntryValue | null) {
  return String(value ?? '').replace(/\D/g, '');
}

export function maskPhone(phone: string) {
  if (phone.length < 4) {
    return phone;
  }

  return `${phone.slice(0, 2)}******${phone.slice(-2)}`;
}
