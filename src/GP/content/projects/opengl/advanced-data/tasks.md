# Advanced Data – tasks (OpenGL)

learnopengl "Advanced Data" (the chapter has no demo program; its snippets are used here): filling buffers in parts
(`glBufferSubData`), writing into a buffer through a pointer (`glMapBuffer`), batching vertex attributes, and copying
between buffers (`glCopyBufferSubData`). Files: `main.cpp`, `shader_m.h`, `advanced_data.vs`, `advanced_data.fs` (the
textured shaders of Depth Testing), `marble.png`, `metal.png`.

Start: the Depth Testing scene (`glEnable(GL_DEPTH_TEST); glDepthFunc(GL_LESS);`, cube 0 at (-1, 0, -1), cube 1 at
(2, 0, 0), then the floor; camera globals cameraPos (0, 0, 3) looking down -z, fov 45; clear colour (0.1, 0.1, 0.1)).
Four TODOs: above `cubeVertices` (batch the data), above the cube VBO's `glBufferData` (fill with glBufferSubData), above
the plane VBO's `glBufferData` (fill through glMapBuffer), before the plane VAO's attribute pointers (copy the buffer).

**Every task leaves the picture exactly as it is** (Mesa: identical pixels after every task) – the checks are on the
code. Picture (Mesa, coordinates from the top left of the 800×600 window, nothing depends on time): **background**
(400,100) = 26,26,26; **cube0-centre** (193,300) ≈ 141,140,138, **cube0-light** (150,250) ≈ 208,204,194; **cube 1**
(760,250) ≈ 168,165,159; **floor-near** (100,500) ≈ 137,141,147, (400,560) ≈ 83,87,93; **floor-far** (600,370) ≈
135,139,145.

## `buffer-sub-data`
- **Task:** Fill the cube's vertex buffer in two steps: `glBufferData` only reserves the memory (data `NULL`), then `glBufferSubData` copies `cubeVertices` into it from byte 0.
- **Hint:** `glBufferData(GL_ARRAY_BUFFER, sizeof(cubeVertices), NULL, GL_STATIC_DRAW);` then `glBufferSubData(GL_ARRAY_BUFFER, 0, sizeof(cubeVertices), &cubeVertices);` – target, offset in bytes, size, data.
- **When done:** in the cube VAO block (the TODO is gone):
  `glBufferData(GL_ARRAY_BUFFER, sizeof(cubeVertices), NULL, GL_STATIC_DRAW);` and
  `glBufferSubData(GL_ARRAY_BUFFER, 0, sizeof(cubeVertices), &cubeVertices);`. No visible change.

## `map-buffer`
- **Task:** Fill the floor's vertex buffer through a pointer: reserve it with `glBufferData(…, NULL, …)`, get a pointer with `glMapBuffer`, `memcpy` the vertices into it and unmap it.
- **Hint:** `void *ptr = glMapBuffer(GL_ARRAY_BUFFER, GL_WRITE_ONLY); memcpy(ptr, planeVertices, sizeof(planeVertices)); glUnmapBuffer(GL_ARRAY_BUFFER);` – `memcpy` needs `#include <cstring>`. After `glUnmapBuffer` the pointer must not be used any more.
- **When done:** `#include <cstring>`; in the plane VAO block (the TODO is gone):
  `glBufferData(GL_ARRAY_BUFFER, sizeof(planeVertices), NULL, GL_STATIC_DRAW);`,
  `void *ptr = glMapBuffer(GL_ARRAY_BUFFER, GL_WRITE_ONLY);`, `memcpy(ptr, planeVertices, sizeof(planeVertices));`,
  `glUnmapBuffer(GL_ARRAY_BUFFER);`. No visible change (the floor is still there).

## `batched-attributes`
- **Task:** Store the cube's data batched: replace `cubeVertices` by two arrays, `cubePositions` (36 × 3 floats) and `cubeTexCoords` (36 × 2 floats), put them one after the other into the cube's buffer (111…222… instead of 1212…) with two `glBufferSubData` calls, and point the attributes at the two blocks.
- **Hint:** Reserve `sizeof(cubePositions) + sizeof(cubeTexCoords)` bytes. The positions start at byte 0 with a stride of `3 * sizeof(float)`; the texture coordinates start at byte `sizeof(cubePositions)` with a stride of `2 * sizeof(float)`.
- **When done:** `float cubePositions[]` (learnopengl's 36 cube positions, same order) and `float cubeTexCoords[]` (their
  36 texture coordinates) instead of `cubeVertices` (the TODO is gone); the cube VAO block:
  `glBufferData(GL_ARRAY_BUFFER, sizeof(cubePositions) + sizeof(cubeTexCoords), NULL, GL_STATIC_DRAW);`,
  `glBufferSubData(GL_ARRAY_BUFFER, 0, sizeof(cubePositions), &cubePositions);`,
  `glBufferSubData(GL_ARRAY_BUFFER, sizeof(cubePositions), sizeof(cubeTexCoords), &cubeTexCoords);`,
  `glVertexAttribPointer(0, 3, GL_FLOAT, GL_FALSE, 3 * sizeof(float), (void*)0);`,
  `glVertexAttribPointer(1, 2, GL_FLOAT, GL_FALSE, 2 * sizeof(float), (void*)(sizeof(cubePositions)));`. No visible
  change (the marble on the cubes is the same).

## `copy-buffer`
- **Task:** Copy the floor's vertices into a second buffer on the GPU with `glCopyBufferSubData` (`GL_COPY_READ_BUFFER` = `planeVBO`, `GL_COPY_WRITE_BUFFER` = a new `planeCopyVBO`) and let the floor's VAO read its attributes from the copy.
- **Hint:** Reserve the new buffer with `glBufferData(GL_COPY_WRITE_BUFFER, sizeof(planeVertices), NULL, GL_STATIC_DRAW)`, then `glCopyBufferSubData(GL_COPY_READ_BUFFER, GL_COPY_WRITE_BUFFER, 0, 0, sizeof(planeVertices))` (read offset, write offset, size). `glVertexAttribPointer` takes the buffer bound to `GL_ARRAY_BUFFER`, so bind `planeCopyVBO` there before the attribute pointers. Delete the new buffer at the end.
- **When done:** before the plane's attribute pointers (the TODO is gone): `unsigned int planeCopyVBO;
  glGenBuffers(1, &planeCopyVBO); glBindBuffer(GL_COPY_WRITE_BUFFER, planeCopyVBO);
  glBufferData(GL_COPY_WRITE_BUFFER, sizeof(planeVertices), NULL, GL_STATIC_DRAW); glBindBuffer(GL_COPY_READ_BUFFER,
  planeVBO); glCopyBufferSubData(GL_COPY_READ_BUFFER, GL_COPY_WRITE_BUFFER, 0, 0, sizeof(planeVertices));
  glBindBuffer(GL_ARRAY_BUFFER, planeCopyVBO);`; `glDeleteBuffers(1, &planeCopyVBO);` at the end. No visible change (the
  floor now comes from the copy). Final state.
