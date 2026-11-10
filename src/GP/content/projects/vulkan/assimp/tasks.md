# Assimp (Vulkan)

No tasks. learnopengl's Assimp chapter has no code: `start/` = `solution/` = the `mesh` chapter's `start/`, so the
learner can look at the project they will work in (and build and run it: the window is cleared to the dark grey
(0.05, 0.05, 0.05) = (13, 13, 13), nothing is drawn yet). `edits.txt` is empty.

The project: `main.cpp` (the camera globals at (0, 0, 3) looking down -z, one pipeline `modelPipeline` from
`shaders/model_loading.vert` / `.frag`, the uniform buffer with view and projection at binding 0, the model matrix as
a push constant, depth test, no culling) and `models/` with `planet.obj`, `planet.mtl` and its four textures
(read-only).

Vulkan has no model loader of its own: like vulkan-tutorial.com the course uses the small header-only library
**tinyobjloader** for `.obj` files (Assimp, which learnopengl uses, would work too, but is a large library). The
chapter's text can mention that tinyobjloader reads one format (OBJ + MTL) into flat arrays – positions, normals,
texture coordinates, faces as indices, a material number per face – which the program turns into its own vertices.
