/* ============================================================
   js/search_anim.js — Step-3 backward search animation.

   Layered over the existing planning-graph SVG without
   touching graph.js. Receives the processed data object from
   main.js so it can look up edges and adjacency.

   Public API (consumed by main.js):
     initSearchAnim(data)   — wire controls after first render
     reapplySearchState()   — re-apply classes after re-render

   Depends on: d3 (global), SEARCH_TRACE (search_trace.js).
   ============================================================ */

'use strict';

/* ── Speed table: ms per auto-play step ─────────────────── */
/*
 * I think we really bottom out at around 8ms for speed improvements, but 4ms included just because
 */
const SA_SPEEDS = [2400, 1200, 800, 400, 180, 100, 60, 32, 16, 8, 4];

/* ── Module state ────────────────────────────────────────── */
let _data     = null;   /* processData() result — for edge lookups */
let _cursor   = -1;     /* current trace index, -1 = inactive     */
let _playing  = false;
let _timer    = null;
let _speedIdx = 5;      /* index into SA_SPEEDS (default 100ms)   */
let _active   = false;  /* is search-replay mode on?              */

/* ── State object ────────────────────────────────────────── */
/*
 * All visual state is derived by replaying SEARCH_TRACE[0..cursor].
 * "Persistent" fields accumulate across events.
 * "Transient" fields reset to null on every event.
 */
function _freshState() {
    return {
        /* persistent */
        goals:           new Set(),  /* prop node IDs: current layer goals     */
        selected:        new Set(),  /* action node IDs: committed this search */
        phase:           'search',   /* 'search' | 'solution' | 'failure'      */
        solutionIds:     new Set(),  /* action node IDs in the found plan      */

        /* transient */
        tried:           null,       /* action node ID currently being tried   */
        triedForGoal:    null,       /* prop node ID the try is aiming at      */
        rejected:        null,       /* { id, reason: 'mutex'|'cutoff' }      */
        backtrackedTime: null,       /* prop-layer time that just backtracked  */
    };
}

function _resetTransient(s) {
    s.tried           = null;
    s.triedForGoal    = null;
    s.rejected        = null;
    s.backtrackedTime = null;
}

/* ── Event → state ───────────────────────────────────────── */
function _applyEvent(evt, s) {
    _resetTransient(s);
    switch (evt.type) {

        case 'goal_set':
            s.goals = new Set(evt.goals);
            break;

        case 'try':
            s.tried        = evt.action;
            s.triedForGoal = evt.for_goal;
            break;

        case 'mutex':
            s.rejected = { id: evt.action, reason: 'mutex' };
            break;

        case 'cutoff':
            s.rejected = { id: evt.action, reason: 'cutoff' };
            break;

        case 'select':
            s.selected.add(evt.action);
            break;

        case 'deselect':
            s.selected.delete(evt.action);
            break;

        case 'backtrack':
            s.backtrackedTime = evt.time;
            break;

        case 'solution':
            s.phase = 'solution';
            /*
             * plan keys are 1-indexed time steps; node IDs use 0-indexed layers.
             * e.g. plan["1"] = actions at layer 0 → IDs "act_0_{name}"
             */
            if (evt.plan) {
                Object.entries(evt.plan).forEach(([k, names]) => {
                    const t = parseInt(k, 10) - 1;
                    names.forEach(name => s.solutionIds.add(`act_${t}_${name}`));
                });
            }
            break;

        case 'failure':
            s.phase = 'failure';
            break;
    }
}

/* Replay events 0..idx and return the resulting state */
function _stateAt(idx) {
    const s = _freshState();
    for (let i = 0; i <= idx; i++) _applyEvent(SEARCH_TRACE[i], s);
    return s;
}

/* ── DOM application ─────────────────────────────────────── */
/*
 * Node classification priority (first match wins):
 *   mutex / cutoff  →  tried  →  selected / solution
 *   →  goal  →  for-goal  →  dim
 *
 * CSS class rules have higher specificity than SVG presentation
 * attributes (graph.js uses .attr('fill', ...)), so our classes
 * cleanly override node fills without touching graph.js.
 */
