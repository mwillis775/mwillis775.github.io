#!/usr/bin/env node
// tools/build.mjs
// ---------------------------------------------------------------------------
// Build & maintenance entry-point for the Plant Families Explorer site.
//
// Subcommands:
//
//   node tools/build.mjs validate    # delegate to tools/validate.mjs
//   node tools/build.mjs extract     # scan families/*.html → data/families.csv
//   node tools/build.mjs fix-pages   # mechanically repair common bugs
//                                    # (broken logo path, stray </link> tags,
//                                    #  duplicate icon links, missing fonts)
//   node tools/build.mjs all         # extract + fix-pages + validate
//
// Pure Node.js (≥18), no third-party dependencies. The fix-pages subcommand
// only touches lines matching well-defined bug patterns; it never rewrites
// the body content of a family page.
// ---------------------------------------------------------------------------

import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import { spawnSync } from 'node:child_process';

const REPO_ROOT = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '..');
const FAMILIES_DIR = path.join(REPO_ROOT, 'families');
const CSV_PATH = path.join(REPO_ROOT, 'data', 'families.csv');

const cmd = (process.argv[2] || '').toLowerCase();

if (!cmd || cmd === 'help' || cmd === '--help' || cmd === '-h') {
  console.log(`tools/build.mjs — site build & maintenance

Subcommands:
  validate     Run the site validator (delegates to tools/validate.mjs)
  extract      Scrape families/*.html → data/families.csv master index
  fix-pages    Apply mechanical bug fixes to all family pages
  all          extract + fix-pages + validate

Flags (where applicable):
  --dry-run    Don't write changes, just report
`);
  process.exit(0);
}

// --- Tiny HTML extractors ---------------------------------------------------
// Regex-based; we don't need a full DOM parser to pull a handful of fields
// from pages we generated ourselves.

function readPage(file) {
  return fs.readFileSync(file, 'utf8');
}

function pickTitle(html) {
  const m = html.match(/<title>([^<]*)<\/title>/i);
  return m ? m[1].replace(/\s*-\s*Plant Families Explorer\s*$/i, '').trim() : '';
}

function pickH1(html) {
  const m = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  return m ? stripTags(m[1]).trim() : '';
}

function pickClass(html, cls) {
  const re = new RegExp('<[^>]+class="' + cls + '"[^>]*>([\\s\\S]*?)<', 'i');
  const m = html.match(re);
  return m ? stripTags(m[1]).trim() : '';
}

function pickHeaderImage(html) {
  // First <img> inside .family-header-content or .family-header
  const block = html.match(/family-header-content[^>]*>([\s\S]*?)<\/div>/i)
             || html.match(/family-header[^>]*>([\s\S]*?)<\/section>/i);
  if (!block) return '';
  const m = block[1].match(/<img[^>]+src="([^"]+)"/i);
  return m ? m[1] : '';
}

function stripTags(s) {
  // Loop until stable so nested angle-brackets like "<scr<x>ipt>" can't survive.
  let prev, out = String(s);
  do { prev = out; out = out.replace(/<[^>]*>/g, ''); } while (out !== prev);
  return out;
}

