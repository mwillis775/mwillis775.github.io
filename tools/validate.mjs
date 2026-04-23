#!/usr/bin/env node
// tools/validate.mjs
// ---------------------------------------------------------------------------
// Site validator for mwillis775.github.io.
//
// Crawls every *.html file in the repository and reports:
//   - Internal href / src targets that don't resolve on disk
//   - Anchors and images using paths that look broken (double slashes,
//     trailing whitespace, backslashes, references to non-image files)
//   - Family pages that are missing the structural sections we expect
//     (header image, description, etc.)
//   - Tree-data leaves whose target family page does not exist, and family
//     pages that are not referenced anywhere from the tree data
//
// The validator only READS files. It does not modify anything. It exits 0
// even when problems are found; CI can flip that with `--strict` if desired.
//
// Usage:
//   node tools/validate.mjs                 # human-readable report to stdout
//   node tools/validate.mjs --json          # machine-readable JSON report
//   node tools/validate.mjs --strict        # exit 1 if any problems found
//
// No third-party dependencies; uses a small purpose-built HTML scanner so
// the project stays install-free.
// ---------------------------------------------------------------------------

import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '..');
const args = new Set(process.argv.slice(2));
const EMIT_JSON = args.has('--json');
const STRICT = args.has('--strict');

// --- Tiny filesystem helpers ------------------------------------------------

/** Recursively walk a directory, returning absolute file paths matching `predicate`. */
function walk(dir, predicate) {
  const out = [];
  const stack = [dir];
  while (stack.length) {
    const current = stack.pop();
    let entries;
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      // Skip VCS / dependency / build dirs.
      if (entry.name === '.git' || entry.name === 'node_modules') continue;
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(full);
      } else if (entry.isFile() && predicate(full)) {
        out.push(full);
      }
    }
  }
  return out;
}

/** Return true if a path resolves to a file or directory. */
function existsCaseSensitive(absPath) {
  // First a cheap existsSync — that's enough on Linux/macOS where this
  // site is built. We additionally verify the basename casing because
  // GitHub Pages serves case-sensitive URLs.
  if (!fs.existsSync(absPath)) return false;
  const dir = path.dirname(absPath);
  const base = path.basename(absPath);
  try {
    const siblings = fs.readdirSync(dir);
    return siblings.includes(base);
  } catch {
    return false;
  }
}

// --- HTML attribute scanner -------------------------------------------------
// We deliberately avoid jsdom/cheerio so this script has zero install cost.
// A regex-based scan is good enough for finding href/src values; we don't
// need to faithfully parse markup.

const ATTR_RE = /\b(href|src)\s*=\s*("([^"]*)"|'([^']*)')/gi;

function extractRefs(html) {
  const refs = [];
  let m;
  ATTR_RE.lastIndex = 0;
  while ((m = ATTR_RE.exec(html)) !== null) {
    const attr = m[1].toLowerCase();
    const value = m[3] !== undefined ? m[3] : m[4];
    refs.push({ attr, value, index: m.index });
  }
  return refs;
}

const STRUCTURE_PROBES = {
  // Each family page should at minimum contain a header section, an image,
  // and either an inline description or a link to a description page.
  hasFamilyHeader: html => /class="family-header"/i.test(html),
  hasFamilyImage: html => /<img[^>]+src=/i.test(html),
  hasReferences: html => /references|sources|citations/i.test(html),
};

// --- Reference resolution ---------------------------------------------------

/**
 * Given an href/src value found inside `pageAbs`, decide whether and where
 * it should resolve on disk. Returns:
 *   { kind: 'skip' }                          — external, mailto, anchor, etc.
 *   { kind: 'resolve', abs, original }        — should exist at `abs`
 */
function resolveRef(pageAbs, value) {
  if (!value) return { kind: 'skip' };
  const trimmed = value.trim();
  if (!trimmed) return { kind: 'skip' };

  // Strip URL fragments and query strings — we only care about the path.
  const pathPart = trimmed.split('#')[0].split('?')[0];
  if (!pathPart) return { kind: 'skip' };

  if (/^[a-z][a-z0-9+.-]*:/i.test(pathPart)) return { kind: 'skip' }; // http:, mailto:, data:, etc.
  if (pathPart.startsWith('//')) return { kind: 'skip' };             // protocol-relative

  let rel;
  if (pathPart.startsWith('/')) {
    rel = pathPart.slice(1); // root-relative — relative to repo root for GH Pages user site
  } else {
    rel = path.join(path.relative(REPO_ROOT, path.dirname(pageAbs)), pathPart);
  }
  // Normalize and collapse any "//" that would have produced an empty segment.
  const normalised = path.normalize(rel).replace(/\\/g, '/');
  const abs = path.join(REPO_ROOT, normalised);
  return { kind: 'resolve', abs, original: trimmed, normalised };
}