function _applyState(s) {

    /* ── nodes ──────────────────────────────────────────────── */
    d3.selectAll('.node').each(function(d) {
        const el   = d3.select(this);
        const id   = d.id;

        const isMutex    = s.rejected?.id === id && s.rejected.reason === 'mutex';
        const isCutoff   = s.rejected?.id === id && s.rejected.reason === 'cutoff';
        const isTried    = id === s.tried   && !isMutex && !isCutoff;
        const isSelected = (s.selected.has(id) || s.solutionIds.has(id)) && !isTried;
        const isGoal     = s.goals.has(id)     && !isTried && !isMutex && !isCutoff;
        const isForGoal  = id === s.triedForGoal
            && !isGoal && !isTried && !isMutex && !isCutoff;

        /* In search phase, dim anything that isn't actively relevant */
        const isDim =
            s.phase === 'search' &&
            !isGoal && !isSelected && !isTried &&
            !isMutex && !isCutoff && !isForGoal;

        el.classed('sa-mutex',    isMutex)
            .classed('sa-cutoff',   isCutoff)
            .classed('sa-tried',    isTried)
            .classed('sa-selected', isSelected)
            .classed('sa-goal',     isGoal)
            .classed('sa-for-goal', isForGoal)
            .classed('sa-failure',  s.phase === 'failure')
            .classed('sa-dim',      isDim);
    });

    /* ── edges ───────────────────────────────────────────────── */
    d3.selectAll('.edge').each(function(e) {
        const el = d3.select(this);

        /* Highlight edge if it connects to a selected/tried node or leads into an active goal */
        const active =
            s.selected.has(e.src) || s.solutionIds.has(e.src) ||
            e.src === s.tried      || e.tgt === s.tried        ||
            (s.goals.has(e.tgt)   && (s.selected.has(e.src) || e.src === s.tried));

        el.classed('sa-edge-active', active)
            .classed('sa-edge-dim',    s.phase === 'search' && !active);
    });

    /* ── mutex arcs ──────────────────────────────────────────── */
    d3.selectAll('.mutex-arc').each(function(p) {
        const relevant =
            s.goals.has(p.a) || s.goals.has(p.b) ||
            s.selected.has(p.a) || s.selected.has(p.b);
        d3.select(this).classed('sa-arc-dim', s.phase === 'search' && !relevant);
    });

    _updateStatus(s);
    _syncScrubber();
}

function _clearAllSaClasses() {
    ['sa-goal','sa-selected','sa-tried','sa-mutex',
        'sa-cutoff','sa-for-goal','sa-failure','sa-dim']
        .forEach(c => d3.selectAll('.node').classed(c, false));

    ['sa-edge-active','sa-edge-dim']
        .forEach(c => d3.selectAll('.edge').classed(c, false));

    d3.selectAll('.mutex-arc').classed('sa-arc-dim', false);
}

/* ── Status text ─────────────────────────────────────────── */
function _humanName(nodeId) {
    if (!nodeId) return '';
    return nodeId
        .replace(/^(act|prop)_\d+_/, '')
        .replace(/_/g, ' ');
}

function _updateStatus(s) {
    const el = document.getElementById('sa-status');
    if (!el) return;

    if (s.phase === 'solution') {
        el.textContent  = '✓ Plan found';
        el.dataset.kind = 'ok';
        return;
    }
    if (s.phase === 'failure') {
        el.textContent  = '✗ No plan exists';
        el.dataset.kind = 'fail';
        return;
    }
    if (_cursor < 0) { el.textContent = ''; el.dataset.kind = ''; return; }

    const evt = SEARCH_TRACE[_cursor];
    const n   = _humanName;

    const msg = {
        goal_set:  e => `Goals at t=${e.time + 1}`,
        try:       e => `Try  ${n(e.action)}  →  ${n(e.for_goal)}`,
        mutex:     e => `Mutex conflict: ${n(e.action)}`,
        cutoff:    e => `Cutoff: ${n(e.action)}`,
        select:    e => `Commit: ${n(e.action)}`,
        deselect:  e => `Undo: ${n(e.action)}`,
        backtrack: e => `Backtrack at t=${e.time + 1}`,
    };

    el.textContent = msg[evt.type] ? msg[evt.type](evt) : evt.type;

    const kind = {
        goal_set: 'info', try: 'try',  select: 'ok',
        mutex: 'reject',  cutoff: 'reject',
        deselect: 'warn', backtrack: 'warn',
    };
    el.dataset.kind = kind[evt.type] || '';
}

