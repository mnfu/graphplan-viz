/* ============================================================
   js/graph.js — D3 rendering for the Graphplan visualizer.
   Depends on: d3 (global), CFG (data.js).
   ============================================================ */

'use strict';

/* ── Colour palette ───────────────────────────────────────── */
const C = {
  prop:         '#3b6ea8',
  propStroke:   '#274b73',
  action:       '#8a5a2b',
  actionStroke: '#5e3d1d',
  noop:         '#5c6f82',
  noopStroke:   '#3f4f5c',
  goal:         '#b8892f',
  goalStroke:   '#7a5e1f',
  textLight:    '#cfd7e3',
  textDark:     '#0d1b2a',
  pre:          '#4a90d9',
  add:          '#3f8f6b',
  del:          '#a14b4b',
  mutex:        '#6f5a8a',
  colBgProp:   '#16263a',
  colBgAction: '#1a2430',
  colBordProp: '#2f4661',
  colBordAct:  '#3a3f4a',
  gridLine:     '#1b2a3a',
};

/* ── Module state ─────────────────────────────────────────── */
let _svg        = null;
let _zoom       = null;
let _selectedId = null;

/* ── Public API ───────────────────────────────────────────── */

/**
 * renderGraph(data)
 * Entry point called by main.js after processData().
 */
function renderGraph(data) {
  const wrap = document.getElementById('viz');
  wrap.innerHTML = '';
  _selectedId = null;

  const rect = wrap.getBoundingClientRect();
  const W = rect.width || data.svgW;
  const H = rect.height || data.svgH;

  /* ── SVG root ───────────────────────────────────────────── */
  _svg = d3.select('#viz')
      .append('svg')
      .attr('viewBox', `0 0 ${W} ${H}`)
      .attr('width', W)
      .attr('height', H)
      .style('max-width', 'none')
      .style('height', '100%');

  /* Defs: arrowhead markers */
  const defs = _svg.append('defs');
  _arrow(defs, 'arr-pre',   C.pre);
  _arrow(defs, 'arr-add',   C.add);
  _arrow(defs, 'arr-del',   C.del);

  /* Grid pattern for background texture */
  defs.append('pattern')
    .attr('id', 'grid')
    .attr('width', CFG.colW)
    .attr('height', CFG.rowH)
    .attr('patternUnits', 'userSpaceOnUse')
    .append('path')
    .attr('d', `M ${CFG.colW} 0 L 0 0 0 ${CFG.rowH}`)
    .attr('fill', 'none')
    .attr('stroke', C.gridLine)
    .attr('stroke-width', 0.5);

  /* Background rect (receives zoom, also deselects on click) */
  _svg.append('rect')
    .attr('width', W)
    .attr('height', H)
    .attr('fill', 'url(#grid)')
    .on('click', () => {
      if (_selectedId) { _selectedId = null; _resetHighlight(); }
    });

  /* ── Zoom / pan ─────────────────────────────────────────── */
  _zoom = d3.zoom()
    .scaleExtent([0.1, 5])
    .on('zoom', ev => g.attr('transform', ev.transform));
  _svg.call(_zoom)
      .on("dblclick.zoom", null);

  /* ── Main drawable group ─────────────────────────────────── */
  const g = _svg.append('g').attr('class', 'root');

  _drawColBgs(g.append('g').attr('class', 'layer-cols'), data);
  _drawEdges (g.append('g').attr('class', 'layer-edges'), data);
  _drawMutex (g.append('g').attr('class', 'layer-mutex'), data);
  _drawNodes (g.append('g').attr('class', 'layer-nodes'), data);

  /* ── Wire controls ──────────────────────────────────────── */
  _setupControls(data);
  document.getElementById('btn-reset').addEventListener('click', _resetView);
}

