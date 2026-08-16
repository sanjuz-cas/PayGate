import crypto from "node:crypto";

export function verifyWebhookSignature(input: {
  rawBody: string;
  secret: string;
  signature: string | undefined;
  timestamp: string | undefined;
}) {
  if (!input.signature || !input.timestamp) {
    return false;
  }

  const ageMs = Math.abs(Date.now() - Number(input.timestamp));
  if (!Number.isFinite(ageMs) || ageMs > 5 * 60 * 1000) {
    return false;
  }

  const expected = crypto
    .createHmac("sha256", input.secret)
    .update(`${input.timestamp}.${input.rawBody}`)
    .digest("hex");

  return crypto.timingSafeEqual(
    Buffer.from(expected),
    Buffer.from(input.signature),
  );
}
