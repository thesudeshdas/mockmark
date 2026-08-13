import { spawnSync } from "node:child_process";
import { exportJWK, exportPKCS8, generateKeyPair } from "jose";

const keys = await generateKeyPair("RS256", { extractable: true });
const privateKey = (await exportPKCS8(keys.privateKey)).trimEnd().replace(/\n/g, " ");
const publicKey = await exportJWK(keys.publicKey);
const jwks = JSON.stringify({ keys: [{ use: "sig", ...publicKey }] });

for (const [name, value] of [["JWT_PRIVATE_KEY", privateKey], ["JWKS", jwks]]) {
  const result = spawnSync("npx", ["convex", "env", "set", name, "--", value], { stdio: ["ignore", "ignore", "inherit"] });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

console.log("Convex Auth signing keys configured for selected deployment.");
