# Advanced Lighting – tasks (OpenGL)

learnopengl "Advanced Lighting" (Blinn-Phong): `src/5.advanced_lighting/1.advanced_lighting` (`advanced_lighting.cpp`,
`1.advanced_lighting.vs/.fs`). Files: `main.cpp`, `shader_m.h`, `advanced_lighting.vs` (complete: position, normal and
texture coordinates in a `VS_OUT` interface block; the floor has no model matrix), `advanced_lighting.fs` (the lighting;
the Blinn-Phong branch is a TODO), `wood.png` (the course's floor boards, 256×256 RGB, `GL_REPEAT`).

Scene (learnopengl's): the floor plane `planeVertices` (±10 in x and z at y = -0.5, normal (0, 1, 0), texture coordinates
0..10 so the wood repeats ten times), `wood.png` on texture unit 0 (`floorTexture`), one light at `lightPos` (0, 0, 0),
the course's camera globals at (0, 0, 3) looking down -z (yaw -90, pitch 0, fov 45, 800/600, 0.1, 100 – WASD / mouse /
scroll still work, nothing is needed), clear colour (0.1, 0.1, 0.1), depth test on. The fragment shader:
ambient `0.05 * color`, diffuse `max(dot(lightDir, normal), 0.0) * color`, specular `vec3(0.3) * spec`. The global
`bool blinn` (main.cpp) is sent with `shader.setInt("blinn", blinn);` every frame and picks the specular model in the
shader (`uniform bool blinn;`); learnopengl toggles it with the B key – here the task changes the code.
**Deviations from learnopengl:** no `glEnable(GL_BLEND)` (nothing is transparent); the sampler is set with
`shader.setInt("floorTexture", 0)` (learnopengl sets an unused `"texture1"`; both work because unit 0 is the default).

Pixels measured with Mesa (llvmpipe), coordinates from the top left of the 800×600 window; nothing depends on time.
The upper half is background (the floor ends at z = -10, the horizon is around y ≈ 330); the wood has dark seams
(e.g. the vertical one at x ≈ 400), so the named points avoid them.
**background** (400,100) = 26,26,26; **far floor** (450,380) ≈ 63,43,27 (no specular there in any state);
**floor-left** (100,500) ≈ 66,46,28; **floor-right** (700,550) ≈ 65,46,31.

**Start picture (Phong, exponent 8):** the lit wood floor with a soft highlight around the middle of the lower half:
**hl-centre** (450,440) ≈ 151,105,67, (350,440) ≈ 139,97,62, **hl-near** (450,470) ≈ 131,104,81,
**hl-side-left** (300,540) ≈ 118,99,83, **hl-side-right** (500,540) ≈ 126,105,87. With exponent 8 the "hard edge" of
learnopengl's comparison image (where the angle between view and reflection passes 90° and Phong's specular drops to 0)
is soft: the Phong highlight lies close to the camera and fades out towards the back. learnopengl's image uses an
exponent of 1.0 to make the edge obvious.

## `halfway`
- **Task:** Implement Blinn-Phong in the `if (blinn)` branch – the halfway vector between the light direction and the view direction, `spec` = its dot product with the normal (at least 0) to the power 8.0 – and switch the program to it: `bool blinn = true;`.
- **Hint:** `vec3 halfwayDir = normalize(lightDir + viewDir);` then `spec = pow(max(dot(normal, halfwayDir), 0.0), 8.0);`. The halfway vector never gets more than 90° away from the normal for a surface the light and the viewer both see, so there is no cut-off.
- **When done:** `advanced_lighting.fs`: in the `if (blinn)` branch `vec3 halfwayDir = normalize(lightDir + viewDir);` and
  `spec = pow(max(dot(normal, halfwayDir), 0.0), 8.0);` (the Phong `else` branch stays); `main.cpp`: `bool blinn = true;`.
  The highlight becomes **wider and reaches further back**, brighter in the middle and dimmer at the near sides:
  **hl-centre** (450,440) ≈ 173,128,89 (was 151,105,67), (350,440) ≈ 162,120,84, **hl-near** (450,470) ≈ 135,108,86,
  **hl-side-left** (300,540) ≈ 100,81,65 (was 118,99,83), **hl-side-right** (500,540) ≈ 109,87,69; floor-left
  (100,500) ≈ 65,45,28, floor-right (700,550) ≈ 59,41,26; far floor and background unchanged.

## `shininess`
- **Task:** Raise the Blinn-Phong exponent from 8.0 to 32.0 (learnopengl's value).
- **Hint:** The angle between the normal and the halfway vector is smaller than the one between the view and the reflection vector, so Blinn-Phong needs an exponent 2–4 times Phong's for a highlight of the same size: `spec = pow(max(dot(normal, halfwayDir), 0.0), 32.0);`.
- **When done:** `advanced_lighting.fs`: `spec = pow(max(dot(normal, halfwayDir), 0.0), 32.0);` in the Blinn-Phong branch.
  The highlight becomes **smaller and tighter** (about the size of the start's Phong highlight, but centred further back):
  **hl-centre** (450,440) ≈ 146,101,62, (350,440) ≈ 134,92,57, **hl-near** (450,470) ≈ 99,72,50,
  **hl-side-left** (300,540) ≈ 66,47,31, **hl-side-right** (500,540) ≈ 74,53,35, floor-left ≈ 65,44,27, floor-right
  ≈ 57,39,24; far floor and background unchanged. This is the solution.

The simulator (checked with the app's simulator on every state): the same pictures within 1–2/255 at all named points.
