import fs from "node:fs";
import path from "node:path";

const root = path.resolve("dist");
const htmlFiles = [];

function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(file);
    else if (entry.name.endsWith(".html")) htmlFiles.push(file);
  }
}

walk(root);

const referencePattern = /(?:src|href)=["']([^"'#]+)["']/gi;
const missing = [];

for (const htmlFile of htmlFiles) {
  const html = fs.readFileSync(htmlFile, "utf8");
  for (const match of html.matchAll(referencePattern)) {
    const reference = match[1];
    if (/^(?:https?:|mailto:|tel:|javascript:)/i.test(reference)) continue;
    if (reference.startsWith("data:")) continue;

    const relativePath = reference.startsWith("/")
      ? reference.slice(1)
      : path.relative(root, path.resolve(path.dirname(htmlFile), reference.split("?")[0]));
    const target = path.resolve(root, relativePath);
    if (!fs.existsSync(target)) {
      missing.push(`${path.relative(root, htmlFile)} -> ${reference}`);
    }
  }
}

if (missing.length) {
  console.error("Missing local references:");
  for (const item of missing) console.error(`- ${item}`);
  process.exit(1);
}

console.log(`Validated ${htmlFiles.length} HTML files and all local asset references.`);
