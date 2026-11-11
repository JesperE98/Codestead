#!/usr/bin/env python3
"""Writes ltc_matrix.hpp: the two lookup tables of the Area Lights chapter (Linearly Transformed Cosines), as C++
float arrays LTC1 and LTC2 (64 x 64 texels, RGBA, row by row: 16,384 floats each).

    python3 make_ltc.py [ltc.js]      (no extra modules; downloads ltc.js when no file is given)

The tables are not ours: they are the GGX fit of Eric Heitz, Jonathan Dupuy, Stephen Hill and David Neubelt, from
their reference implementation github.com/selfshadow/ltc_code (fit/results/ltc.js, the file its fitting tool fitLTC
writes – learnopengl's ltc_matrix.hpp holds the same numbers). Its licence (BSD-style, copied into the header and
into LICENSE-ltc_code.txt next to this script) allows redistribution with the copyright notice and a reference to
the paper, so the course ships the tables with both. Fitting them ourselves (ltc_code's fit/fitLTC.cpp: a Nelder-Mead
fit of a 3x3 matrix per roughness and view angle) would give the same numbers.

  LTC1[i] = (a, b, c, d): the inverse matrix M^-1 = [a 0 b; 0 1 0; c 0 d] (columns as GLSL's mat3(vec3(a, 0, b),
            vec3(0, 1, 0), vec3(c, 0, d)) in learnopengl's shader).
  LTC2[i] = (norm, fresnel, 0, sphere): the BRDF's magnitude and Fresnel terms, and the horizon-clipped sphere's
            form factor used to clip the polygon at the horizon.
  Texel (x, y) = index y * 64 + x: x = roughness (0 .. 1), y = sqrt(1 - cos(theta_view)).
"""
import re
import sys
import os
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
COMMIT = "31e5e96b54f98f33098f8503003119ba2231a1c6"
URL = f"https://raw.githubusercontent.com/selfshadow/ltc_code/{COMMIT}/fit/results/ltc.js"

if len(sys.argv) > 1:
    text = open(sys.argv[1], encoding="utf-8").read()
else:
    text = urllib.request.urlopen(URL).read().decode("utf-8")
licence = open(os.path.join(HERE, "LICENSE-ltc_code.txt"), encoding="utf-8").read().strip()

def table(name):
    body = text.split(f"var {name} = [", 1)[1].split("];", 1)[0]
    nums = re.findall(r"[-+0-9.eE]+", body)
    assert len(nums) == 64 * 64 * 4, (name, len(nums))
    for n in nums:
        float(n)
    return nums

out = ["#pragma once", "", "// Linearly Transformed Cosines: the lookup tables for GGX area lights (Area Lights chapter).", "//",
       "// From github.com/selfshadow/ltc_code (fit/results/ltc.js, commit " + COMMIT[:7] + "), the reference implementation of",
       "//   Real-Time Polygonal-Light Shading with Linearly Transformed Cosines.",
       "//   Eric Heitz, Jonathan Dupuy, Stephen Hill and David Neubelt.",
       "//   ACM Transactions on Graphics (Proceedings of ACM SIGGRAPH 2016) 35(4), 2016.",
       "//   Project page: https://eheitzresearch.wordpress.com/415-2/",
       "// Written by make_ltc.py. Its licence:", "//"]
out += ["// " + line.rstrip() if line.strip() else "//" for line in licence.splitlines()]
out += ["", "// 64 x 64 texels, RGBA, row by row (texel (x, y) at index y * 64 + x): x = roughness, y = sqrt(1 - cos(theta)).",
        "// LTC1: the inverse matrix M^-1 = [a 0 b; 0 1 0; c 0 d] as (a, b, c, d).",
        "// LTC2: (norm, fresnel, 0, sphere): the BRDF's magnitude and Fresnel terms, and the horizon-clipped sphere's form factor.", ""]
for name, var in (("g_ltc_1", "LTC1"), ("g_ltc_2", "LTC2")):
    nums = table(name)
    out.append(f"const float {var}[] = {{")
    for i in range(0, len(nums), 4):
        out.append("    " + ", ".join(nums[i:i + 4]) + ",")
    out.append("};")
    out.append("")
open(os.path.join(HERE, "ltc_matrix.hpp"), "w", newline="\n").write("\n".join(out))
print("ltc_matrix.hpp written")
