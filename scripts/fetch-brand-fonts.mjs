import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outputDir = resolve(root, "docs/brand-assets/fonts");

const files = [
  {
    name: "Recursive-VF-LatinBasic.woff2",
    url: "https://raw.githubusercontent.com/arrowtype/recursive/main/fonts/ArrowType-Recursive-1.085/Recursive_Web/woff2_variable/Recursive_VF_1.085--subset-GF_latin_basic.woff2",
    sha256: "7af699706ba1d2a1947f4755d177927597b24c168f8d46585dabdb080e4d113c",
  },
  {
    name: "OFL-Recursive.txt",
    url: "https://raw.githubusercontent.com/arrowtype/recursive/main/OFL.txt",
    sha256: "f9f539cf7549bd417159dbdb9c400943a5b60a7366c2c6fbde9f095173d82479",
  },
];

await mkdir(outputDir, { recursive: true });

for (const file of files) {
  const response = await fetch(file.url);
  if (!response.ok) throw new Error(`Failed ${file.url}: ${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  const digest = createHash("sha256").update(bytes).digest("hex");
  if (digest !== file.sha256) {
    throw new Error(`Checksum mismatch for ${file.name}: ${digest}`);
  }
  await writeFile(resolve(outputDir, file.name), bytes);
  console.log(`${file.name} ${bytes.length} bytes ${digest}`);
}
