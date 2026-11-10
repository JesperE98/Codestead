# PBR Theory (Vulkan)

No tasks. learnopengl's Theory chapter has no code: `start/` = `solution/` = the `pbr-lighting` chapter's `start/`, so the
learner can look at the project they will work in (and build and run it); `edits.txt` is empty.

What runs: the window (800×600, clear (0.1, 0.1, 0.1) = 26,26,26) with learnopengl's 7 × 7 grid of spheres, each almost
black – (4, 0, 0) at every sphere's centre, e.g. (400,300) and (153,547) –, because `shaders/pbr.frag` only has the
constant ambient term yet (`vec3(0.03) * albedo * ao`, albedo (0.5, 0, 0)); the light loop and the three functions of
the BRDF are the tasks of `pbr-lighting`. The fixed choices (camera (0, 0, 22), the sphere with 24 × 24 segments, the
four lights, the uniform buffer and push constants) are described at the top of `../pbr-lighting/tasks.md`.
