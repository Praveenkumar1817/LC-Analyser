/**
 * Vercel builds from the monorepo root but Next.js outputs to frontend/.next.
 * Copy build artifacts to the repo root where the Vercel Next.js builder expects them.
 */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const frontend = path.join(root, "frontend");
const nextSrc = path.join(frontend, ".next");
const nextDest = path.join(root, ".next");

function rmrf(target) {
  fs.rmSync(target, { recursive: true, force: true });
}

function copyDir(src, dest) {
  fs.cpSync(src, dest, { recursive: true });
}

if (!fs.existsSync(nextSrc)) {
  console.error(`Missing Next.js build output at ${nextSrc}`);
  process.exit(1);
}

const manifest = path.join(nextSrc, "routes-manifest.json");
if (!fs.existsSync(manifest)) {
  console.error(`Missing routes-manifest.json in ${nextSrc}`);
  process.exit(1);
}

rmrf(nextDest);
copyDir(nextSrc, nextDest);
console.log(`Copied ${nextSrc} -> ${nextDest}`);

const publicSrc = path.join(frontend, "public");
if (fs.existsSync(publicSrc)) {
  rmrf(path.join(root, "public"));
  copyDir(publicSrc, path.join(root, "public"));
  console.log("Copied frontend/public -> public");
}
