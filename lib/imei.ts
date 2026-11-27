/** Keeps only the digits of what the seller typed or pasted. */
export function cleanImei(input: string): string {
  return input.replace(/\D/g, "");
}

/** An IMEI is 15 digits and its last digit is a check digit (the Luhn rule). This catches typing mistakes. */
export function isValidImei(input: string): boolean {
  const digits = cleanImei(input);
  if (digits.length !== 15) return false;
  let sum = 0;
  for (let i = 0; i < 15; i++) {
    let d = Number(digits[14 - i]);
    if (i % 2 === 1) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  return sum % 10 === 0;
}

export const IMEI_HELP = "Dial *#06# on the phone to see its 15-digit IMEI.";
