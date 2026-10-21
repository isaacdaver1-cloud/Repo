// Echo website build.
// Copies src/ to dist/, fills in site.config.json values, joins the shared
// header/footer, minifies HTML and CSS, and scrambles (obfuscates) the site's
// own JavaScript so the published code is hard to read.
//
//   npm run build            -> production build (all tools required)
//   npm run build -- --lite  -> minify only, for quick local previews

import { promises as fs } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(root, "src");
const OUT = path.join(root, "dist");
const LITE = process.argv.includes("--lite");

// ---------- tools ----------
const require = createRequire(import.meta.url);
function load(name) {
  const tries = [name, path.join("/opt/npm-tools/node_modules", name)];
  for (const t of tries) {
    try { return require(t); } catch { /* try next */ }
  }
  return null;
}
const esbuild = load("esbuild");
const Obfuscator = load("javascript-obfuscator");
const htmlMin = load("html-minifier-terser");

const missing = [];
if (!esbuild) missing.push("esbuild");
if (!LITE && !Obfuscator) missing.push("javascript-obfuscator");
if (!LITE && !htmlMin) missing.push("html-minifier-terser");
if (missing.length) {
  console.error(`\n✖ Missing build tools: ${missing.join(", ")}. Run "npm install" first.\n`);
  process.exit(1);
}

// ---------- config ----------
const config = JSON.parse(await fs.readFile(path.join(root, "site.config.json"), "utf8"));
config.year = String(new Date().getFullYear());
config.siteUrl = String(config.siteUrl || "").replace(/\/+$/, "");

const placeholders = [];
if (/YOUR NAME|STUDIO NAME/i.test(config.developerName)) placeholders.push("developerName");
if (/example\.com/i.test(config.contactEmail)) placeholders.push("contactEmail");
if (/your-site/i.test(config.siteUrl)) placeholders.push("siteUrl");

// ---------- helpers ----------
async function walk(dir) {
  const out = [];
  for (const e of await fs.readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...(await walk(p)));
    else out.push(p);
  }
  return out;
}

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

async function fillTemplate(html) {
  // shared partials
  html = await replaceAsync(html, /<!--\s*@include\s+([\w.-]+)\s*-->/g, async (_, file) =>
    fs.readFile(path.join(SRC, "partials", file), "utf8"));
  // <!-- if:key --> ... <!-- else:key --> ... <!-- endif:key -->
  html = html.replace(/<!--\s*if:(\w+)\s*-->([\s\S]*?)(?:<!--\s*else:\1\s*-->([\s\S]*?))?<!--\s*endif:\1\s*-->/g,
    (_, key, yes, no = "") => (config[key] ? yes : no));
  // {{key}}
  html = html.replace(/\{\{\s*(\w+)\s*\}\}/g, (m, key) => (key in config ? esc(config[key]) : m));
  return html;
}

async function replaceAsync(str, re, fn) {
  const parts = [];
  let last = 0;
  for (const m of str.matchAll(re)) {
    parts.push(str.slice(last, m.index), await fn(...m));
    last = m.index + m[0].length;
  }
  parts.push(str.slice(last));
  return parts.join("");
}

function scramble(code, file) {
  return Obfuscator.obfuscate(code, {
    compact: true,
    sourceType: "module",
    target: "browser",
    controlFlowFlattening: true,
    controlFlowFlatteningThreshold: 0.25,
    deadCodeInjection: false,
    identifierNamesGenerator: "hexadecimal",
    numbersToExpressions: true,
    renameGlobals: false,
    selfDefending: false,
    simplify: true,
    splitStrings: true,
    splitStringsChunkLength: 6,
    stringArray: true,
    stringArrayEncoding: ["base64"],
    stringArrayRotate: true,
    stringArrayShuffle: true,
    stringArrayThreshold: 0.8,
    transformObjectKeys: true,
    unicodeEscapeSequence: false,
    sourceMap: false,
    inputFileName: file,
  }).getObfuscatedCode();
}

// ---------- build ----------
await fs.rm(OUT, { recursive: true, force: true });
const files = await walk(SRC);
let counts = { html: 0, js: 0, css: 0, copied: 0 };

for (const file of files) {
  const rel = path.relative(SRC, file);
  if (rel.startsWith("partials" + path.sep)) continue;
  const dest = path.join(OUT, rel);
  await fs.mkdir(path.dirname(dest), { recursive: true });
  const ext = path.extname(file).toLowerCase();
  const isVendor = rel.split(path.sep).includes("vendor");

  if (ext === ".html") {
    let html = await fillTemplate(await fs.readFile(file, "utf8"));
    if (htmlMin) {
      html = await htmlMin.minify(html, {
        collapseWhitespace: true,
        conservativeCollapse: false,
        removeComments: true,
        removeRedundantAttributes: true,
        removeScriptTypeAttributes: false,
        minifyCSS: true,
        minifyJS: true,
        sortAttributes: true,
        sortClassName: false,
      });
    } else {
      html = html.replace(/<!--(?!\[if)[\s\S]*?-->/g, "").replace(/>\s+</g, "> <");
    }
    await fs.writeFile(dest, html);
    counts.html++;
  } else if (ext === ".js" && !isVendor) {
    const src = await fs.readFile(file, "utf8");
    let code = (await esbuild.transform(src, { minify: true, format: "esm", target: "es2019", legalComments: "none" })).code;
    if (!LITE) code = scramble(code, rel);
    const banner = `/*! ${config.gameName} website. Copyright (c) ${config.year} ${config.developerName}. All rights reserved. Unauthorised copying, reverse engineering or reuse of this code is prohibited. */\n`;
    await fs.writeFile(dest, banner + code);
    counts.js++;
  } else if (ext === ".css") {
    const src = await fs.readFile(file, "utf8");
    const { code } = await esbuild.transform(src, { loader: "css", minify: true, legalComments: "none" });
    await fs.writeFile(dest, `/*! Copyright (c) ${config.year} ${config.developerName}. All rights reserved. */\n` + code);
    counts.css++;
  } else if ([".txt", ".xml", ".webmanifest"].includes(ext)) {
    await fs.writeFile(dest, (await fs.readFile(file, "utf8")).replace(/\{\{\s*(\w+)\s*\}\}/g, (m, k) => (k in config ? config[k] : m)));
    counts.copied++;
  } else {
    await fs.copyFile(file, dest);
    counts.copied++;
  }
}

console.log(`✔ Built ${counts.html} pages, ${counts.js} scripts${LITE ? " (minified only)" : " (obfuscated)"}, ${counts.css} stylesheets, ${counts.copied} other files into dist/`);
if (placeholders.length) {
  console.warn(`\n⚠ site.config.json still has placeholder values for: ${placeholders.join(", ")}.`);
  console.warn("  Meta will reject a privacy policy without a real owner and contact. Fill these in before you submit.\n");
}
