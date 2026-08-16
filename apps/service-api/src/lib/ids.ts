import crypto from "node:crypto";

export function createId(prefix: string): string {
  return `${prefix}_${crypto.randomBytes(8).toString("hex")}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}
