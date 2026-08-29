import { z } from "zod";

export const addressVerifyRequestSchema = z.object({
  street1: z.string().min(1, "Street address is required"),
  street2: z.string().optional(),
  postalCode: z.string().min(1, "Postal code is required"),
  city: z.string().min(1, "City is required"),
  country: z.string().min(2).max(2, "Country must be a 2-letter ISO code"),
});

export const addressVerifyResponseSchema = z.object({
  valid: z.boolean(),
  confidence: z.number().min(0).max(1),
  issues: z.array(z.string()),
});

export type AddressVerifyRequest = z.infer<typeof addressVerifyRequestSchema>;
export type AddressVerifyResponse = z.infer<typeof addressVerifyResponseSchema>;

// Country-specific postal code patterns (simplified for demo purposes)
const POSTAL_PATTERNS: Record<string, RegExp> = {
  DE: /^\d{5}$/,      // Germany: 5 digits
  US: /^\d{5}(-\d{4})?$/,  // USA: 5 digits or 5+4
  GB: /^[A-Z]{1,2}\d{1,2}[A-Z]?\s*\d[A-Z]{2}$/i,  // UK: alphanumeric
  FR: /^\d{5}$/,      // France: 5 digits
  IT: /^\d{5}$/,      // Italy: 5 digits
  ES: /^\d{5}$/,      // Spain: 5 digits
  NL: /^\d{4}\s?[A-Z]{2}$/i,  // Netherlands: 4 digits + 2 letters
  AT: /^\d{4}$/,      // Austria: 4 digits
  CH: /^\d{4}$/,      // Switzerland: 4 digits
  AU: /^\d{4}$/,      // Australia: 4 digits
  CA: /^[A-Z]\d[A-Z]\s?\d[A-Z]\d$/i,  // Canada: A1A 1A1 format
  IN: /^\d{6}$/,      // India: 6 digits PIN code
};

// Valid ISO 3166-1 alpha-2 country codes (subset for demo)
const VALID_COUNTRY_CODES = new Set([
  "DE", "US", "GB", "FR", "IT", "ES", "NL", "AT", "CH", "AU", "CA",
  "BE", "SE", "NO", "DK", "FI", "PL", "CZ", "PT", "GR", "IE", "NZ",
  "JP", "KR", "SG", "HK", "IN", "BR", "MX", "AR", "CL", "ZA",
]);

export function verifyAddress(input: unknown): AddressVerifyResponse {
  const issues: string[] = [];
  let confidence = 1.0;

  // Parse and validate the input
  const parseResult = addressVerifyRequestSchema.safeParse(input);
  if (!parseResult.success) {
    const fieldErrors = parseResult.error.flatten().fieldErrors;
    for (const [field, errors] of Object.entries(fieldErrors)) {
      issues.push(`${field}: ${errors.join(", ")}`);
    }
    return {
      valid: false,
      confidence: 0.95,
      issues,
    };
  }

  const { street1, postalCode, city, country } = parseResult.data;
  const countryCode = country.toUpperCase();

  // Check if country code is valid
  if (!VALID_COUNTRY_CODES.has(countryCode)) {
    issues.push(`Invalid country code "${country}". Must be a valid ISO 3166-1 alpha-2 code.`);
    confidence -= 0.3;
  }

  // Check postal code format for known countries
  const pattern = POSTAL_PATTERNS[countryCode];
  if (pattern && !pattern.test(postalCode)) {
    issues.push(`Postal code "${postalCode}" does not match expected format for ${countryCode}`);
    confidence -= 0.2;
  }

  // Basic sanity checks
  if (street1.trim().length < 3) {
    issues.push("Street address seems too short");
    confidence -= 0.1;
  }

  if (city.trim().length < 2) {
    issues.push("City name seems too short");
    confidence -= 0.1;
  }

  // Check for obviously invalid patterns
  if (/^\d+$/.test(street1) && street1.length > 6) {
    issues.push("Street address appears to be only numbers - may be incomplete");
    confidence -= 0.15;
  }

  if (postalCode.toLowerCase().includes("test") || postalCode.includes("00000")) {
    issues.push("Postal code appears to be a placeholder or test value");
    confidence -= 0.2;
  }

  // Determine validity
  const valid = issues.length === 0 || (issues.length <= 1 && confidence >= 0.7);

  return {
    valid,
    confidence: Math.max(0, Math.min(1, confidence)),
    issues,
  };
}
