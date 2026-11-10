# Depth Testing – tasks (OpenGL)

learnopengl "Depth testing": `1.1.depth_testing` (`depth_testing.cpp`) and `1.2.depth_testing_view`
(`depth_testing_view.cpp`, `1.2.depth_testing.fs`). Files: `main.cpp`, `shader_m.h`, `depth_testing.vs`,
`depth_testing.fs`, `marble.png` (the cubes), `metal.png` (the floor).

Start: learnopengl's depth-testing scene with the camera globals of the Camera chapter (no input → cameraPos
(0, 0, 3), cameraFront (0, 0, -1), yaw -90, pitch 0, fov 45; projection 45°, 800/600, 0.1, 100), clear colour
(0.1, 0.1, 0.1). Two marble cubes (learnopengl's 36 vertices, position + texcoords) at (-1, 0, -1) and (2, 0, 0) and the
metal floor (learnopengl's `planeVertices`, y = -0.5, ±5, texcoords 0..2, GL_REPEAT), drawn in learnopengl's order: cube 0,
cube 1, floor. One `Shader shader("depth_testing.vs", "depth_testing.fs")`, `loadTexture()` as in the lighting chapters
(it flips the images on load, so they are upright with learnopengl's texture coordinates). `glEnable(GL_DEPTH_TEST);` is
on; where the depth function goes there is a TODO: OpenGL's default `GL_LESS` is used.

Pixels measured with Mesa (llvmpipe), coordinates from the top left of the 800×600 window. Nothing moves (the picture
does not depend on time). Named points:
- **background** (400,100) and (30,150) = 26,26,26.
- **cube 0** (the left cube, front face x ≈ 90..319, y ≈ 197..402): **cube0-centre** (193,300) ≈ 141,140,138 (a grey vein
  of the marble), **cube0-light** (150,250) ≈ 208,204,194; **cube0-bottom** (193,390) ≈ 193,190,182.
- **cube 1** (2, 0, 0): only its left face shows at the right edge (x ≳ 700): (760,250) ≈ 168,165,159.
- **floor**: the far edge (horizon) is at y ≈ 350; **floor-near** (100,500) ≈ 137,141,147, (400,560) ≈ 83,87,93 (a dark
  stripe of the metal plate), **floor-far** (600,370) ≈ 135,139,145.

## `depth-always`
- **Task:** Make every fragment pass the depth test: set the depth function to `GL_ALWAYS`.
- **Hint:** `glDepthFunc(GL_ALWAYS);` after `glEnable(GL_DEPTH_TEST);`. With ALWAYS the last thing drawn wins – the same as switching the depth test off.
- **When done:** `glDepthFunc(GL_ALWAYS);` replaces the TODO (learnopengl's 1.1 demo). The floor is drawn last, so it is
  **drawn over the cubes** wherever it covers them: the lower parts of both cubes disappear behind the floor, e.g.
  **cube0-bottom** (193,390) becomes floor ≈ 148,152,158 (was marble 193,190,182); the cubes' back faces (drawn after
  their front faces) now also show where they overlap, so the cubes' upper parts look different (the left cube shows its
  top/back faces). Background, **cube0-centre** (193,300), cube 1 at (760,250) and the floor unchanged.

## `depth-less`
- **Task:** Set the depth function back to `GL_LESS`: a fragment passes when it is closer than the depth stored in the depth buffer.
- **Hint:** `glDepthFunc(GL_LESS);` – OpenGL's default.
- **When done:** `glDepthFunc(GL_LESS);` instead of `GL_ALWAYS` (learnopengl's 1.2). The **start picture is back**,
  identical pixels: **cube0-bottom** (193,390) ≈ 193,190,182 again.

## `visualize-depth`
- **Task:** Show the depth buffer: in `depth_testing.fs` output the fragment's depth `gl_FragCoord.z` as a grey value instead of the texture.
- **Hint:** `FragColor = vec4(vec3(gl_FragCoord.z), 1.0);` – keep the texture line as a comment so you can switch back.
- **When done:** `depth_testing.fs` main: `// FragColor = texture(texture1, TexCoords);` (commented out) and
  `FragColor = vec4(vec3(gl_FragCoord.z), 1.0);`. The cubes and the floor are **almost white**: the depth buffer is
  non-linear (most of its precision is near the near plane), so everything a few units away already has depth ≈ 0.95–0.98:
  **cube0-centre** ≈ 248,248,248, cube 1 (760,250) ≈ 247,247,247, **floor-near** (100,500) ≈ 241,241,241, (400,560) ≈
  237,237,237, **floor-far** (600,370) ≈ 250,250,250. Background stays 26,26,26 (no fragments there). The marble and
  metal textures are gone (no texture is sampled; `texture1` is unused).

## `linear-depth`
- **Task:** Make the depth linear: add learnopengl's `LinearizeDepth` (near 0.1, far 100) to the fragment shader and output `LinearizeDepth(gl_FragCoord.z) / far`.
- **Hint:** OpenGL's window depth maps NDC z -1..1 to 0..1, so first go back to NDC: `float z = depth * 2.0 - 1.0;`, then `return (2.0 * near * far) / (far + near - z * (far - near));` – the distance in front of the camera. Divide by `far` to get 0..1.
- **When done:** `depth_testing.fs` has `float near = 0.1; float far = 100.0;` and
  `float LinearizeDepth(float depth) { float z = depth * 2.0 - 1.0; return (2.0 * near * far) / (far + near - z * (far - near)); }`
  before `main`; main ends with `float depth = LinearizeDepth(gl_FragCoord.z) / far;` and
  `FragColor = vec4(vec3(depth), 1.0);` (learnopengl's `1.2.depth_testing.fs`). The scene is **almost black**: the
  value is distance / 100, so the cubes 3.5 units away are ≈ 0.035: **cube0-centre** ≈ 9,9,9, cube 1 (760,250) ≈ 8,8,8,
  **floor-near** (100,500) ≈ 5,5,5, (400,560) ≈ 4,4,4, the floor gets lighter towards the back: **floor-far** (600,370) ≈
  13,13,13. Background 26,26,26 (lighter than the objects). Final state.

  The other APIs: with Vulkan (GLM_FORCE_DEPTH_ZERO_TO_ONE) and Direct3D the projection already maps view depth to
  0..1 – there is no -1..1 NDC range to undo – so their linearisation is `near * far / (far - z * (far - near))` with
  z = the stored depth. OpenGL's formula is the same thing after `z * 2.0 - 1.0`.
