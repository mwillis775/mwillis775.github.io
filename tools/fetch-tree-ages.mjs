#!/usr/bin/env node
// tools/fetch-tree-ages.mjs
// ---------------------------------------------------------------------------
// Backfill `time_mya` and `time_source_url` in data/phylogeny.json from the
// Open Tree of Life and (as a fallback) Wikipedia.
//
// This is a deliberate, opt-in tool — it makes outbound HTTP calls — and is
// NOT run on every build. Run it manually when you want to refresh ages:
//
//   node tools/fetch-tree-ages.mjs --dry-run        # preview
//   node tools/fetch-tree-ages.mjs                  # write changes
//   node tools/fetch-tree-ages.mjs --only=monocots  # single subtree
//
// The OToL synthetic tree exposes node ages via the v3 API:
//   https://api.opentreeoflife.org/v3/tree_of_life/node_info
// Wikipedia is queried via the REST summary endpoint and the result is
// scanned for "X million years ago" patterns. Both are best-effort; the
// script never overwrites a node that already has a published time_mya
// unless --force is given.
//
// Network access is required. In sandboxed environments without internet
// access, the script will fail on the first HTTP call and exit cleanly.
// ---------------------------------------------------------------------------

import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '..');
const DATA_PATH = path.join(REPO_ROOT, 'data', 'phylogeny.json');

const argv = new Set(process.argv.slice(2));
const DRY_RUN = argv.has('--dry-run');
const FORCE   = argv.has('--force');
const ONLY    = [...argv].find(a => a.startsWith('--only='))?.slice(7);

const OTOL_NODE_INFO   = 'https://api.opentreeoflife.org/v3/tree_of_life/node_info';
const OTOL_TNRS_MATCH  = 'https://api.opentreeoflife.org/v3/tnrs/match_names';
const WP_SUMMARY       = name => 'https://en.wikipedia.org/api/rest_v1/page/summary/' + encodeURIComponent(name);
const AGE_RE           = /(\d{1,3}(?:\.\d+)?)\s*(?:million|m)?\s*(?:years?\s*ago|ya|MYA)/i;

async function postJson(u, body) {
  const r = await fetch(u, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error('HTTP ' + r.status + ' from ' + u);
  return r.json();
}
async function getJson(u) {
  const r = await fetch(u, { headers: { 'Accept': 'application/json' } });
  if (!r.ok) throw new Error('HTTP ' + r.status + ' from ' + u);
  return r.json();
}

// Strip parenthetical common-name suffixes like "Asteraceae (Sunflower family)".
function cleanName(n) { return String(n || '').replace(/\s*\(.*?\)\s*$/, '').trim(); }

async function lookupOtol(name) {
  const tnrs = await postJson(OTOL_TNRS_MATCH, { names: [name], context_name: 'Land plants' });
  const m = tnrs?.results?.[0]?.matches?.[0];
  if (!m) return null;
  const ottId = m.taxon?.ott_id;
  if (!ottId) return null;
  // node_info accepts ott_id via { ott_id: ... }
  const ni = await postJson(OTOL_NODE_INFO, { ott_id: ottId });
  // OToL responses sometimes contain a "node_age" key (Ma) in the synthetic tree.
  const age = ni?.node_age ?? ni?.age ?? ni?.taxon?.age;
  return {
    age: typeof age === 'number' ? age : null,
    url: 'https://tree.opentreeoflife.org/opentree/argus/ottol@' + ottId,
  };
}

async function lookupWikipedia(name) {
  const summary = await getJson(WP_SUMMARY(name));
  const text = summary?.extract || '';
  const m = text.match(AGE_RE);
  if (!m) return null;
  const age = parseFloat(m[1]);
  if (!Number.isFinite(age) || age <= 0 || age > 4000) return null;
  return {
    age,
    url: summary.content_urls?.desktop?.page
      || ('https://en.wikipedia.org/wiki/' + encodeURIComponent(name)),
  };
}

function inSubtree(node, id) {
  if (node.id === id) return true;
  return (node.children || []).some(c => inSubtree(c, id));
}

async function backfill(node, parentChain = []) {
  if (ONLY && !inSubtree(rootData.root, ONLY)) return;
  if (ONLY && !parentChain.includes(ONLY) && node.id !== ONLY
      && !(node.children || []).some(c => inSubtree(c, ONLY))) {
    // Skip subtrees that don't contain the --only id.
    return;
  }

  if ((node.time_mya == null || FORCE) && node.name) {
    const cleaned = cleanName(node.name);
    let result = null;
    try { result = await lookupOtol(cleaned); }
    catch (e) { console.error('[OToL] ' + cleaned + ': ' + e.message); }
    if (!result || result.age == null) {
      try { result = await lookupWikipedia(cleaned); }
      catch (e) { console.error('[WP]   ' + cleaned + ': ' + e.message); }
    }
    if (result && result.age != null) {
      console.log(`+ ${cleaned}: ${result.age} MYA`);
      if (!DRY_RUN) {
        node.time_mya = Math.round(result.age * 10) / 10;
        node.time_kind = node.time_kind || 'crown';
        node.time_source = result.url.includes('opentreeoflife') ? 'OToL' : 'WP';
        node.time_source_url = result.url;
      }
    }
  }
  for (const c of node.children || []) {
    await backfill(c, parentChain.concat(node.id));
  }
}

const rootData = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));

(async () => {
  try {
    await backfill(rootData.root);
    if (!DRY_RUN) {
      fs.writeFileSync(DATA_PATH, JSON.stringify(rootData, null, 2) + '\n');
      console.log('wrote ' + DATA_PATH);
    } else {
      console.log('(dry run — no file written)');
    }
  } catch (e) {
    console.error('FAILED: ' + e.message);
    process.exit(1);
  }
})();
