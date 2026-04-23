# tools/

Maintenance scripts for the Plant Families Explorer. Pure Node.js (≥18),
no third-party dependencies.

## `validate.mjs` — site validator

Crawls every `*.html` file in the repo and reports:

- Internal `href` and `src` paths that don't resolve on disk
- Suspicious paths (double slashes outside a URL scheme, backslashes,
  leading/trailing whitespace)
- `<img src="…">` pointing at a non-image file
- Family pages missing expected structural elements
  (`.family-header`, an image, a references section)
- Tree-data leaves whose target family page does not exist
  (only when `data/phylogeny.json` is present)
- Time-inversions in `data/phylogeny.json`
  (a child node older than its parent)
- Family pages on disk that aren't linked from anywhere (orphans)

### Usage

```bash
# Human-readable report to stdout
node tools/validate.mjs

# Machine-readable JSON
node tools/validate.mjs --json > validation.json

# Exit non-zero if any errors are found (suitable for CI)
node tools/validate.mjs --strict
```

The validator only reads files; it never modifies anything.

### Current baseline

When this script was first run against the repo it surfaced ~3 200 missing
image references (mostly under `img/guides/` from the identification pages),
~90 suspicious paths (double-slash bug `img//here/...` in family pages),
and 229 family pages that exist on disk but are not linked from anywhere
on the site. These are the targets of Workstreams 2 and 3 in the project
plan; the validator gives an objective measure of progress.

After running `tools/build.mjs fix-pages` the suspicious-path count drops
to zero (92 family pages repaired, 683 stray `</link>` tag pairs removed,
font links injected on all 731 pages so the new design tokens render).

## `build.mjs` — site build & maintenance

Single entry-point for the Node build step. No third-party dependencies.

```bash
node tools/build.mjs validate     # delegates to validate.mjs
node tools/build.mjs extract      # families/*.html → data/families.csv
node tools/build.mjs fix-pages    # mechanically repair common bugs
node tools/build.mjs all          # extract + fix-pages + validate
node tools/build.mjs <cmd> --dry-run    # preview without writing
```

`fix-pages` only touches lines matching well-defined bug patterns:

- `../img//here/field-id-thumb.png` → `../img/here/field-id-thumb.png`
  (the file exists; only the double-slash variant is broken)
- Stray `</link>` tags right before `</head>`
- Duplicate `<link rel="icon">` declarations
- Missing JetBrains Mono / Space Grotesk font link (so the new design
  tokens declared in `css/styles.css` actually render)

It never rewrites the `<body>` content of any page.

`extract` produces `data/families.csv` with one row per family page:
`slug, family, common_name, title, image_path, image_exists, page_path`.
This CSV is the master index for future taxonomic and image audits
(Workstreams 2.2 and 3.1).

## `fetch-tree-ages.mjs` — divergence-age backfill

Refreshes `time_mya` and `time_source_url` in `data/phylogeny.json` from
the **Open Tree of Life** synthetic tree, falling back to **Wikipedia**
article summaries for ages OToL doesn't expose. Per-node citations are
recorded so claims remain auditable.

```bash
node tools/fetch-tree-ages.mjs --dry-run        # preview
node tools/fetch-tree-ages.mjs                  # write changes
node tools/fetch-tree-ages.mjs --only=monocots  # single subtree
node tools/fetch-tree-ages.mjs --force          # overwrite existing ages
```

Requires outbound HTTP access; never run on every build.

## Future tools (not yet implemented)

- `gen-family-pages.mjs` — emit `families/*.html` from a master
  `data/families.csv` so all 731 pages share one template (Workstream 2.2).
- `audit-images.mjs` — per-family image inventory (path, size, format,
  classify as photo/sketch/placeholder) feeding Workstream 3.