// --- Main scan --------------------------------------------------------------

function scanRepo() {
  // Skip HTML files that live under img/ — those are accidentally-saved
  // page snapshots, not part of the deployed site.
  const htmlFiles = walk(REPO_ROOT, p => {
    if (!p.endsWith('.html')) return false;
    const rel = path.relative(REPO_ROOT, p).replace(/\\/g, '/');
    if (rel.startsWith('img/')) return false;
    return true;
  });

  const problems = [];
  const familyPagesOnDisk = new Set(
    fs.readdirSync(path.join(REPO_ROOT, 'families'))
      .filter(f => f.endsWith('.html'))
      .map(f => f.toLowerCase())
  );
  const familyPagesReferenced = new Set();

  for (const file of htmlFiles) {
    const rel = path.relative(REPO_ROOT, file);
    const html = fs.readFileSync(file, 'utf8');
    const refs = extractRefs(html);

    for (const ref of refs) {
      // Skip JS template-literal placeholders — these are filled in at
      // runtime and not real static references.
      if (ref.value.includes('${')) continue;
      // Skip data: URIs (inline SVGs, base64) entirely.
      if (/^data:/i.test(ref.value.trim())) continue;
      // Suspicious-looking values we want to surface even before resolving.
      if (ref.value.includes('//') && !/^[a-z]+:\/\//i.test(ref.value)) {
        problems.push({
          severity: 'warn',
          kind: 'suspicious-path',
          file: rel,
          value: ref.value,
          message: 'Contains "//" outside of a URL scheme (likely a path bug, e.g. "img//here/...")',
        });
      }
      if (/[\\]/.test(ref.value)) {
        problems.push({
          severity: 'warn',
          kind: 'backslash-in-path',
          file: rel,
          value: ref.value,
          message: 'Contains a backslash; URLs should use forward slashes only',
        });
      }
      if (/\s$/.test(ref.value) || /^\s/.test(ref.value)) {
        problems.push({
          severity: 'warn',
          kind: 'whitespace-in-path',
          file: rel,
          value: JSON.stringify(ref.value),
          message: 'Has leading or trailing whitespace',
        });
      }

      const resolved = resolveRef(file, ref.value);
      if (resolved.kind !== 'resolve') continue;

      // Track which family pages are referenced from anywhere on the site.
      const m = resolved.normalised.match(/^families\/([a-z0-9_-]+\.html)$/i);
      if (m) familyPagesReferenced.add(m[1].toLowerCase());

      if (!existsCaseSensitive(resolved.abs)) {
        problems.push({
          severity: 'error',
          kind: 'missing-target',
          file: rel,
          attr: ref.attr,
          value: ref.value,
          expected: path.relative(REPO_ROOT, resolved.abs),
          message: 'Linked file does not exist on disk',
        });
        continue;
      }

      // src= referencing a non-image file (we noticed .docx/.pdf/.html in img/here)
      if (ref.attr === 'src' && /^img\//i.test(resolved.normalised)) {
        const ext = path.extname(resolved.abs).toLowerCase();
        const imageExts = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.avif'];
        if (ext && !imageExts.includes(ext)) {
          problems.push({
            severity: 'warn',
            kind: 'non-image-src',
            file: rel,
            value: ref.value,
            message: `<img src> points to a non-image file (${ext})`,
          });
        }
      }
    }

    // Family-page structural checks
    if (rel.startsWith('families/') && rel.endsWith('.html')) {
      for (const [probeName, probeFn] of Object.entries(STRUCTURE_PROBES)) {
        if (!probeFn(html)) {
          problems.push({
            severity: probeName === 'hasReferences' ? 'info' : 'warn',
            kind: `family-page-${probeName.replace(/^has/, 'missing-').toLowerCase()}`,
            file: rel,
            message: `Family page is missing expected element: ${probeName}`,
          });
        }
      }
    }
  }

  // Cross-check tree data against on-disk family pages, if the new data
  // file exists. (The legacy js/phylogenetic-tree.js encodes data inline,
  // so we can't easily introspect it without executing it.)
  const phylogenyJson = path.join(REPO_ROOT, 'data', 'phylogeny.json');
  if (fs.existsSync(phylogenyJson)) {
    try {
      const data = JSON.parse(fs.readFileSync(phylogenyJson, 'utf8'));
      const treeLeaves = collectTreeLeaves(data);
      for (const leaf of treeLeaves) {
        if (leaf.url) {
          const abs = path.join(REPO_ROOT, leaf.url);
          if (!existsCaseSensitive(abs)) {
            problems.push({
              severity: 'error',
              kind: 'tree-leaf-missing-page',
              file: 'data/phylogeny.json',
              value: leaf.url,
              message: `Tree leaf "${leaf.name}" points at a family page that does not exist`,
            });
          }
        }
        // Also check time monotonicity if both leaf and parent have ages.
      }
      // Tree-time monotonicity: child's age must be <= parent's age.
      checkTimeMonotonicity(data, problems);
    } catch (e) {
      problems.push({
        severity: 'error',
        kind: 'phylogeny-json-parse',
        file: 'data/phylogeny.json',
        message: `Failed to parse: ${e.message}`,
      });
    }
  }

  // Family pages that exist on disk but aren't referenced from anywhere.
  for (const fname of familyPagesOnDisk) {
    if (!familyPagesReferenced.has(fname)) {
      problems.push({
        severity: 'info',
        kind: 'orphan-family-page',
        file: `families/${fname}`,
        message: 'Family page is not linked from any other page on the site',
      });
    }
  }

  return { problems, stats: {
    htmlFiles: htmlFiles.length,
    familyPagesOnDisk: familyPagesOnDisk.size,
    familyPagesReferenced: familyPagesReferenced.size,
  }};
}

