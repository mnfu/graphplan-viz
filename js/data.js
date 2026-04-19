/* ============================================================
   js/data.js — Layout config and data processing for the
   Graphplan planning-graph visualizer.
   Loaded before graph.js; defines CFG and processData().
   ============================================================ */

'use strict';

/* ── Layout constants ─────────────────────────────────────── */
const CFG = {
  colW:  230,   /* pixel width of each column (prop or action) */
  rowH:  54,    /* pixel height of each row within a column    */
  propR: 19,    /* radius of proposition circles               */
  actW:  160,   /* width of action rectangles                  */
  actH:  34,    /* height of action rectangles                 */
  pad: {
    t: 72,      /* top padding (room for column headers)       */
    r: 70,      /* right padding                               */
    b: 50,      /* bottom padding                              */
    l: 60,      /* left padding                                */
  },
  mutexBulge: 48, /* how far mutex arcs extend outside their column */
};

/* ── processData ──────────────────────────────────────────── */
/**
 * Takes the raw GRAPH_DATA object (output of dump_graph_js) and
 * returns an enriched object ready for the renderer:
 *
 *  - Each node gains .col, .row, .x, .y, .isGoal
 *  - nodeById map for O(1) lookup
 *  - byCol map for column iteration
 *  - adjacency map (Set of connected node ids) for highlighting
 *  - maxRows  — height of the tallest column (in row units)
 *  - svgW, svgH — pixel dimensions of the drawing area
 */
function processData(raw) {

  /* ── 1. id lookup map ───────────────────────────────────── */
  const nodeById = Object.create(null);
  raw.nodes.forEach(n => { nodeById[n.id] = n; });

  /* ── 2. assign column index ─────────────────────────────── */
  /*
   * Column layout (0-indexed from left):
   *   col 0  = props  at t=0   (initial conditions)
   *   col 1  = actions at t=0
   *   col 2  = props  at t=1
   *   col 3  = actions at t=1
   *   ...
   *   col 2*maxtime = props at t=maxtime  (goals level)
   */
  raw.nodes.forEach(n => {
    n.col = (n.kind === 'prop') ? n.time * 2 : n.time * 2 + 1;
  });

  /* ── 3. group by column and assign row within column ─────── */
  const byCol = Object.create(null);
  raw.nodes.forEach(n => {
    if (!byCol[n.col]) byCol[n.col] = [];
    byCol[n.col].push(n);
  });

  Object.values(byCol).forEach(col => {
    /*
     * Sort order within a column:
     *   • For action columns: regular actions first (alpha), noops last (alpha)
     *   • For prop columns: alphabetical by label
     */
    col.sort((a, b) => {
      const aNoop = a.kind === 'noop' ? 1 : 0;
      const bNoop = b.kind === 'noop' ? 1 : 0;
      if (aNoop !== bNoop) return aNoop - bNoop;
      return a.label.localeCompare(b.label);
    });
    col.forEach((n, i) => { n.row = i; });
  });

  /* ── 4. compute pixel positions ─────────────────────────── */
  const colSize = Object.fromEntries(
    Object.entries(byCol).map(([c, ns]) => [+c, ns.length])
  );
  const maxRows = Math.max(1, ...Object.values(colSize));

  raw.nodes.forEach(n => {
    const sz  = colSize[n.col] || 1;
    /* centre short columns vertically relative to the tallest column */
    const topOffset = ((maxRows - sz) / 2) * CFG.rowH;
    n.x = CFG.pad.l + n.col * CFG.colW + CFG.colW / 2;
    n.y = CFG.pad.t + topOffset + n.row * CFG.rowH + CFG.rowH / 2;
  });

  /* ── 5. mark goal nodes ──────────────────────────────────── */
  const goalSet = new Set(raw.goals || []);
  raw.nodes.forEach(n => { n.isGoal = goalSet.has(n.id); });

  /* ── 6. build adjacency for click-highlighting ───────────── */
  const adjacency = Object.create(null);
  raw.nodes.forEach(n => { adjacency[n.id] = new Set(); });
  (raw.edges || []).forEach(({ src, tgt }) => {
    if (adjacency[src]) adjacency[src].add(tgt);
    if (adjacency[tgt]) adjacency[tgt].add(src);
  });

  /* ── 7. canvas dimensions ─────────────────────────────────── */
  const numCols = raw.maxtime * 2 + 1;
  const svgW = CFG.pad.l + numCols * CFG.colW + CFG.pad.r;
  const svgH = CFG.pad.t + maxRows * CFG.rowH  + CFG.pad.b;

  return {
    ...raw,
    nodeById,
    byCol,
    colSize,
    maxRows,
    adjacency,
    numCols,
    svgW,
    svgH,
  };
}