/* ── Column backgrounds & headers ─────────────────────────── */
function _drawColBgs(g, data) {
  for (let col = 0; col < data.numCols; col++) {
    const isProp = col % 2 === 0;
    const t      = Math.floor(col / 2);
    const x      = CFG.pad.l + col * CFG.colW;
    const y      = CFG.pad.t - 38;
    const h      = data.maxRows * CFG.rowH + 38;

    g.append('rect')
      .attr('x', x + 4)
      .attr('y', y)
      .attr('width',  CFG.colW - 8)
      .attr('height', h)
      .attr('rx', 8)
      .attr('fill',   isProp ? C.colBgProp   : C.colBgAction)
      .attr('stroke', isProp ? C.colBordProp : C.colBordAct)
      .attr('stroke-width', 1);

    /* Column header label */
    const label = isProp
      ? (t === 0 ? 'Initial props' : t === data.maxtime ? 'Goal props' : `Props  t=${t}`)
      : `Actions  t=${t}`;

    g.append('text')
      .attr('x', x + CFG.colW / 2)
      .attr('y', y + 16)
      .attr('text-anchor', 'middle')
      .attr('font-size', 9.5)
      .attr('font-family', "'IBM Plex Mono', monospace")
      .attr('fill', '#6b7e96')
      .attr('font-weight', '500')
      .attr('letter-spacing', '0.04em')
      .text(label);

    /* Time-step marker below header */
    if (isProp) {
      g.append('text')
        .attr('x', x + CFG.colW / 2)
        .attr('y', y + 28)
        .attr('text-anchor', 'middle')
        .attr('font-size', 8)
        .attr('font-family', "'IBM Plex Mono', monospace")
        .attr('fill', '#aab8c8')
        .text(`t = ${t}`);
    }
  }
}

/* ── Arrowhead marker helper ──────────────────────────────── */
function _arrow(defs, id, color) {
  defs.append('marker')
    .attr('id', id)
    .attr('viewBox', '0 -4 8 8')
    .attr('refX', 7)
    .attr('refY', 0)
    .attr('markerWidth',  5)
    .attr('markerHeight', 5)
    .attr('orient', 'auto')
    .append('path')
    .attr('d', 'M0,-4L8,0L0,4')
    .attr('fill', color);
}

/* ── Edges ────────────────────────────────────────────────── */
function _drawEdges(g, data) {
  const etypes = [
    /* Draw del first (under add/pre so arrowheads are cleaner) */
    { k: 'del', color: C.del, dash: '6,3', arrow: 'arr-del' },
    { k: 'add', color: C.add, dash: null,  arrow: 'arr-add' },
    { k: 'pre', color: C.pre, dash: null,  arrow: 'arr-pre' },
  ];

  etypes.forEach(({ k, color, dash, arrow }) => {
    g.selectAll(`.e-${k}`)
      .data((data.edges || []).filter(e => e.etype === k))
      .join('path')
      .attr('class',         `edge e-${k}`)
      .attr('d',             e => _bezier(data.nodeById[e.src], data.nodeById[e.tgt]))
      .attr('fill',          'none')
      .attr('stroke',        color)
      .attr('color',         color)
      .attr('stroke-width',  1.4)
      .attr('stroke-dasharray', dash)
      .attr('marker-end',    `url(#${arrow})`)
      .attr('opacity',       1);
  });
}

/* Cubic bezier: right-edge of src → left-edge of tgt */
function _bezier(src, tgt) {
  if (!src || !tgt) return '';
  const x1 = src.x + _hw(src);
  const y1 = src.y;
  const x2 = tgt.x - _hw(tgt);
  const y2 = tgt.y;
  const cx = (x1 + x2) / 2;
  return `M${x1},${y1} C${cx},${y1} ${cx},${y2} ${x2},${y2}`;
}

/* Half-width of a node (for edge connection points) */
function _hw(n) {
  return n.kind === 'prop' ? CFG.propR : CFG.actW / 2;
}

/* ── Mutex arcs ───────────────────────────────────────────── */
function _drawMutex(g, data) {
  const pairs = [
    ...(data.mutexActions || []).map(([a, b]) => ({ a, b, isAct: true  })),
    ...(data.mutexProps   || []).map(([a, b]) => ({ a, b, isAct: false })),
  ];

  g.selectAll('.mutex-arc')
    .data(pairs)
    .join('path')
    .attr('class', 'mutex-arc')
    .attr('d', ({ a, b, isAct }) => {
      const n1 = data.nodeById[a];
      const n2 = data.nodeById[b];
      return n1 && n2 ? _mutexPath(n1, n2, isAct) : '';
    })
    .attr('fill',              'none')
    .attr('stroke',            C.mutex)
    .attr('stroke-width',      1.5)
    .attr('stroke-dasharray',  '4,3')
    .attr('opacity',           1);
}

