import { eq } from "drizzle-orm";

import { agents } from "../db/schema.js";
import { hashToken } from "./crypto.js";
import type { ServiceDatabase } from "../db/index.js";

export async function authenticateAgent(db: ServiceDatabase, token: string | undefined) {
  if (!token) {
    return null;
  }

  const rows = await db
    .select()
    .from(agents)
    .where(eq(agents.authTokenHash, hashToken(token)))
    .limit(1);

  return rows[0] ?? null;
}

export function getBearerToken(authorization: string | undefined): string | undefined {
  if (!authorization?.startsWith("Bearer ")) {
    return undefined;
  }

  return authorization.slice("Bearer ".length).trim();
}