function csvEscape(v) {
  const s = String(v ?? '');
  if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

// --- extract ----------------------------------------------------------------

function cmdExtract({ dryRun }) {
  const files = fs.readdirSync(FAMILIES_DIR)
    .filter(f => f.endsWith('.html'))
    .sort();

  const rows = [['slug', 'family', 'common_name', 'title', 'image_path', 'image_exists', 'page_path']];
  let imageMissing = 0;
  for (const f of files) {
    const abs = path.join(FAMILIES_DIR, f);
    const html = readPage(abs);
    const slug = f.replace(/\.html$/, '');
    const family = pickH1(html) || slug;
    const common = pickClass(html, 'family-common-name');
    const title  = pickTitle(html);
    const img    = pickHeaderImage(html);
    let imgExists = '';
    if (img) {
      const norm = img.replace(/^\.\.\//, '').replace(/\/{2,}/g, '/');
      const imgAbs = path.join(REPO_ROOT, norm);
      imgExists = fs.existsSync(imgAbs) ? 'yes' : 'no';
      if (imgExists === 'no') imageMissing++;
    } else {
      imgExists = 'missing';
    }
    rows.push([slug, family, common, title, img, imgExists, 'families/' + f]);
  }

  const csv = rows.map(r => r.map(csvEscape).join(',')).join('\n') + '\n';
  if (dryRun) {
    console.log(`extract: ${files.length} pages scanned (dry run, not writing)`);
  } else {
    fs.mkdirSync(path.dirname(CSV_PATH), { recursive: true });
    fs.writeFileSync(CSV_PATH, csv);
    console.log(`extract: wrote ${CSV_PATH} (${rows.length - 1} rows)`);
  }
  console.log(`  images missing on disk: ${imageMissing}`);
  return { count: files.length, imageMissing };
}

// --- fix-pages --------------------------------------------------------------

const FIX_FONTS_LINK =
  '<link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&amp;family=Space+Grotesk:wght@400;500;700&amp;display=swap" rel="stylesheet"/>';

const FIXES = [
  {
    name: 'broken-logo-img-double-slash',
    // 92 family pages have a header logo path with a double slash:
    //   ../img//here/field-id-thumb.png  (browsers may or may not resolve this)
    // Repair to a single slash; the file img/here/field-id-thumb.png exists.
    pattern: /\.\.\/img\/\/here\/field-id-thumb\.png/g,
    replacement: '../img/here/field-id-thumb.png',
  },
  {
    name: 'stray-link-close-tags',
    // Many family pages end <head> with `</link></link></head>` — these are
    // syntactic noise inserted by an earlier generator. Strip them.
    pattern: /(<\/link>\s*)+(<\/head>)/gi,
    replacement: '$2',
  },
  {
    name: 'duplicate-icon-link',
    // Many pages declare the favicon link twice in a row.
    pattern: /(<link href="[^"]+\/img\/logo\.svg" rel="icon" type="image\/svg\+xml"\/?>)\s*\1/g,
    replacement: '$1',
  },
  {
    name: 'unclosed-meta-then-icon-rel',
    // Specific Asteraceae-style pattern: triple icon links at the very top
    // of <head>. Collapse to one.
    pattern: /<head>\s*<link href="([^"]+\/img\/logo\.svg)" rel="icon" type="image\/svg\+xml"\/?>\s*<link href="\1" rel="icon" type="image\/svg\+xml"\s*>/g,
    replacement: '<head>\n<link href="$1" rel="icon" type="image/svg+xml"/>',
  },
];

function cmdFixPages({ dryRun }) {
  const files = fs.readdirSync(FAMILIES_DIR)
    .filter(f => f.endsWith('.html'))
    .sort();

  const counts = {};
  let pagesChanged = 0;
  let fontsAdded = 0;

  for (const f of files) {
    const abs = path.join(FAMILIES_DIR, f);
    let html = readPage(abs);
    let changed = false;

    for (const fix of FIXES) {
      const before = html;
      html = html.replace(fix.pattern, fix.replacement);
      if (html !== before) {
        counts[fix.name] = (counts[fix.name] || 0) + 1;
        changed = true;
      }
    }

    // Big-bang aesthetic: ensure the new font pair is loaded so the
    // token-driven body font (var(--font-mono)) actually renders.
    if (!html.includes('JetBrains+Mono') && !html.includes('JetBrains Mono')) {
      html = html.replace(
        /(<link href="\.\.\/css\/styles\.css" rel="stylesheet"\/?>)/,
        FIX_FONTS_LINK + '\n$1'
      );
      fontsAdded++;
      changed = true;
    }

    if (changed) {
      pagesChanged++;
      if (!dryRun) fs.writeFileSync(abs, html);
    }
  }

  console.log(`fix-pages: ${pagesChanged} of ${files.length} pages ${dryRun ? 'would be' : 'were'} updated`);
  for (const [k, n] of Object.entries(counts)) console.log(`  ${k}: ${n}`);
  console.log(`  font-link injected: ${fontsAdded}`);
  return { pagesChanged };
}

// --- delegated validate -----------------------------------------------------

function cmdValidate(extraArgs) {
  const r = spawnSync(process.execPath,
    [path.join(REPO_ROOT, 'tools', 'validate.mjs'), ...extraArgs],
    { stdio: 'inherit' });
  return r.status ?? 0;
}

// --- dispatch ---------------------------------------------------------------

const flags = { dryRun: process.argv.includes('--dry-run') };
const passthroughArgs = process.argv.slice(3);

let exitCode = 0;
switch (cmd) {
  case 'extract':
    cmdExtract(flags);
    break;
  case 'fix-pages':
    cmdFixPages(flags);
    break;
  case 'validate':
    exitCode = cmdValidate(passthroughArgs);
    break;
  case 'all':
    cmdExtract(flags);
    cmdFixPages(flags);
    exitCode = cmdValidate([]);
    break;
  default:
    console.error('Unknown subcommand: ' + cmd);
    process.exit(2);
}

process.exit(exitCode);