/* Quadratic bezier that bulges sideways out of the column */
function _mutexPath(n1, n2, isAct) {
  /*
   * For action columns: bulge to the RIGHT of the column.
   * For prop columns:   bulge to the LEFT of the column.
   */
  const bulge  = isAct ? CFG.mutexBulge : -CFG.mutexBulge;
  const edgeX  = isAct ? CFG.actW / 2 : -CFG.propR;
  const ax = n1.x + edgeX;
  const bx = n2.x + edgeX;
  const mx = ax + bulge;
  const my = (n1.y + n2.y) / 2;
  return `M${ax},${n1.y} Q${mx},${my} ${bx},${n2.y}`;
}

/* ── Nodes ────────────────────────────────────────────────── */
function _drawNodes(g, data) {
  const ng = g.selectAll('.node')
    .data(data.nodes)
    .join('g')
    .attr('class',     d => `node node-${d.kind}`)
    .attr('transform', d => `translate(${d.x},${d.y})`)
    .attr('cursor',    'pointer')
    .on('click',     (ev, d) => { ev.stopPropagation(); _onNodeClick(d, data); })
    .on('mouseover', (ev, d) => _showTip(ev, d))
    .on('mouseout',  ()      => _hideTip());

  /* ── Proposition circles ──────────────────────────────────── */
  const props = ng.filter(d => d.kind === 'prop');

  props.append('circle')
    .attr('r',            CFG.propR)
    .attr('fill',         d => d.isGoal ? C.goal        : C.prop)
    .attr('stroke',       d => d.isGoal ? C.goalStroke  : C.propStroke)
    .attr('stroke-width', d => d.isGoal ? 3 : 1.5);

  /* Label below the circle */
  props.append('text')
    .attr('text-anchor', 'middle')
    .attr('dy',          CFG.propR + 12)
    .attr('font-size',   8.5)
    .attr('font-family', "'IBM Plex Mono', monospace")
    .attr('fill',        C.textLight)
    .text(d => _short(d.label, 16));

  /* ── Action / noop rectangles ─────────────────────────────── */
  const acts = ng.filter(d => d.kind !== 'prop');

  acts.append('rect')
    .attr('x',            -CFG.actW / 2)
    .attr('y',            -CFG.actH / 2)
    .attr('width',         CFG.actW)
    .attr('height',        CFG.actH)
    .attr('rx',            5)
    .attr('fill',         d => d.kind === 'noop' ? C.noop        : C.action)
    .attr('stroke',       d => d.kind === 'noop' ? C.noopStroke  : C.actionStroke)
    .attr('stroke-width', d => d.kind === 'noop' ? 1 : 1.5)
    .attr('opacity',      1);

  acts.append('text')
    .attr('text-anchor', 'middle')
    .attr('dy',          '0.35em')
    .attr('font-size',   8.5)
    .attr('font-family', "'IBM Plex Mono', monospace")
    .attr('fill',        C.textLight)
    .text(d => _short(d.label, 22));
}

/* Truncate + replace underscores with spaces */
function _short(s, max) {
  const clean = s.replace(/_/g, ' ');
  return clean.length > max ? clean.slice(0, max - 1) + '…' : clean;
}

/* ── Click-to-highlight ───────────────────────────────────── */
function _onNodeClick(d, data) {
  if (_selectedId === d.id) {
    _selectedId = null;
    _resetHighlight();
    return;
  }
  _selectedId = d.id;

  const adj = data.adjacency[d.id] || new Set();

  const mxPartners = new Set();
  [...(data.mutexActions || []), ...(data.mutexProps || [])].forEach(([a, b]) => {
    if (a === d.id) mxPartners.add(b);
    if (b === d.id) mxPartners.add(a);
  });

  /* Nodes */
  d3.selectAll('.node').classed('dim', n =>
      !(n.id === d.id || adj.has(n.id) || mxPartners.has(n.id)));

  /* Edges */
  d3.selectAll('.edge').classed('dim', e =>
      !(e.src === d.id || e.tgt === d.id))
      .each(function (e) {
    const el = d3.select(this);

    const isActive = (e.src === d.id || e.tgt === d.id);

    const base = e.etype; // 'pre' | 'add' | 'del'

    el.attr(
        'marker-end',
        `url(#arr-${base}${isActive ? '' : '-dim'})`
    );
  });

  /* Mutex */
  d3.selectAll('.mutex-arc').classed('dim', p =>
      !(p.a === d.id || p.b === d.id));
}

