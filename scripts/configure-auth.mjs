import { spawnSync } from "node:child_process";
import { exportJWK, exportPKCS8, generateKeyPair } from "jose";

const targetFlags = process.argv.slice(2);
if (targetFlags.some((flag) => flag !== "--prod")) {
  console.error("Usage: node scripts/configure-auth.mjs [--prod]");
  process.exit(1);
}

const keys = await generateKeyPair("RS256", { extractable: true });
const privateKey = (await exportPKCS8(keys.privateKey)).trimEnd().replace(/\n/g, " ");
const publicKey = await exportJWK(keys.publicKey);
const jwks = JSON.stringify({ keys: [{ use: "sig", ...publicKey }] });

for (const [name, value] of [["JWT_PRIVATE_KEY", privateKey], ["JWKS", jwks]]) {
  const result = spawnSync(
    "npx",
    ["convex", "env", "set", ...targetFlags, name, "--", value],
    { stdio: ["ignore", "ignore", "inherit"] },
  );
  if (result.status !== 0) process.exit(result.status ?? 1);
}

console.log(`Convex Auth signing keys configured for ${targetFlags.length ? "production" : "development"}.`);
