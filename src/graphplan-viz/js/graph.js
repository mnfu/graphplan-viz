/* ============================================================
   js/graph.js — D3 rendering for the Graphplan visualizer.
   Depends on: d3 (global), CFG (data.js).
   ============================================================ */

'use strict';

/* ── Colour palette ───────────────────────────────────────── */
const C = {
  prop:         '#2c7be5',
  propStroke:   '#1a5cb4',
  action:       '#e67e22',
  actionStroke: '#b45e00',
  noop:         '#95a5a6',
  noopStroke:   '#6c7a7d',
  goal:         '#f39c12',
  goalStroke:   '#d35400',
  textLight:    '#ffffff',
  textDark:     '#1a1a2e',
  pre:          '#3498db',
  add:          '#27ae60',
  del:          '#e74c3c',
  mutex:        '#9b59b6',
  colBgProp:    '#eef4ff',
  colBgAction:  '#fff8ee',
  colBordProp:  '#c5d8f8',
  colBordAct:   '#f5d8aa',
  gridLine:     '#e8ecf2',
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

  /* ── SVG root ───────────────────────────────────────────── */
  _svg = d3.select('#viz')
    .append('svg')
    .attr('viewBox', `0 0 ${data.svgW} ${data.svgH}`)
    .attr('width',   data.svgW)
    .attr('height',  data.svgH)
    .style('max-width', '100%');

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
    .attr('width', data.svgW)
    .attr('height', data.svgH)
    .attr('fill', 'url(#grid)')
    .on('click', () => {
      if (_selectedId) { _selectedId = null; _resetHighlight(); }
    });

  /* ── Zoom / pan ─────────────────────────────────────────── */
  _zoom = d3.zoom()
    .scaleExtent([0.1, 5])
    .on('zoom', ev => g.attr('transform', ev.transform));
  _svg.call(_zoom);

  /* ── Main drawable group ─────────────────────────────────── */
  const g = _svg.append('g').attr('class', 'root');

  /* Layer order: column backgrounds → edges → mutex → nodes */
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
    const h      = data.maxRows * CFG.rowH + 22;

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
      .attr('stroke-width',  1.4)
      .attr('stroke-dasharray', dash)
      .attr('marker-end',    `url(#${arrow})`)
      .attr('opacity',       0.7);
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
    .attr('opacity',           0.6);
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

  /* Goal halo ring */
  props.filter(d => d.isGoal)
    .append('circle')
    .attr('r',            CFG.propR + 5)
    .attr('fill',         'none')
    .attr('stroke',       C.goal)
    .attr('stroke-width', 1)
    .attr('opacity',      0.35);

  /* Label below the circle */
  props.append('text')
    .attr('text-anchor', 'middle')
    .attr('dy',          CFG.propR + 12)
    .attr('font-size',   8.5)
    .attr('font-family', "'IBM Plex Mono', monospace")
    .attr('fill',        '#3a4a5a')
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
    .attr('opacity',      d => d.kind === 'noop' ? 0.82 : 1);

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

  /* Build sets of related ids */
  const adj = data.adjacency[d.id] || new Set();

  const mxPartners = new Set();
  [...(data.mutexActions || []), ...(data.mutexProps || [])].forEach(([a, b]) => {
    if (a === d.id) mxPartners.add(b);
    if (b === d.id) mxPartners.add(a);
  });

  /* Fade everything first */
  d3.selectAll('.node')    .attr('opacity', n =>
    n.id === d.id || adj.has(n.id) || mxPartners.has(n.id) ? 1 : 0.10);
  d3.selectAll('.edge')    .attr('opacity', 0.04);
  d3.selectAll('.mutex-arc').attr('opacity', 0.04);

  /* Re-show edges touching the selected node */
  d3.selectAll('.edge')
    .filter(e => e.src === d.id || e.tgt === d.id)
    .attr('opacity', 0.9);

  /* Re-show mutex arcs touching the selected node */
  d3.selectAll('.mutex-arc')
    .filter(p => p.a === d.id || p.b === d.id)
    .attr('opacity', 1);
}

function _resetHighlight() {
  d3.selectAll('.node')    .attr('opacity', 1);
  d3.selectAll('.edge')    .attr('opacity', 0.7);
  d3.selectAll('.mutex-arc').attr('opacity', 0.6);
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

/* ── Controls ─────────────────────────────────────────────── */
function _setupControls(data) {

  /* Show / hide no-op nodes and edges that touch them */
  document.getElementById('chk-noops').addEventListener('change', function () {
    const show = this.checked;
    d3.selectAll('.node-noop').attr('display', show ? null : 'none');
    d3.selectAll('.edge').filter(e => {
      const s = data.nodeById[e.src];
      const t = data.nodeById[e.tgt];
      return (s && s.kind === 'noop') || (t && t.kind === 'noop');
    }).attr('display', show ? null : 'none');
  });

  /* Show / hide delete-effect edges */
  document.getElementById('chk-del').addEventListener('change', function () {
    d3.selectAll('.e-del').attr('display', this.checked ? null : 'none');
  });

  /* Show / hide mutex arcs */
  document.getElementById('chk-mutex').addEventListener('change', function () {
    d3.selectAll('.mutex-arc').attr('display', this.checked ? null : 'none');
  });
}

function _resetView() {
  _selectedId = null;
  _resetHighlight();
  if (_svg && _zoom) {
    _svg.transition().duration(450)
      .call(_zoom.transform, d3.zoomIdentity);
  }
}
