# Graphplan Visualizer
A local visualizer for the original Graphplan algorithm. Collects data from the original 1997 C code and renders it in the browser.

There is a github pages demo that uses data generated from `rocket_ops` and `rocket_veloso_facts`:
https://mnfu.github.io/graphplan-viz/
This *should* match the Figure 2 planning graph in: A. Blum and M. Furst, "Fast Planning Through Planning Graph Analysis", as well as Figure 1's defined ops.

---

## Requirements

This project expects a **Linux-like environment**.

* On Linux/macOS: you're likely good to go
* On Windows: WSL is recommended (other Unix-like environments may work)

---

## Setup

Clone the repo and build:

```bash
make
```

---

## Usage

You’ll need ops and facts files to run Graphplan.

There are quite a few samples to be found in the `ops-facts` directory.
If you want more, there are a few more available at the original CMU source that I did not put in this directory:
https://www.cs.cmu.edu/afs/cs.cmu.edu/usr/avrim/Planning/Graphplan/

For example, one may pick the following ops & facts:

* `rocket_ops`
* `rocket_facts2`

Using the `ops-facts` directory, you run Graphplan like this:

```bash
./graphplan -o ../ops-facts/rocket_ops -f ../ops-facts/rocket_facts2 -d
```

### What this does

* Executes Graphplan with default values (`-d`)
* Generates the `graph_data.js` and `search_trace.js` files we need for visualization

---

## Viewing the Visualization

Once `graph_data.js` is generated (technically `search_trace.js` is optional):

1. Open `index.html` in your browser
2. The graph will render automatically

If no `graph_data.js` is present, the UI will present an error message.\
If no `search_trace.js` is present, the `Search replay` toggle will do nothing.

---

## CLI Help

To see all available options from the original implementation:

```bash
./graphplan -h
```

---

## Original Source

This project builds on the original Graphplan implementation:

* Source Code: https://www.cs.cmu.edu/afs/cs.cmu.edu/usr/avrim/Planning/Graphplan/Source/
* README: https://www.cs.cmu.edu/afs/cs.cmu.edu/usr/avrim/Planning/Graphplan/README

---

## Performance Tips

If you experience performance issues (especially with large graphs), try the following:

* **Disable hardware acceleration** in your browser

* **Disable mutex arc rendering**
  Mutex arcs can dramatically increase DOM node count and are often the biggest performance cost.

---

## Examples (1080p)

### With `rocket_ops` + `rocket_facts2` (Planning Graph)

<img width="1920" height="1080" alt="rocket domain - planning graph" src="https://github.com/user-attachments/assets/fbd192c2-08be-425b-b536-35739bd26560" />

---
### With `rocket_ops` + `rocket_facts2` (Backward Search)

<img width="1920" height="1080" alt="rocket domain - backward search" src="https://github.com/user-attachments/assets/01165f20-c0f0-4e17-8f58-8dda483cd9c5" />
<img width="1920" height="1080" alt="rocket domain - backward search - plan found" src="https://github.com/user-attachments/assets/6c66580c-3040-4f35-a711-dd0d06250e9f" />

---

### No `graph_data.js` (empty state)

<img width="1920" height="1080" alt="no domain present" src="https://github.com/user-attachments/assets/e7bd4b1d-e959-4563-9a7c-517798d6e5be" />


