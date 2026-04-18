/* ============================================================
   js/main.js — Entry point for the Graphplan visualizer.
   Checks that GRAPH_DATA was loaded, processes it, renders it.
   ============================================================ */

'use strict';

window.addEventListener('DOMContentLoaded', () => {

  /* graph_data.js defines GRAPH_DATA if it loaded successfully */
  if (window.__dataLoadFailed || typeof GRAPH_DATA === 'undefined') {
    _showError();
    return;
  }

  /* Basic sanity check on the data structure */
  if (!GRAPH_DATA.nodes || !GRAPH_DATA.edges || typeof GRAPH_DATA.maxtime !== 'number') {
    _showError('graph_data.js exists but looks malformed. Re-run graphplan to regenerate it.');
    return;
  }

  const data = processData(GRAPH_DATA);
  renderGraph(data);
});

function _showError(msg) {
  const wrap = document.getElementById('viz');
  wrap.innerHTML = `
    <div class="viz-error">
      <div class="err-icon">⬡</div>
      <h2>graph_data.js not found</h2>
      <p>
        ${msg || 'Run graphplan on your domain to generate the data file, then place it next to <code>index.html</code>.'}
      </p>
      <p>
        Quick start with the rocket domain:<br>
        <code>./graphplan -o rocket_ops -f rocket_facts1 -t 3 -d</code><br>
        then copy <code>graph_data.js</code> here.
      </p>
    </div>`;
}
