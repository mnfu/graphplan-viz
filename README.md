# Graphplan Visualizer
A local visualizer for the original Graphplan algorithm. Collects data from the original 1997 C code and renders it in the browser.

---

## Requirements

This project expects a **Linux-like environment**.

* On Linux/macOS: you're likely good to go
* On Windows: use Windows Subsystem for Linux (WSL) and run all commands inside it

---

## Setup

Clone the repo and build:

```bash
make
```

---

## Usage

You’ll need ops and facts files to run Graphplan.

You can download sample inputs from the original CMU source:
https://www.cs.cmu.edu/afs/cs.cmu.edu/usr/avrim/Planning/Graphplan/

For example:

* `rocket_ops`
* `rocket_facts2`

Run Graphplan like this:

```bash
./graphplan -o rocket_ops -f rocket_facts2 -d
```

### What this does

* Executes Graphplan with default values (`-d`)
* Generates a `graph_data.js` file as a side effect

---

## Viewing the Visualization

Once `graph_data.js` is generated:

1. Open `index.html` in your browser
2. The graph will render automatically

If no `graph_data.js` is present, the UI will still load, but no graph will be displayed.

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

### With `rocket_ops` + `rocket_facts2` 

<img width="1920" height="1080" alt="example graph" src="https://github.com/user-attachments/assets/8b8f564e-50d0-4d50-bf94-9afc99e495d7" />


---

### No `graph_data.js` (empty state)

<img width="1920" height="1080" alt="empty state" src="https://github.com/user-attachments/assets/5db6aeb9-1b98-41e4-a98e-38e0b3ef3171" />