function _resetHighlight() {
  _selectedId = null;

  d3.selectAll('.node').classed('dim', false);
  d3.selectAll('.edge')
      .classed('dim', false)
      .each(function (e) {
        d3.select(this)
            .attr('marker-end', `url(#arr-${e.etype})`);
      })
  d3.selectAll('.mutex-arc').classed('dim', false);
}

/* ── Tooltip ──────────────────────────────────────────────── */
function _showTip(ev, d) {
  const el = document.getElementById('tooltip');
  const kindMap = { prop: 'Proposition', action: 'Action', noop: 'No-op (frame)' };
  el.innerHTML =
    `<div class="tip-kind">${kindMap[d.kind] || d.kind}</div>` +
    `<div class="tip-name">${d.label.replace(/_/g, ' ')}</div>` +
    `<div class="tip-time">time step: ${d.time}</div>` +
    (d.isGoal ? '<div class="tip-goal">⭐ Goal proposition</div>' : '');
  el.style.display = 'block';
  _moveTip(ev);
}

function _moveTip(ev) {
  const el  = document.getElementById('tooltip');
  const pad = 14;
  let left = ev.clientX + pad;
  let top  = ev.clientY - 10;
  /* keep inside viewport */
  if (left + 270 > window.innerWidth)  left = ev.clientX - 270 - pad;
  if (top  + 100 > window.innerHeight) top  = ev.clientY - 100;
  el.style.left = left + 'px';
  el.style.top  = top  + 'px';
}

function _hideTip() {
  document.getElementById('tooltip').style.display = 'none';
}

// ── Persistent toggle state ──────────────────────────────
const persistentToggles = {
  noops: true,
  del:   true,
  mutex: true
};

// ── Setup controls with persistent tracking ──────────────
function _setupControls(data) {
  const chkNoops = document.getElementById('chk-noops');
  const chkDel   = document.getElementById('chk-del');
  const chkMutex = document.getElementById('chk-mutex');

  // Initialize checkboxes from persistent state
  chkNoops.checked = persistentToggles.noops;
  chkDel.checked   = persistentToggles.del;
  chkMutex.checked = persistentToggles.mutex;

  // Event listeners update persistent state AND UI
  chkNoops.addEventListener('change', function () {
    persistentToggles.noops = this.checked;
    _applyNoopToggle(data);
  });
  chkDel.addEventListener('change', function () {
    persistentToggles.del = this.checked;
    _applyDelToggle();
  });
  chkMutex.addEventListener('change', function () {
    persistentToggles.mutex = this.checked;
    _applyMutexToggle();
  });

  // Apply initial toggle state to freshly rendered graph
  _applyNoopToggle(data);
  _applyDelToggle();
  _applyMutexToggle();
}

// ── Toggle application helpers ──────────────────────────
function _applyNoopToggle(data) {
  const show = persistentToggles.noops;
  d3.selectAll('.node-noop').attr('display', show ? null : 'none');
  d3.selectAll('.mutex-arc').filter(p => {
    const a = data.nodeById[p.a];
    const b = data.nodeById[p.b];
    return (a && a.kind === 'noop') || (b && b.kind === 'noop');
  }).attr('display', show ? null : 'none');
  d3.selectAll('.edge').filter(e => {
    const s = data.nodeById[e.src];
    const t = data.nodeById[e.tgt];
    return (s && s.kind === 'noop') || (t && t.kind === 'noop');
  }).attr('display', show ? null : 'none');
}

function _applyDelToggle() {
  d3.selectAll('.e-del').attr('display', persistentToggles.del ? null : 'none');
}

function _applyMutexToggle() {
  d3.selectAll('.mutex-arc').attr('display', persistentToggles.mutex ? null : 'none');
}

function _resetView() {
  _selectedId = null;
  _resetHighlight();
  if (_svg && _zoom) {
    _svg.transition().duration(450)
      .call(_zoom.transform, d3.zoomIdentity);
  }
}
