/* phylogenetic-tree-v2.js
 * ----------------------------------------------------------------------------
 * Chronogram renderer for data/phylogeny.json.
 *
 * Key features:
 *   - True chronogram: x = timeScale(node.time_mya), y = post-order leaf walk.
 *   - d3.zoom for pan + scroll-wheel zoom on the full SVG.
 *   - Rank-based colour palette so kingdoms/divisions/classes/orders/families
 *     are visually distinct instead of all being the same green.
 *   - Solid lines for published divergence ages; dashed (lower-contrast) for
 *     inferred positions so calibrated vs. interpolated is immediately obvious.
 *   - Label-collision resolver: if two sibling labels at the same depth would
 *     overlap vertically, lower-priority labels are hidden to keep the tree
 *     readable at every zoom level.
 *   - Sticky geological time axis synced to the current zoom transform.
 *   - Default collapse below ORDER rank; click any internal node to expand.
 *
 * Depends on D3 v7 (loaded via <script> tag in the HTML page).
 * ------------------------------------------------------------------------- */

(function () {
  'use strict';

  // ---- Constants -----------------------------------------------------------

  const DATA_URL = 'data/phylogeny.json';

  const COLLAPSE_BELOW_RANK = 'order';
  const RANK_DEPTH = {
    kingdom: 0, division: 1, clade: 2, class: 3, subclass: 4,
    order: 5, suborder: 6, family: 7, subfamily: 8, genus: 9,
  };

  const LEAF_SPACING   = 28;
  const NODE_RADIUS    = 3.5;
  const INTERNAL_RADIUS = 5;
  const ROOT_RADIUS    = 7;
  const LABEL_PAD      = 8;
  const MAX_TIME       = 540;
  const MIN_TIME       = 0;

  // Rank → colour palette (HSL-based, works in dark + light themes).
  const RANK_COLORS = {
    kingdom:   '#f9a825',   // warm gold
    division:  '#ef6c00',   // deep amber
    class:     '#29b6f6',   // sky blue
    subclass:  '#26c6da',   // teal
    order:     '#66bb6a',   // mid green
    suborder:  '#81c784',   // soft green
    family:    '#1aff66',   // phosphor green (same as var(--phosphor-300))
  };
  const DEFAULT_COLOR = '#9e9e9e';   // unranked / fallback

  // Darker variants for solid link strokes (calibrated ages).
  const LINK_SOLID_COLORS = {
    kingdom:   '#c77d02',
    division:  '#c45400',
    class:     '#1e88e5',
    subclass:  '#00acc1',
    order:     '#43a047',
    suborder:  '#66bb6a',
    family:    '#0fcc4d',
  };

  // Lighter variants for dashed link strokes (inferred ages).
  const LINK_DASHED_COLORS = {
    kingdom:   '#f9c762',
    division:  '#e8955a',
    class:     '#6ec6f8',
    subclass:  '#63e0f0',
    order:     '#a5d6a7',
    suborder:  '#b9e4ba',
    family:    '#66ff99',
  };

  const GEO_PERIODS = [
    { name: 'Cambrian',      start: 538.8, end: 485.4, color: '#7fa87f' },
    { name: 'Ordovician',    start: 485.4, end: 443.8, color: '#009270' },
    { name: 'Silurian',      start: 443.8, end: 419.2, color: '#b3e1b6' },
    { name: 'Devonian',      start: 419.2, end: 358.9, color: '#cb8c37' },
    { name: 'Carboniferous', start: 358.9, end: 298.9, color: '#67a599' },
    { name: 'Permian',       start: 298.9, end: 251.9, color: '#f04028' },
    { name: 'Triassic',      start: 251.9, end: 201.4, color: '#812b92' },
    { name: 'Jurassic',      start: 201.4, end: 145.0, color: '#34b2c9' },
    { name: 'Cretaceous',    start: 145.0, end:  66.0, color: '#7fc64e' },
    { name: 'Paleogene',     start:  66.0, end:  23.0, color: '#fd9a52' },
    { name: 'Neogene',       start:  23.0, end:   2.6, color: '#ffe619' },
    { name: 'Quaternary',    start:   2.6, end:   0.0, color: '#f9f97f' },
  ];

  // ---- Bootstrap -----------------------------------------------------------

  document.addEventListener('DOMContentLoaded', function () {
    const container = document.getElementById('phylogenetic-tree-v2');
    if (!container) return;
    if (typeof d3 === 'undefined') {
      container.textContent = 'Error: D3.js failed to load.';
      return;
    }

    fetch(DATA_URL, { cache: 'no-store' })
      .then(r => {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then(payload => init(container, payload))
      .catch(err => {
        container.textContent = 'Failed to load phylogeny data: ' + err.message;
      });
  });

  // ---- Main initialization -------------------------------------------------

  function init(container, payload) {
    const root = d3.hierarchy(payload.root, d => d.children);

    annotateAges(root);

    // Default collapse policy: hide everything below ORDER rank.
    root.descendants().forEach(d => {
      if (rankDepth(d.data.rank) > RANK_DEPTH[COLLAPSE_BELOW_RANK] && d.children) {
        d._children = d.children;
        d.children = null;
      }
    });

    const state = buildSvg(container, root);
    state.update();
    setupSearch(state);
    setupExpansionControls(state);
  }

  // ---- Age annotation ------------------------------------------------------

  function annotateAges(root) {
    root.each(d => {
      d.raw_time = (typeof d.data.time_mya === 'number') ? d.data.time_mya : null;
      d.eff_time = d.raw_time;
      d.inferred = false;
    });

    root.leaves().forEach(d => {
      if (d.eff_time === null) {
        d.eff_time = MIN_TIME;
        d.inferred = false;
      }
    });

    let changed = true;
    let safety = 50;
    while (changed && safety-- > 0) {
      changed = false;
      root.descendants().forEach(d => {
        if (d.eff_time !== null) return;
        const parent = d.parent;
        const parentAge = parent ? parent.eff_time : MAX_TIME;
        const childAges = (d.children || d._children || [])
          .map(c => c.eff_time)
          .filter(v => v !== null);
        if (parentAge !== null && childAges.length) {
          d.eff_time = (parentAge + Math.min(...childAges)) / 2;
          d.inferred = true;
          changed = true;
        }
      });
    }

    root.descendants().forEach(d => {
      if (d.eff_time === null) {
        d.eff_time = Math.max(MIN_TIME, (d.parent ? d.parent.eff_time : MAX_TIME) - 5);
        d.inferred = true;
      }
    });

    root.eachBefore(d => {
      if (d.parent && d.eff_time > d.parent.eff_time) {
        d.eff_time = d.parent.eff_time - 0.5;
        d.inferred = true;
      }
    });
  }

  // ---- SVG scaffolding -----------------------------------------------------

  function buildSvg(container, root) {
    const margin = { top: 80, right: 260, bottom: 30, left: 24 };
    const width  = Math.max(container.clientWidth || 1100, 800);
    const height = Math.max(window.innerHeight * 0.78, 600);

    const svg = d3.select(container).append('svg')
      .attr('width', width)
      .attr('height', height)
      .attr('role', 'img')
      .attr('aria-label', 'Plant phylogenetic chronogram');

    const zoomLayer = svg.append('g').attr('class', 'pt-zoom');
    const geoLayer  = zoomLayer.append('g').attr('class', 'pt-geo');
    const linkLayer = zoomLayer.append('g').attr('class', 'pt-links');
    const nodeLayer = zoomLayer.append('g').attr('class', 'pt-nodes');
    const stickyAxis = svg.append('g').attr('class', 'pt-sticky-axis');

    const timeScale = d3.scaleLinear()
      .domain([MAX_TIME, MIN_TIME])
      .range([margin.left, width - margin.right]);

    const zoom = d3.zoom()
      .scaleExtent([0.3, 10])
      .on('zoom', (event) => {
        zoomLayer.attr('transform', event.transform);
        drawStickyAxis(event.transform);
      });
    svg.call(zoom);

    const state = {
      svg, zoomLayer, geoLayer, linkLayer, nodeLayer, stickyAxis,
      timeScale, zoom, margin, width, height, root,
    };

    state.update = () => render(state);
    state.resetView = () => svg.transition().duration(400).call(zoom.transform, d3.zoomIdentity);

    function drawStickyAxis(t) {
      stickyAxis.selectAll('*').remove();
      stickyAxis.append('rect')
        .attr('x', 0).attr('y', 0)
        .attr('width', width).attr('height', margin.top - 8)
        .attr('fill', 'rgba(5,5,5,0.92)');

      const tScale = t.rescaleX(timeScale);

      GEO_PERIODS.forEach(p => {
        const x1 = tScale(p.start);
        const x2 = tScale(p.end);
        if (x2 < 0 || x1 > width) return;
        const left  = Math.max(0, Math.min(x1, x2));
        const right = Math.min(width, Math.max(x1, x2));
        stickyAxis.append('rect')
          .attr('class', 'pt-geo-band')
          .attr('x', left).attr('y', 32)
          .attr('width', Math.max(0, right - left))
          .attr('height', 22)
          .attr('fill', p.color);
        if (right - left > 36) {
          stickyAxis.append('text')
            .attr('class', 'pt-geo-label')
            .attr('x', (left + right) / 2)
            .attr('y', 47)
            .attr('text-anchor', 'middle')
            .text(p.name);
        }
      });

      const axis = d3.axisBottom(tScale)
        .ticks(Math.max(6, Math.floor(width / 110)))
        .tickFormat(v => v === 0 ? 'today' : v + ' MYA');
      stickyAxis.append('g')
        .attr('class', 'pt-axis')
        .attr('transform', 'translate(0, 26)')
        .call(axis);
    }

    drawStickyAxis(d3.zoomIdentity);

    // Re-layout on resize.
    let resizeRaf = 0;
    window.addEventListener('resize', () => {
      cancelAnimationFrame(resizeRaf);
      resizeRaf = requestAnimationFrame(() => {
        state.width = Math.max(container.clientWidth || 1100, 800);
        svg.attr('width', state.width);
        state.timeScale.range([state.margin.left, state.width - state.margin.right]);
        state.update();
        drawStickyAxis(d3.zoomTransform(svg.node()));
      });
    });

    return state;
  }

  // ---- Render --------------------------------------------------------------

  function render(state) {
    const { root, timeScale, margin, linkLayer, nodeLayer, geoLayer } = state;

    // Compute y positions: post-order leaf walk.
    const visibleLeaves = [];
    (function walk(d) {
      const kids = d.children;
      if (!kids || kids.length === 0) {
        visibleLeaves.push(d);
        return;
      }
      kids.forEach(walk);
    })(root);

    visibleLeaves.forEach((leaf, i) => {
      leaf.y = margin.top + 16 + i * LEAF_SPACING;
    });

    (function walk(d) {
      if (d.children && d.children.length) {
        d.children.forEach(walk);
        const ys = d.children.map(c => c.y);
        d.y = (Math.min(...ys) + Math.max(...ys)) / 2;
      }
    })(root);

    root.each(d => { d.x = timeScale(d.eff_time); });

    const neededHeight = (visibleLeaves.length || 1) * LEAF_SPACING + margin.top + margin.bottom + 60;
    state.svg.attr('height', Math.max(neededHeight, state.height));

    // ---- Geo bands ---------------------------------------------------------
    drawGeoBands(state, neededHeight);

    // ---- Resolve label collisions ------------------------------------------
    resolveLabelCollisions(root);

    // ---- Links -------------------------------------------------------------
    const linkData = root.descendants()
      .filter(d => d.parent)
      .map(d => ({
        source: d.parent,
        target: d,
        inferred: d.inferred || d.parent.inferred,
        rank: d.parent.data.rank,
        id: nodeKey(d),
      }));

    const links = linkLayer.selectAll('path.pt-link')
      .data(linkData, d => d.id);

    links.exit().remove();

    links.enter()
      .append('path')
      .attr('class', 'pt-link')
      .merge(links)
      .attr('d', d => elbow(d.source, d.target))
      .attr('fill', 'none')
      .attr('stroke', d => {
        const rk = d.inferred ? 'inferred' : 'calibrated';
        return linkColor(d.rank, rk);
      })
      .attr('stroke-width', d => d.inferred ? 1.2 : 1.8)
      .attr('stroke-dasharray', d => d.inferred ? '4,3' : null)
      .attr('opacity', d => d.inferred ? 0.45 : 0.85);

    // ---- Nodes -------------------------------------------------------------
    const nodes = nodeLayer.selectAll('g.pt-node')
      .data(root.descendants(), d => nodeKey(d));

    nodes.exit().remove();

    const enter = nodes.enter().append('g')
      .attr('class', 'pt-node')
      .attr('tabindex', 0)
      .attr('role', 'treeitem')
      .attr('aria-label', d => describeNode(d))
      .on('click', (event, d) => onNodeClick(state, d))
      .on('keydown', (event, d) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onNodeClick(state, d);
        }
      })
      .on('mouseenter', (event, d) => showTooltip(event, d))
      .on('mouseleave', () => hideTooltip());

    enter.append('circle');
    enter.append('text');

    const merged = enter.merge(nodes);

    merged.attr('transform', d => `translate(${d.x},${d.y})`);

    merged.select('circle')
      .attr('r', d => {
        if (d === root) return ROOT_RADIUS;
        if (d.children || d._children) return internalRadius(d);
        return NODE_RADIUS;
      })
      .attr('fill', d => {
        if (d._children) return nodeColor(d, 'collapsed');
        if (d.children)  return nodeColor(d, 'expanded');
        return nodeColor(d, 'leaf');
      })
      .attr('stroke', d => d.data.url ? '#ffbf00' : nodeColor(d, 'stroke'))
      .attr('stroke-width', d => {
        if (d.data.url) return 1.8;
        if (d === root) return 2;
        return 1.2;
      })
      .attr('cursor', d => (d.children || d._children || d.data.url) ? 'pointer' : 'default');

    merged.select('text')
      .attr('class', 'pt-node-label')
      .attr('x', d => (d.children || d._children) ? -LABEL_PAD : LABEL_PAD)
      .attr('y', d => (d._dy || 0) + (d.children || d._children ? -5 : 12))
      .attr('text-anchor', d => (d.children || d._children) ? 'end' : 'start')
      .attr('font-family', 'var(--font-mono, ui-monospace), monospace')
      .attr('font-size', d => labelFontSize(d))
      .attr('paint-order', 'stroke')
      .attr('stroke', 'var(--bg-1, #0a0a0a)')
      .attr('stroke-width', 3)
      .attr('stroke-linecap', 'round')
      .attr('stroke-linejoin', 'round')
      .attr('fill', d => {
        if (d.data.url) return '#ffbf00';
        return nodeColor(d, 'label');
      })
      .attr('opacity', 1)
      .text(d => labelFor(d));
  }

  // ---- Geo bands -----------------------------------------------------------

  function drawGeoBands(state, height) {
    const { geoLayer, timeScale, margin } = state;
    geoLayer.selectAll('*').remove();
    GEO_PERIODS.forEach(p => {
      const x1 = timeScale(p.start);
      const x2 = timeScale(p.end);
      const left = Math.min(x1, x2);
      const w = Math.abs(x2 - x1);
      geoLayer.append('rect')
        .attr('x', left).attr('y', margin.top)
        .attr('width', w).attr('height', height - margin.top - margin.bottom)
        .attr('fill', p.color)
        .attr('opacity', 0.06);
    });
  }

  // ---- Label collision resolution ------------------------------------------
  // Detect internal nodes whose left-extending labels overlap horizontally.
  // Adjacent nodes (by y) that share any horizontal label space are grouped
  // and spread apart with _dy offsets so every label is readable.

  function resolveLabelCollisions(root) {
    root.descendants().forEach(d => { d._dy = 0; });

    const internals = root.descendants().filter(d =>
      d.parent && (d.children || d._children) && d.y != null
    );
    if (internals.length < 2) return;
    internals.sort((a, b) => a.y - b.y);

    // Build contiguous groups linked by horizontal label overlap.
    const groups = [];
    let group = [internals[0]];

    for (let i = 1; i < internals.length; i++) {
      const prev = internals[i - 1];
      const curr = internals[i];

      if (labelsOverlapH(prev, curr)) {
        group.push(curr);
      } else {
        if (group.length >= 2) groups.push(group);
        group = [curr];
      }
    }
    if (group.length >= 2) groups.push(group);

    // Spread labels: ensure at least font-size + 6 px between each.
    groups.forEach(g => {
      const pad = 6;
      const needed = g.reduce((s, d) => s + labelFontSize(d) + pad, 0) - pad;
      const available = g[g.length - 1].y - g[0].y;
      const bandH = Math.max(needed, available);

      let pos = g[0].y + (bandH - needed) / 2;
      g.forEach(d => {
        const fs = labelFontSize(d);
        d._dy = Math.round(pos + fs / 2 - d.y);
        pos += fs + pad;
      });
    });
  }

  function labelsOverlapH(a, b) {
    const aW = (labelText(a).length || 4) * 7;
    const bW = (labelText(b).length || 4) * 7;
    const aL = a.x - aW - LABEL_PAD;
    const aR = a.x - LABEL_PAD;
    const bL = b.x - bW - LABEL_PAD;
    const bR = b.x - LABEL_PAD;
    return aL < bR && bL < aR;
  }

  function labelText(d) {
    const name = d.data.name || '';
    const parts = name.split(': ');
    return parts.length > 1 ? parts.slice(1).join(': ') : name;
  }

  // ---- Colours -------------------------------------------------------------

  function nodeColor(d, kind) {
    const rank = (d.data.rank || '').toLowerCase();

    if (kind === 'leaf') {
      return RANK_COLORS[rank] || DEFAULT_COLOR;
    }
    if (kind === 'expanded') {
      // Darker variant — mix with black conceptually by lowering luminance.
      return darken(RANK_COLORS[rank] || DEFAULT_COLOR, 0.6);
    }
    if (kind === 'collapsed') {
      // Bright — indicates expandability.
      return RANK_COLORS[rank] || DEFAULT_COLOR;
    }
    if (kind === 'stroke') {
      return darken(RANK_COLORS[rank] || DEFAULT_COLOR, 0.5);
    }
    if (kind === 'label') {
      return d.data.rank ? RANK_COLORS[rank] || DEFAULT_COLOR : DEFAULT_COLOR;
    }
    return DEFAULT_COLOR;
  }

  function linkColor(rank, kind) {
    if (!rank) return kind === 'inferred' ? '#555' : '#888';
    const rk = rank.toLowerCase();
    if (kind === 'inferred') {
      return LINK_DASHED_COLORS[rk] || '#777';
    }
    return LINK_SOLID_COLORS[rk] || '#aaa';
  }

  function darken(hex, factor) {
    let r, g, b;
    if (hex.startsWith('#')) {
      const h = hex.slice(1);
      if (h.length === 6) {
        r = parseInt(h.slice(0, 2), 16);
        g = parseInt(h.slice(2, 4), 16);
        b = parseInt(h.slice(4, 6), 16);
      } else if (h.length === 3) {
        r = parseInt(h[0] + h[0], 16);
        g = parseInt(h[1] + h[1], 16);
        b = parseInt(h[2] + h[2], 16);
      }
    }
    if (r === undefined) return hex;
    return '#' + [
      Math.round(r * factor).toString(16).padStart(2, '0'),
      Math.round(g * factor).toString(16).padStart(2, '0'),
      Math.round(b * factor).toString(16).padStart(2, '0'),
    ].join('');
  }

  function internalRadius(d) {
    const r = rankDepth(d.data.rank);
    if (r <= 1) return 6.5;  // kingdom / division
    if (r <= 3) return 5.5;  // class
    if (r <= 5) return 4.5;  // order
    return INTERNAL_RADIUS;
  }

  function labelFontSize(d) {
    const r = rankDepth(d.data.rank);
    if (r <= 1) return 13;  // kingdom, division
    if (r <= 3) return 12;  // class, subclass
    if (r <= 5) return 11;  // order, suborder
    return 10;              // family
  }

  // ---- Interaction ---------------------------------------------------------

  function onNodeClick(state, d) {
    const isInternal = d.children || d._children;
    if (isInternal) {
      if (d.children) {
        d._children = d.children;
        d.children = null;
      } else {
        d.children = d._children;
        d._children = null;
      }
      state.update();
      return;
    }
    if (d.data.url) {
      window.open(d.data.url, '_blank', 'noopener');
    }
  }

  function setupExpansionControls(state) {
    document.getElementById('pt-expand-all')?.addEventListener('click', () => {
      state.root.each(d => {
        if (d._children) { d.children = d._children; d._children = null; }
      });
      state.update();
    });
    document.getElementById('pt-collapse-all')?.addEventListener('click', () => {
      state.root.each(d => {
        if (rankDepth(d.data.rank) > RANK_DEPTH[COLLAPSE_BELOW_RANK] && d.children) {
          d._children = d.children;
          d.children = null;
        }
      });
      state.update();
    });
    document.getElementById('pt-reset-view')?.addEventListener('click', () => state.resetView());
  }

  function setupSearch(state) {
    const input = document.getElementById('pt-search');
    if (!input) return;
    input.addEventListener('input', () => {
      const q = input.value.trim().toLowerCase();
      if (q.length < 2) {
        state.nodeLayer.selectAll('text').attr('font-weight', null).classed('t-glow', false);
        return;
      }
      let firstHit = null;
      state.root.each(d => {
        const name = (d.data.name || '').toLowerCase();
        if (name.includes(q)) {
          if (!firstHit) firstHit = d;
          let p = d.parent;
          while (p) {
            if (p._children) { p.children = p._children; p._children = null; }
            p = p.parent;
          }
        }
      });
      state.update();
      state.nodeLayer.selectAll('g.pt-node').each(function (d) {
        const name = (d.data.name || '').toLowerCase();
        const hit = name.includes(q);
        d3.select(this).select('text')
          .attr('font-weight', hit ? 'bold' : null)
          .classed('t-glow', hit);
      });
      if (firstHit) {
        const t = d3.zoomTransform(state.svg.node());
        const targetX = state.width / 2 - firstHit.x * t.k;
        const targetY = state.height / 2 - firstHit.y * t.k;
        state.svg.transition().duration(500).call(
          state.zoom.transform,
          d3.zoomIdentity.translate(targetX, targetY).scale(t.k)
        );
      }
    });
  }

  // ---- Tooltip -------------------------------------------------------------

  let tooltipEl = null;
  function showTooltip(event, d) {
    hideTooltip();
    const lines = [];
    lines.push('<strong>' + escapeHtml(d.data.name) + '</strong>');
    if (d.data.rank) lines.push('<span class="t-rank">' + escapeHtml(d.data.rank) + '</span>');
    if (typeof d.raw_time === 'number') {
      const srcKey = d.data.time_source ? escapeHtml(d.data.time_source) : '';
      const srcUrl = d.data.time_source_url
        ? ' (' + escapeHtml(d.data.time_source_url.replace(/^https?:\/\//, '')) + ')'
        : '';
      const srcLabel = srcKey ? ' · <em>' + srcKey + srcUrl + '</em>' : '';
      lines.push('~' + d.raw_time + ' MYA' +
        (d.data.time_kind ? ' · ' + escapeHtml(d.data.time_kind) : '') +
        srcLabel);
    } else if (d.inferred) {
      lines.push('~' + d.eff_time.toFixed(1) + ' MYA · <em>inferred</em>');
    }
    if (d.data.note) lines.push('<small>' + escapeHtml(d.data.note) + '</small>');
    tooltipEl = document.createElement('div');
    tooltipEl.className = 'pt-tooltip';
    tooltipEl.innerHTML = lines.join('<br>');
    document.body.appendChild(tooltipEl);
    moveTooltip(event);
    document.addEventListener('mousemove', moveTooltip);
  }
  function moveTooltip(event) {
    if (!tooltipEl) return;
    tooltipEl.style.left = (event.clientX + 14) + 'px';
    tooltipEl.style.top  = (event.clientY + 14) + 'px';
  }
  function hideTooltip() {
    document.removeEventListener('mousemove', moveTooltip);
    if (tooltipEl && tooltipEl.parentNode) tooltipEl.parentNode.removeChild(tooltipEl);
    tooltipEl = null;
  }

  // ---- Helpers -------------------------------------------------------------

  function rankDepth(rank) {
    if (!rank) return 99;
    return RANK_DEPTH[rank.toLowerCase()] ?? 99;
  }

  function nodeKey(d) {
    return d.data.id || (d.data.name + '|' + d.depth);
  }

  function elbow(s, t) {
    return `M${s.x},${s.y}V${t.y}H${t.x}`;
  }

  function labelFor(d) {
    const shortName = labelText(d);
    const max = (d.children || d._children) ? 32 : 40;
    if (shortName.length <= max) return shortName;
    return shortName.slice(0, max - 1) + '\u2026';
  }

  function describeNode(d) {
    const parts = [d.data.name || ''];
    if (d.data.rank) parts.push('(' + d.data.rank + ')');
    if (typeof d.raw_time === 'number') parts.push(d.raw_time + ' MYA');
    if (d._children) parts.push('collapsed');
    return parts.join(' ');
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }
})();
