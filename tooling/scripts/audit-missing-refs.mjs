import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const ignoreDirs = new Set([
  "node_modules",
  ".git",
  ".vscode",
  "dist",
  "build",
  "output",
  "logs",
  "coverage"
]);

const scriptExtensions = [".js", ".mjs", ".cjs", ".jsx", ".ts", ".tsx", ".json"];
const missing = [];

const isHttpLike = (value) => /^(https?:)?\/\//i.test(value) || /^data:/i.test(value);

function* walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (ignoreDirs.has(entry.name)) {
        continue;
      }
      yield* walk(path.join(dir, entry.name));
      continue;
    }
    yield path.join(dir, entry.name);
  }
}

const resolveImportPath = (baseDir, importPath) => {
  const cleaned = importPath.split("?")[0].split("#")[0];
  const candidate = path.resolve(baseDir, cleaned);
  if (path.extname(candidate)) {
    return fs.existsSync(candidate) ? candidate : null;
  }
  for (const ext of scriptExtensions) {
    if (fs.existsSync(candidate + ext)) {
      return candidate + ext;
    }
  }
  for (const ext of scriptExtensions) {
    const indexCandidate = path.join(candidate, `index${ext}`);
    if (fs.existsSync(indexCandidate)) {
      return indexCandidate;
    }
  }
  return null;
};

const resolveAssetPath = (baseDir, assetPath) => {
  const cleaned = assetPath.split("?")[0].split("#")[0];
  if (!cleaned) {
    return null;
  }
  if (cleaned.startsWith("/")) {
    return path.join(root, "frontend", cleaned.replace(/^\/+/, ""));
  }
  return path.resolve(baseDir, cleaned);
};

for (const filePath of walk(root)) {
  const ext = path.extname(filePath).toLowerCase();
  if (!fs.existsSync(filePath)) {
    continue;
  }
  const content = fs.readFileSync(filePath, "utf8");
  const dir = path.dirname(filePath);

  if ([".js", ".mjs", ".cjs", ".jsx", ".ts", ".tsx"].includes(ext)) {
    const importMatches = [...content.matchAll(/from\s+["'](\.[^"']+)["']/g)];
    const requireMatches = [...content.matchAll(/require\(["'](\.[^"']+)["']\)/g)];
    for (const match of [...importMatches, ...requireMatches]) {
      const ref = match[1];
      const resolved = resolveImportPath(dir, ref);
      if (!resolved) {
        missing.push({ type: "js", file: filePath, ref });
      }
    }
  }

  if (ext === ".html") {
    const matches = [...content.matchAll(/(?:src|href)=["']([^"']+)["']/g)];
    for (const match of matches) {
      const ref = match[1];
      if (isHttpLike(ref)) {
        continue;
      }
      const resolved = resolveAssetPath(dir, ref);
      if (resolved && !fs.existsSync(resolved)) {
        missing.push({ type: "html", file: filePath, ref, resolved });
      }
    }
  }

  if (ext === ".css") {
    const matches = [...content.matchAll(/url\(["']?([^"')]+)["']?\)/g)];
    for (const match of matches) {
      const ref = match[1];
      if (isHttpLike(ref)) {
        continue;
      }
      const resolved = resolveAssetPath(dir, ref);
      if (resolved && !fs.existsSync(resolved)) {
        missing.push({ type: "css", file: filePath, ref, resolved });
      }
    }
  }
}

if (!missing.length) {
  console.log("✓ No missing file references found.");
  process.exit(0);
}

console.log(`✗ Missing references found: ${missing.length}`);
missing.slice(0, 25).forEach((entry) => {
  const resolved = entry.resolved ? ` (${entry.resolved})` : "";
  console.log(`- [${entry.type}] ${entry.file} -> ${entry.ref}${resolved}`);
});
if (missing.length > 25) {
  console.log("(Showing first 25 only.)");
}
process.exit(1);
