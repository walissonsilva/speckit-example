export function maskPhoneNumber(phone: string): string {
  const visibleDigits = 4;
  if (phone.length <= visibleDigits) {
    return '*'.repeat(phone.length);
  }
  const masked = '*'.repeat(phone.length - visibleDigits);
  const visible = phone.slice(-visibleDigits);
  return `${masked}${visible}`;
}
