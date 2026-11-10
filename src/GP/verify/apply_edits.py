#!/usr/bin/env python3
"""Applies a chapter's task edits (edits.txt) to its start/ project, in order, and compares with solution/.

    src/GP/verify/apply_edits.py src/GP/content/projects/opengl/hello-window

edits.txt holds one section per task, in the order the tasks are shown:

    === task: render-loop
    --- file: main.cpp
    --- find:
        // TODO: the render loop
    --- replace:
        while (!glfwWindowShouldClose(window))
        {
        }

A section may have several edits (several --- file: blocks). "find" must occur exactly once in the file at that
point. The app applies the same edits when the learner clicks a solution (Codestead.GP.Course/Edits.cs).
"""
import os, sys, filecmp

def parse(path):
    tasks, cur, edit, field = [], None, None, None
    for raw in open(path, encoding="utf-8").read().replace("\r\n", "\n").split("\n"):
        if raw.startswith("=== task:"):
            cur = {"id": raw.split(":", 1)[1].strip(), "edits": []}
            tasks.append(cur); edit = None; field = None
        elif raw.startswith("--- file:"):
            edit = {"file": raw.split(":", 1)[1].strip(), "find": [], "replace": []}
            cur["edits"].append(edit); field = None
        elif raw.strip() in ("--- find:", "--- replace:"):
            field = raw.strip()[4:-1]
        elif field and edit is not None:
            edit[field].append(raw)
    for t in tasks:
        for e in t["edits"]:
            for f in ("find", "replace"):
                while e[f] and e[f][-1] == "": e[f].pop()
                e[f] = "\n".join(e[f])
    return tasks

def apply(project_files, tasks):
    for t in tasks:
        for e in t["edits"]:
            text = project_files.get(e["file"])
            if text is None:
                raise SystemExit(f"task {t['id']}: no file {e['file']}")
            n = text.count(e["find"]) if e["find"] else 0
            if n != 1:
                raise SystemExit(f"task {t['id']}: 'find' occurs {n} times in {e['file']}:\n{e['find']}")
            project_files[e["file"]] = text.replace(e["find"], e["replace"], 1)

def read_dir(d):
    files = {}
    for root, _, names in os.walk(d):
        for n in names:
            p = os.path.join(root, n)
            key = os.path.relpath(p, d).replace(os.sep, "/")
            if n.lower().endswith((".png", ".jpg", ".obj", ".mtl", ".hdr")):
                files[key] = open(p, "rb").read()  # images: compared as bytes, never edited
            else:
                files[key] = open(p, encoding="utf-8").read().replace("\r\n", "\n")
    return files

if __name__ == "__main__":
    chapter = sys.argv[1].rstrip("/")
    start, solution = read_dir(os.path.join(chapter, "start")), read_dir(os.path.join(chapter, "solution"))
    edits = os.path.join(chapter, "edits.txt")
    tasks = parse(edits) if os.path.exists(edits) else []
    apply(start, tasks)
    ok = True
    for f in sorted(set(start) | set(solution)):
        if start.get(f) != solution.get(f):
            ok = False
            print(f"DIFFERS: {f}")
            import difflib
            if isinstance(start.get(f), bytes) or isinstance(solution.get(f), bytes):
                continue
            for line in list(difflib.unified_diff((solution.get(f) or "").split("\n"), (start.get(f) or "").split("\n"), "solution/" + f, "start+edits/" + f, lineterm=""))[:40]:
                print("  " + line)
    print(f"{chapter}: {len(tasks)} tasks, " + ("start + edits == solution" if ok else "MISMATCH"))
    sys.exit(0 if ok else 1)
