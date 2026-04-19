#ifndef DUMP_SEARCH_H
#define DUMP_SEARCH_H

/* duplicated from graphplan.h (forward decl + pointer type only) */
#define MAXGOALS 50
typedef struct VERTEX vertex_s, *vertex_t;
typedef vertex_t goal_arr[MAXGOALS];

/* lifecycle stuff */
void trace_open(void);
void trace_close(void);

/* called from planner.c at instrumentation points */
void trace_goal_set   (int time, goal_arr goals, int n);
void trace_try        (int time, vertex_t op, vertex_t for_goal);
void trace_mutex      (int time, vertex_t op, vertex_t for_goal);
void trace_cutoff     (int time, vertex_t op, vertex_t for_goal);
void trace_select     (int time, vertex_t op);
void trace_deselect   (int time, vertex_t op);
void trace_backtrack  (int time);
void trace_solution   (int maxtime);
void trace_failure    (void);

#endif