function collectTreeLeaves(node, out = []) {
  if (!node) return out;
  const children = node.children || [];
  if (children.length === 0) {
    out.push(node);
  } else {
    for (const c of children) collectTreeLeaves(c, out);
  }
  return out;
}

function checkTimeMonotonicity(node, problems, parent = null) {
  if (!node) return;
  if (parent && Number.isFinite(parent.time_mya) && Number.isFinite(node.time_mya)) {
    if (node.time_mya > parent.time_mya + 1e-6) {
      problems.push({
        severity: 'error',
        kind: 'tree-time-inversion',
        file: 'data/phylogeny.json',
        message: `Node "${node.name}" (${node.time_mya} MYA) is older than its parent "${parent.name}" (${parent.time_mya} MYA)`,
      });
    }
  }
  for (const c of node.children || []) checkTimeMonotonicity(c, problems, node);
}

// --- Output -----------------------------------------------------------------

function severitySymbol(s) {
  return s === 'error' ? 'E' : s === 'warn' ? 'W' : 'i';
}

function printHumanReport({ problems, stats }) {
  const counts = { error: 0, warn: 0, info: 0 };
  for (const p of problems) counts[p.severity] = (counts[p.severity] || 0) + 1;

  const grouped = new Map();
  for (const p of problems) {
    const k = p.kind;
    if (!grouped.has(k)) grouped.set(k, []);
    grouped.get(k).push(p);
  }

  console.log('Plant Families Explorer — site validator');
  console.log('=========================================');
  console.log(`HTML files scanned:        ${stats.htmlFiles}`);
  console.log(`Family pages on disk:      ${stats.familyPagesOnDisk}`);
  console.log(`Family pages referenced:   ${stats.familyPagesReferenced}`);
  console.log(`Problems: ${counts.error || 0} error(s), ${counts.warn || 0} warning(s), ${counts.info || 0} info`);
  console.log('');
  if (problems.length === 0) {
    console.log('No problems found.');
    return;
  }
  // Sort categories by severity then count desc.
  const order = ['error', 'warn', 'info'];
  const kinds = [...grouped.keys()].sort((a, b) => {
    const sa = grouped.get(a)[0].severity;
    const sb = grouped.get(b)[0].severity;
    if (sa !== sb) return order.indexOf(sa) - order.indexOf(sb);
    return grouped.get(b).length - grouped.get(a).length;
  });
  for (const kind of kinds) {
    const list = grouped.get(kind);
    const sev = list[0].severity;
    console.log(`[${severitySymbol(sev)}] ${kind} (${list.length})`);
    // Cap each category to 25 examples to keep output readable.
    const shown = list.slice(0, 25);
    for (const p of shown) {
      const where = p.file ? `  ${p.file}` : '';
      const value = p.value ? ` — ${p.value}` : '';
      console.log(`   ${p.message}${where ? '\n  ' + where : ''}${value}`);
    }
    if (list.length > shown.length) {
      console.log(`   … and ${list.length - shown.length} more`);
    }
    console.log('');
  }
}

const result = scanRepo();
if (EMIT_JSON) {
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
} else {
  printHumanReport(result);
}

const hasErrors = result.problems.some(p => p.severity === 'error');
process.exit(STRICT && hasErrors ? 1 : 0);
