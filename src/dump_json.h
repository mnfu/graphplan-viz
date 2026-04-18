#ifndef DUMP_JSON_H
#define DUMP_JSON_H

/*
 * dump_graph_js(maxtime)
 *
 * Serializes the fully-built planning graph (fact_table, op_table,
 * exclusive edges, delete edges, goals) into a JavaScript file
 * called graph_data.js that the web visualizer reads directly.
 */
void dump_graph_js(int maxtime);

#endif /* DUMP_JSON_H */
