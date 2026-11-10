# Anti Aliasing – tasks (OpenGL)

learnopengl "Anti Aliasing": `src/4.advanced_opengl/11.1.anti_aliasing_msaa` and `11.2.anti_aliasing_offscreen`.
Files: `main.cpp`, `shader_m.h`, `anti_aliasing.vs/.fs` (the cube: `projection * view * model`, flat green
`vec4(0.0, 1.0, 0.0, 1.0)`) and `aa_post.vs/.fs` (the screen quad, used from the `resolve` task on).

Start: learnopengl 11.1's scene without multisampling – one cube (36 vertices, positions only) at the origin, flat green,
clear (0.1, 0.1, 0.1), depth test on, the course's camera globals at (0, 0, 3) looking down -z (yaw -90, pitch 0,
fov 45, 800/600, 0.1, 100; WASD / mouse / scroll still work). TODOs in `main.cpp`: the `GLFW_SAMPLES` window hint,
`glEnable(GL_MULTISAMPLE)` and the multisampled framebuffer; in `aa_post.fs` the grayscale effect.

**Deviation from learnopengl:** the cube is turned by a fixed `model = glm::rotate(model, glm::radians(30.0f),
glm::vec3(1.0f, 1.0f, 0.0f));`. learnopengl's cube is not rotated: seen from (0, 0, 3) without input it is a square
with horizontal and vertical edges, which show no jagged steps, so anti-aliasing would change nothing visible (on
learnopengl's screenshots the camera was moved).

Pixels measured with Mesa (llvmpipe), coordinates from the top left of the 800×600 window. Nothing depends on time.
The cube's silhouette (a hexagon: three faces, all the same green) covers x 257..590, y 157..490. Background 26,26,26.

**Start picture:** the green silhouette with **hard, stair-stepped edges**: the image has exactly two colours, 0,255,0 and
26,26,26 (0 mixed edge pixels). Centre (400,300) = 0,255,0; (257,350) and (567,350) = 0,255,0 (the left and right
edges of row 350); background (100,100), (200,150), (600,450), (100,500) = 26,26,26.

How to check smooth edges: count the pixels that are neither background nor pure green (nor, after `post-process`,
pure 182 grey). With 4× MSAA the edge pixels get the mixes 1/4, 2/4, 3/4 of green and background (green channel ≈ 83,
140, 198): Mesa ≈ 806 such pixels, the simulator ≈ 809. Which edge pixel gets which mix depends on the GPU's sample
positions – check the count (several hundred, > 300) rather than single edge pixels.

## `msaa`
- **Task:** Turn on multisample anti-aliasing for the window: ask GLFW for a framebuffer with 4 samples per pixel before the window is created, and enable `GL_MULTISAMPLE`.
- **Hint:** `glfwWindowHint(GLFW_SAMPLES, 4);` next to the other hints (before `glfwCreateWindow`); then `glEnable(GL_MULTISAMPLE);` in the OpenGL state (enabled by default on most drivers, but not all).
- **When done:** `glfwWindowHint(GLFW_SAMPLES, 4);` after the profile hint, `glEnable(GL_MULTISAMPLE);` after
  `glEnable(GL_DEPTH_TEST);`. **The cube's edges become smooth**: ≈ 800 edge pixels in between green and background
  (e.g. green channel 83 / 140 / 198); centre (400,300) = 0,255,0 and the background unchanged.
  Note: under Xvfb (the headless X server of the checks) GLX offers no multisampled window – there the window gets
  0 samples (`GL_SAMPLES` = 0) and the screenshot stays jagged; on a real GPU, and in the simulator, the edges are
  smooth. The off-screen version (next task) is smooth in Mesa too.

## `offscreen-msaa`
- **Task:** Do the multisampling in your own framebuffer instead (learnopengl 11.2): a framebuffer with a 4-sample colour texture (`GL_TEXTURE_2D_MULTISAMPLE`) and a 4-sample depth/stencil renderbuffer; draw the scene into it, then resolve it into the window with `glBlitFramebuffer`. The window itself no longer needs samples: remove the `GLFW_SAMPLES` hint.
- **Hint:** `glTexImage2DMultisample(GL_TEXTURE_2D_MULTISAMPLE, 4, GL_RGB, SCR_WIDTH, SCR_HEIGHT, GL_TRUE);` attached with `glFramebufferTexture2D(GL_FRAMEBUFFER, GL_COLOR_ATTACHMENT0, GL_TEXTURE_2D_MULTISAMPLE, …)`; `glRenderbufferStorageMultisample(GL_RENDERBUFFER, 4, GL_DEPTH24_STENCIL8, SCR_WIDTH, SCR_HEIGHT);` attached as `GL_DEPTH_STENCIL_ATTACHMENT`; check `glCheckFramebufferStatus`. In the loop: `glBindFramebuffer(GL_FRAMEBUFFER, framebuffer);`, clear, draw; then `glBindFramebuffer(GL_READ_FRAMEBUFFER, framebuffer); glBindFramebuffer(GL_DRAW_FRAMEBUFFER, 0); glBlitFramebuffer(0, 0, SCR_WIDTH, SCR_HEIGHT, 0, 0, SCR_WIDTH, SCR_HEIGHT, GL_COLOR_BUFFER_BIT, GL_NEAREST);` – the blit averages each pixel's samples. (A blit into a multisampled window would need the same sample count and format – one reason to drop the window's samples.)
- **When done:** `main.cpp`: no `glfwWindowHint(GLFW_SAMPLES, 4)` any more (`glEnable(GL_MULTISAMPLE)` stays);
  learnopengl's `// configure MSAA framebuffer` block instead of the TODO (`unsigned int framebuffer;`,
  `textureColorBufferMultiSampled` with `glTexImage2DMultisample(GL_TEXTURE_2D_MULTISAMPLE, 4, GL_RGB, …, GL_TRUE)`,
  `rbo` with `glRenderbufferStorageMultisample(GL_RENDERBUFFER, 4, GL_DEPTH24_STENCIL8, …)`, the status check printing
  `"ERROR::FRAMEBUFFER:: Framebuffer is not complete!"`, `glBindFramebuffer(GL_FRAMEBUFFER, 0)`); in the loop after the
  window's clear: `// 1.` `glBindFramebuffer(GL_FRAMEBUFFER, framebuffer)`, `glClearColor(0.1f, 0.1f, 0.1f, 1.0f)`,
  `glClear(GL_COLOR_BUFFER_BIT | GL_DEPTH_BUFFER_BIT)`, `glEnable(GL_DEPTH_TEST)`; after the cube's draw `// 2.`
  `glBindFramebuffer(GL_READ_FRAMEBUFFER, framebuffer)`, `glBindFramebuffer(GL_DRAW_FRAMEBUFFER, 0)`, `glBlitFramebuffer(0,
  0, SCR_WIDTH, SCR_HEIGHT, 0, 0, SCR_WIDTH, SCR_HEIGHT, GL_COLOR_BUFFER_BIT, GL_NEAREST)`; cleanup deletes
  `textureColorBufferMultiSampled`, `rbo`, `framebuffer`. **Smooth edges** (now also in Mesa): ≈ 806 mixed edge pixels,
  e.g. (257,350) = 7,198,7 and (567,350) = 7,198,7 (Mesa's sample pattern), (304,480) = 13,140,13; centre (400,300) =
  0,255,0; background 26,26,26.

## `resolve`
- **Task:** Resolve into a texture instead of the window (learnopengl 11.2's intermediate framebuffer), so the anti-aliased image can be post-processed: an `intermediateFBO` with a normal `GL_RGB` colour texture `screenTexture`, blit the multisampled framebuffer into it, then draw a screen-filling quad (`quadVertices`, `aa_post.vs/.fs`) with that texture to the window, depth test off.
- **Hint:** A multisampled texture cannot be sampled like a normal one (`texture()`), but a blit into a normal texture resolves it. `glBindFramebuffer(GL_DRAW_FRAMEBUFFER, intermediateFBO);` for the blit; then `glBindFramebuffer(GL_FRAMEBUFFER, 0);`, clear, `glDisable(GL_DEPTH_TEST);`, `screenShader.use();`, `glBindVertexArray(quadVAO);`, `glBindTexture(GL_TEXTURE_2D, screenTexture);`, `glDrawArrays(GL_TRIANGLES, 0, 6);`. The framebuffers chapter's screen quad is the same.
- **When done:** `main.cpp`: `Shader screenShader("aa_post.vs", "aa_post.fs");`; learnopengl's `quadVertices` (6 vertices,
  NDC position + texture coordinates) and `// setup screen VAO` (`quadVAO`, `quadVBO`, attributes 0 = 2 floats and 1 = 2
  floats, stride 4 floats); `// configure second post-processing framebuffer`: `intermediateFBO`, `screenTexture`
  (`glTexImage2D(GL_TEXTURE_2D, 0, GL_RGB, SCR_WIDTH, SCR_HEIGHT, 0, GL_RGB, GL_UNSIGNED_BYTE, NULL)`, LINEAR filters,
  `GL_COLOR_ATTACHMENT0`), its status check (`"ERROR::FRAMEBUFFER:: Intermediate framebuffer is not complete!"`),
  `screenShader.setInt("screenTexture", 0)`; in the loop the blit goes to `intermediateFBO`, then `// 3.`
  `glBindFramebuffer(GL_FRAMEBUFFER, 0)`, `glClearColor(1.0f, 1.0f, 1.0f, 1.0f)`, `glClear(GL_COLOR_BUFFER_BIT)`,
  `glDisable(GL_DEPTH_TEST)`, the quad drawn with `screenTexture`; cleanup also deletes `quadVAO`, `quadVBO`,
  `screenTexture`, `intermediateFBO`. **No visible change** (the smooth cube of `offscreen-msaa`, pixel for pixel: ≈ 806
  mixed edge pixels, centre 0,255,0, background 26,26,26; the white clear is completely covered by the quad).

## `post-process`
- **Task:** Post-process the anti-aliased image: show it in grey in `aa_post.fs` (learnopengl's weighted grayscale 0.2126 / 0.7152 / 0.0722).
- **Hint:** `float grayscale = 0.2126 * col.r + 0.7152 * col.g + 0.0722 * col.b;` then `FragColor = vec4(vec3(grayscale), 1.0);`. The effect works on the resolved image, so the edges stay smooth.
- **When done:** `aa_post.fs`: `float grayscale = 0.2126 * col.r + 0.7152 * col.g + 0.0722 * col.b;` and
  `FragColor = vec4(vec3(grayscale), 1.0);`. **The cube turns grey**: inside (400,300) = 182,182,182 (0.7152 × 255),
  background (100,100) = 26,26,26 (grey stays grey), smooth grey edges ≈ 65 / 104 / 144 (≈ 806 mixed pixels, e.g.
  (257,350) = 144,144,144). Static. Final state.
