import { spawn } from "node:child_process";
import { loadEnvFile } from "node:process";

const separator = process.argv.indexOf("--");
if (separator < 1 || separator === process.argv.length - 1) {
  throw new Error("Usage: node scripts/run-with-env.mjs <env-file> [...env-files] -- <command> [...args]");
}

for (const envFile of process.argv.slice(2, separator)) {
  loadEnvFile(envFile);
}

const [command, ...args] = process.argv.slice(separator + 1);
const child = spawn(command, args, {
  cwd: process.cwd(),
  env: process.env,
  shell: process.platform === "win32",
  stdio: "inherit",
});

child.on("exit", (code, signal) => {
  process.exitCode = code ?? (signal ? 1 : 0);
});
