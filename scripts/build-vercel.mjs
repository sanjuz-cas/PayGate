import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

console.log("==> Building PayGate for Vercel...");

// 1. Build @juicebag-mail/shared
console.log("==> [1/3] Building shared package...");
execSync("pnpm --filter @juicebag-mail/shared build", { stdio: "inherit" });

// 2. Build demo-ui
console.log("==> [2/3] Building demo-ui with Vite...");
execSync("pnpm --filter @juicebag-mail/demo-ui build", { stdio: "inherit" });

// 3. Mirror apps/demo-ui/dist to root dist/ for Vercel compatibility
console.log("==> [3/3] Synchronizing output directories for Vercel...");
const srcDist = path.resolve(process.cwd(), "apps/demo-ui/dist");
const rootDist = path.resolve(process.cwd(), "dist");

if (fs.existsSync(srcDist)) {
  fs.mkdirSync(rootDist, { recursive: true });
  fs.cpSync(srcDist, rootDist, { recursive: true });
  console.log("==> Successfully created root dist/ and apps/demo-ui/dist/");
}

console.log("==> Vercel build complete! 🎉");