/* ── Counter + scrubber ──────────────────────────────────── */
function _updateCounter() {
    const el = document.getElementById('sa-counter');
    if (!el) return;
    const total = SEARCH_TRACE?.length ?? 0;
    el.textContent = _cursor < 0
        ? `— / ${total}`
        : `${_cursor + 1} / ${total}`;
}

function _syncScrubber() {
    const sc = document.getElementById('sa-scrub');
    if (sc && _cursor >= 0) sc.value = _cursor;
    _updateCounter();
}

/* ── Playback ────────────────────────────────────────────── */
function _stepTo(idx) {
    if (!SEARCH_TRACE?.length) return;
    idx      = Math.max(0, Math.min(idx, SEARCH_TRACE.length - 1));
    _cursor  = idx;
    const s  = _stateAt(idx);
    _applyState(s);
}

function _stepForward()  { _cursor >= SEARCH_TRACE.length - 1 ? _pause() : _stepTo(_cursor + 1); }
function _stepBackward() { if (_cursor > 0) _stepTo(_cursor - 1); }

function _play() {
    if (_playing) return;
    _playing = true;
    document.getElementById('sa-play').textContent = '⏸';
    _timer = setInterval(_stepForward, SA_SPEEDS[_speedIdx]);
}

function _pause() {
    if (!_playing) return;
    _playing = false;
    clearInterval(_timer); _timer = null;
    const btn = document.getElementById('sa-play');
    if (btn) btn.textContent = '▶';
}

function _togglePlay() {
    if (_playing) {
        _pause();
    } else {
        // If we're at the end, reset to frame 0 before playing
        if (_cursor >= SEARCH_TRACE.length - 1) {
            _stepTo(0);
        }
        _play();
    }
}

/* ── Activate / deactivate search overlay ────────────────── */
function _activate() {
    _active = true;
    document.getElementById('anim-bar').classList.add('anim-bar--visible');
    _stepTo(0);
}

function _deactivate() {
    _pause();
    _active = false;
    _cursor = -1;
    document.getElementById('anim-bar').classList.remove('anim-bar--visible');
    _clearAllSaClasses();
}

/* ── Public: called by main.js after every renderGraph() ─── */
function reapplySearchState() {
    if (!_active || _cursor < 0) return;
    _applyState(_stateAt(_cursor));
}

/* ── Keyboard shortcuts ───────────────────────────────────── */
function _onKey(ev) {
    if (!_active) return;
    if (ev.target.tagName === 'INPUT' || ev.target.tagName === 'TEXTAREA') return;
    switch (ev.key) {
        case 'ArrowRight': case 'l': ev.preventDefault(); _pause(); _stepForward();  break;
        case 'ArrowLeft':  case 'h': ev.preventDefault(); _pause(); _stepBackward(); break;
        case ' ':                    ev.preventDefault(); _togglePlay();             break;
    }
}

/* ── Init (called by main.js with the processed data object) */
function initSearchAnim(data) {
    _data = data;

    /* Hide the toggle entirely if no trace was loaded */
    if (typeof SEARCH_TRACE === 'undefined' || !SEARCH_TRACE.length) {
        const wrap = document.getElementById('search-toggle-wrap');
        if (wrap) wrap.style.display = 'none';
        return;
    }

    /* Configure scrubber range */
    const scrub = document.getElementById('sa-scrub');
    if (scrub) {
        scrub.max = SEARCH_TRACE.length - 1;
        scrub.addEventListener('input', function() { _pause(); _stepTo(+this.value); });
    }

    /* Wire controls */
    document.getElementById('chk-search')
        ?.addEventListener('change', function() {
            this.checked ? _activate() : _deactivate();
        });

    document.getElementById('sa-prev')
        ?.addEventListener('click', () => { _pause(); _stepBackward(); });
    document.getElementById('sa-next')
        ?.addEventListener('click', () => { _pause(); _stepForward(); });
    document.getElementById('sa-play')
        ?.addEventListener('click', _togglePlay);

    document.getElementById('sa-speed')
        ?.addEventListener('input', function() {
            _speedIdx = +this.value;
            if (_playing) { _pause(); _play(); }   /* restart with new interval */
        });

    document.addEventListener('keydown', _onKey);
    _updateCounter();
}