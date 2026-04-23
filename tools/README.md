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

## Future tools (not yet implemented)

- `gen-family-pages.mjs` — emit `families/*.html` from a master
  `data/families.csv` so all 731 pages share one template (Workstream 2.2).
- `audit-images.mjs` — per-family image inventory (path, size, format,
  classify as photo/sketch/placeholder) feeding Workstream 3.
