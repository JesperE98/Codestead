# Framebuffers – tasks (OpenGL)

learnopengl "Framebuffers": `5.1.framebuffers` (`framebuffers.cpp`, `5.1.framebuffers.vs/.fs`,
`5.1.framebuffers_screen.vs/.fs`) and the post-processing effects of the chapter text. Files: `main.cpp`, `shader_m.h`,
`framebuffers.vs`, `framebuffers.fs` (the textured shaders of Depth Testing), `framebuffers_screen.vs` (complete: passes
the 2D NDC position and the texture coordinates on), `framebuffers_screen.fs` (main is a TODO), `marble.png`, `metal.png`.

Start: the Depth Testing scene drawn straight to the window (`glEnable(GL_DEPTH_TEST); glDepthFunc(GL_LESS);`, cube 0 at
(-1, 0, -1), cube 1 at (2, 0, 0), then the floor; camera globals cameraPos (0, 0, 3) looking down -z, fov 45; clear
colour (0.1, 0.1, 0.1)). TODOs: after `Shader shader(...)` (the screen shader), after `planeVertices` (the quad's
vertices), after the plane VAO (the quad's VAO), after the shader configuration (the framebuffer), before the clear in
the loop (bind the framebuffer), after the floor's draw (back to the window, draw the quad), and in
`framebuffers_screen.fs`.

Pixels measured with Mesa (llvmpipe), coordinates from the top left of the 800×600 window; nothing depends on time.
Named points of the start picture (= Depth Testing start): **background** (400,100) and (30,150) = 26,26,26;
**cube0-centre** (193,300) ≈ 141,140,138 (a grey marble vein), **cube0-light** (150,250) ≈ 208,204,194,
**cube0-bottom** (193,390) ≈ 193,190,182; **cube 1** (760,250) ≈ 168,165,159; **floor-near** (100,500) ≈ 137,141,147,
(400,560) ≈ 83,87,93; **floor-far** (600,370) ≈ 135,139,145.

## `offscreen-target`
- **Task:** Create a framebuffer with a colour texture (`SCR_WIDTH` × `SCR_HEIGHT`, `GL_RGB`) and a depth/stencil renderbuffer (`GL_DEPTH24_STENCIL8`), check that it is complete, and draw the scene into it: bind it before clearing; after the scene bind the default framebuffer (0) again, switch the depth test off and clear the window to white.
- **Hint:** `glGenFramebuffers` / `glBindFramebuffer(GL_FRAMEBUFFER, framebuffer)`; the texture gets `glTexImage2D(..., NULL)` (no data) and `glFramebufferTexture2D(GL_FRAMEBUFFER, GL_COLOR_ATTACHMENT0, GL_TEXTURE_2D, textureColorbuffer, 0)`; the renderbuffer `glRenderbufferStorage` + `glFramebufferRenderbuffer(..., GL_DEPTH_STENCIL_ATTACHMENT, ...)`; then `glCheckFramebufferStatus(GL_FRAMEBUFFER) != GL_FRAMEBUFFER_COMPLETE`. The screen pass disables the depth test, so enable it again at the start of every frame.
- **When done:** after the shader configuration learnopengl's "framebuffer configuration" block: `unsigned int framebuffer;`
  `glGenFramebuffers(1, &framebuffer); glBindFramebuffer(GL_FRAMEBUFFER, framebuffer);`, `unsigned int textureColorbuffer;`
  with `glTexImage2D(GL_TEXTURE_2D, 0, GL_RGB, SCR_WIDTH, SCR_HEIGHT, 0, GL_RGB, GL_UNSIGNED_BYTE, NULL)`, MIN/MAG filter
  `GL_LINEAR`, `glFramebufferTexture2D(GL_FRAMEBUFFER, GL_COLOR_ATTACHMENT0, GL_TEXTURE_2D, textureColorbuffer, 0)`,
  `unsigned int rbo;` `glGenRenderbuffers`, `glBindRenderbuffer`, `glRenderbufferStorage(GL_RENDERBUFFER,
  GL_DEPTH24_STENCIL8, SCR_WIDTH, SCR_HEIGHT)`, `glFramebufferRenderbuffer(GL_FRAMEBUFFER, GL_DEPTH_STENCIL_ATTACHMENT,
  GL_RENDERBUFFER, rbo)`, the `glCheckFramebufferStatus` check printing `ERROR::FRAMEBUFFER:: Framebuffer is not
  complete!`, `glBindFramebuffer(GL_FRAMEBUFFER, 0)`. In the loop: `glBindFramebuffer(GL_FRAMEBUFFER, framebuffer);
  glEnable(GL_DEPTH_TEST);` before the 0.1 clear; after the floor `glBindFramebuffer(GL_FRAMEBUFFER, 0);
  glDisable(GL_DEPTH_TEST); glClearColor(1.0f, 1.0f, 1.0f, 1.0f); glClear(GL_COLOR_BUFFER_BIT);` and a new TODO (draw the
  screen quad). Cleanup: `glDeleteTextures(1, &textureColorbuffer); glDeleteRenderbuffers(1, &rbo);
  glDeleteFramebuffers(1, &framebuffer);`. The scene now goes into the texture and nothing is drawn to the window yet:
  the **whole window is white** (its clear colour 1, 1, 1): every named point = 255,255,255.

## `screen-quad`
- **Task:** Draw the framebuffer's texture to the window: a quad that fills the screen (`quadVertices`: 6 vertices, 2D position in NDC + texture coordinates) with its own VAO, the screen shader `screenShader` (`framebuffers_screen.vs` / `.fs`, `screenTexture` = unit 0) that samples the texture, drawn after the white clear.
- **Hint:** The quad's positions go from -1 to 1 (already normalized device coordinates, no matrices); attribute 0 = 2 floats, attribute 1 = 2 floats, stride `4 * sizeof(float)`. In `framebuffers_screen.fs`: `vec3 col = texture(screenTexture, TexCoords).rgb; FragColor = vec4(col, 1.0);`. Bind `textureColorbuffer` and draw 6 vertices.
- **When done:** `Shader screenShader("framebuffers_screen.vs", "framebuffers_screen.fs");`, learnopengl's `quadVertices`
  (`-1, 1, 0, 1`, `-1, -1, 0, 0`, `1, -1, 1, 0`, `-1, 1, 0, 1`, `1, -1, 1, 0`, `1, 1, 1, 1`), `quadVAO`/`quadVBO` with
  `glVertexAttribPointer(0, 2, GL_FLOAT, GL_FALSE, 4 * sizeof(float), (void*)0)` and
  `glVertexAttribPointer(1, 2, GL_FLOAT, GL_FALSE, 4 * sizeof(float), (void*)(2 * sizeof(float)))`,
  `screenShader.use(); screenShader.setInt("screenTexture", 0);` in the configuration, in the loop after the white clear
  `screenShader.use(); glBindVertexArray(quadVAO); glBindTexture(GL_TEXTURE_2D, textureColorbuffer);
  glDrawArrays(GL_TRIANGLES, 0, 6);`, the quad's VAO/VBO deleted at the end; `framebuffers_screen.fs` main:
  `vec3 col = texture(screenTexture, TexCoords).rgb; FragColor = vec4(col, 1.0);`. The **start picture is back**, unchanged
  (Mesa: identical to the start within 1/255): background 26,26,26, cube0-centre ≈ 141,140,138, cube0-light ≈ 208,204,194,
  cube 1 ≈ 168,165,159, floor-near ≈ 137,141,147.

## `inversion`
- **Task:** Post-processing: invert the colours in the screen shader.
- **Hint:** `FragColor = vec4(vec3(1.0 - texture(screenTexture, TexCoords)), 1.0);`
- **When done:** `framebuffers_screen.fs` main is `FragColor = vec4(vec3(1.0 - texture(screenTexture, TexCoords)), 1.0);`.
  Every colour is 255 minus the old one: **background** (400,100) = 229,229,229 (light grey), **cube0-centre** ≈ 114,115,117,
  **cube0-light** (150,250) ≈ 47,51,61 (the marble turns dark blue-grey), **cube 1** ≈ 87,90,96, **floor-near** (100,500) ≈
  118,114,108 (brownish), (400,560) ≈ 172,168,162.

## `grayscale`
- **Task:** Replace the inversion with a grayscale effect: the weighted average of red, green and blue (0.2126, 0.7152, 0.0722) in all three channels.
- **Hint:** `FragColor = texture(screenTexture, TexCoords); float average = 0.2126 * FragColor.r + 0.7152 * FragColor.g + 0.0722 * FragColor.b; FragColor = vec4(average, average, average, 1.0);`
- **When done:** `framebuffers_screen.fs` main has those three lines (the inversion line is gone). The picture is the
  start picture in **grey** (r = g = b everywhere): background 26,26,26, **cube0-centre** ≈ 140,140,140, **cube0-light** ≈
  204,204,204, **cube 1** ≈ 165,165,165, **floor-near** (100,500) ≈ 141,141,141, (400,560) ≈ 87,87,87, floor-far ≈
  139,139,139.

## `sharpen`
- **Task:** Replace the grayscale with a kernel effect: sample the 3×3 texels around each fragment (`offset = 1.0 / 300.0`) and combine them with the sharpen kernel (-1 everywhere, 9 in the centre).
- **Hint:** `const float offset = 1.0 / 300.0;` before main; in main `vec2 offsets[9] = vec2[](...)` (top-left … bottom-right), `float kernel[9] = float[](-1.0, -1.0, -1.0, -1.0, 9.0, -1.0, -1.0, -1.0, -1.0);`, a loop filling `vec3 sampleTex[9]` with `vec3(texture(screenTexture, TexCoords.st + offsets[i]))`, then `col += sampleTex[i] * kernel[i]` and `FragColor = vec4(col, 1.0);`.
- **When done:** `framebuffers_screen.fs`: `const float offset = 1.0 / 300.0;`, `vec2 offsets[9]`, `float kernel[9]` with the
  sharpen values, `vec3 sampleTex[9]` filled in a `for` loop, `vec3 col` summed in a second loop,
  `FragColor = vec4(col, 1.0);`. Colours are back (no grey), **edges and veins are much stronger**: background 26,26,26
  (uniform areas keep their colour: 9 − 8 = 1), **cube0-centre** (193,300) = 0,0,0 (the vein becomes black),
  **cube0-bottom** (193,390) ≈ 253,249,236, (300,250) ≈ 110,109,108, **floor-near** (100,500) ≈ 135,139,145; the
  cubes' outlines get a bright rim and the floor pattern looks grainy.

## `blur`
- **Task:** Change the kernel to a blur: 1, 2, 1 / 2, 4, 2 / 1, 2, 1, divided by 16.
- **Hint:** Only `kernel` changes: `float kernel[9] = float[](1.0 / 16.0, 2.0 / 16.0, 1.0 / 16.0, 2.0 / 16.0, 4.0 / 16.0, 2.0 / 16.0, 1.0 / 16.0, 2.0 / 16.0, 1.0 / 16.0);` – the weights add up to 1, so the brightness stays.
- **When done:** `kernel` holds `1.0 / 16.0, 2.0 / 16.0, 1.0 / 16.0, 2.0 / 16.0, 4.0 / 16.0, 2.0 / 16.0, 1.0 / 16.0,
  2.0 / 16.0, 1.0 / 16.0`. A slightly **blurred** start picture: background 26,26,26, **cube0-centre** ≈ 155,153,150 (the
  vein is softened, was 141,140,138), **cube0-light** ≈ 209,205,194, cube 1 ≈ 170,168,162, **floor-near** ≈ 137,141,147,
  (400,560) ≈ 83,87,93.

## `edge-detection`
- **Task:** Change the kernel to edge detection: 1 everywhere, -8 in the centre.
- **Hint:** `float kernel[9] = float[](1.0, 1.0, 1.0, 1.0, -8.0, 1.0, 1.0, 1.0, 1.0);` – the weights add up to 0, so uniform areas become black.
- **When done:** `kernel` holds `1.0, 1.0, 1.0, 1.0, -8.0, 1.0, 1.0, 1.0, 1.0`. The picture is **almost black with bright
  lines** where the colour changes: background (400,100) = 0,0,0, (30,150) = 0,0,0, **floor-near** (100,500) ≈ 2,2,2,
  (400,560) = 0,0,0, **floor-far** (600,370) ≈ 8,8,8, cube0-light (150,250) ≈ 6,6,3; bright lines along the veins (e.g.
  (193,300) ≈ 161,157,138), the cubes' outlines and the horizon; a light line along the window's top edge ((400,0) ≈ 168,180,198: the texture
  repeats, so the kernel there also reads the floor at the bottom edge – learnopengl's picture has such lines too).
  Final state.
