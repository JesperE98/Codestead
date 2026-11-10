# HDR – tasks (OpenGL)

learnopengl "HDR": `src/5.advanced_lighting/6.hdr`. Files: `main.cpp`, `shader_m.h`, `wood.png`, `lighting.vs/.fs`
(learnopengl's 6.lighting – the tunnel's lighting), `hdr.vs` (complete: the screen quad) and `hdr.fs` (its `main` is a
TODO).

**Fixed choices (the same in every API):**
- **Camera: (0, 0, 5) looking down +z – yaw = +90°** (cameraFront (0, 0, 1), pitch 0, fov 45, 800/600, near 0.1, far
  100). learnopengl's hdr demo starts at (0, 0, 5) with its Camera class looking down -z; that shows only the tunnel's
  near end wall (z = -2.5, almost black). The tunnel and its bright end (z = 52.5) lie in +z, so the course turns the
  camera round (checked with screenshots of both directions).
- Scene: learnopengl's `renderCube()` (2×2×2, position + normal + texcoords) with model = translate(0, 0, 25) ·
  scale(2.5, 2.5, 27.5) – the tunnel from z = -2.5 to 52.5, ±2.5 in x/y – drawn with `inverse_normals` = true (the
  vertex shader negates the normal so the inside is lit); no culling; depth test on; clear (0.1, 0.1, 0.1) (never
  visible: the tunnel fills the window).
- `wood.png` loaded as an **sRGB texture** (`loadTexture("wood.png", true)` → `GL_SRGB`, learnopengl's
  gammaCorrection flag), `GL_REPEAT`, flipped on load, unit 0, sampler `diffuseTexture`.
- Four lights (learnopengl's): positions (0, 0, 49.5), (-1.4, -1.9, 9), (0, -1.8, 4), (0.8, -1.7, 6); colours
  (200, 200, 200), (0.1, 0, 0), (0, 0, 0.2), (0, 0.1, 0). `lighting.fs`: no ambient (0.0 × colour), diffuse
  `lights[i].Color * max(dot(lightDir, normal), 0.0) * color`, attenuation `1.0 / (distance * distance)`, no specular.
  **Deviation:** `uniform Light lights[4]` and a loop over 4 (learnopengl declares 16 and sets 4; the other 12 are
  zero and add nothing) – so the explicit APIs can put exactly four lights in their uniform/constant buffer.
- **Start:** the scene drawn straight into the window; `lighting.fs` gamma-corrects its result itself
  (`pow(ambient + lighting, vec3(1.0 / 2.2))`, as in the gamma-correction chapter). The window stores 0..1, so the far
  end (values far above 1) clips to plain white.
- No input: learnopengl toggles HDR with Space and changes the exposure with Q/E – the tasks switch the code instead;
  `exposure` is a fixed 1.0.
- The colour target is `GL_RGBA16F`, 800×600, `GL_LINEAR` filters, with a `GL_DEPTH_COMPONENT` renderbuffer.
  The screen quad is learnopengl's `renderQuad()` (NDC, triangle strip, position + texcoords), already in the start.

**What the camera sees:** the inside of the long wooden tunnel in perspective – the boards of the four walls run
towards the centre – and its far end (z = 52.5) as a small square in the middle of the window (x ≈ 355..445,
y ≈ 255..345), lit by the 200-strength back light 3 units in front of it. The walls get brighter towards the far end
(a glow around the square); near the camera they are very dark, with a faint red tint in the bottom-right corner (the
red light at (-1.4, -1.9, 9) – the window's right side shows the tunnel's -x wall, since the camera looks down +z).
The blue and green lights are too weak to see.

Pixels measured with Mesa (llvmpipe), coordinates from the top left of the 800×600 window; nothing depends on time.
Named points: **end-centre** (400,300), **end-1** (370,270), **end-2** (420,280), **end-3** (400,340), **end-edge**
(400,255) (the far end's top edge), **glow** (350,300) (the walls just outside the end square), **wall-near-end**
(330,300), **ceiling** (400,100), **floor** (400,560), **wall-right** (600,300), **floor-left** (100,500),
**red-corner** (760,560).

**Start picture:** the far end **clipped to flat white**: end-centre = 255,255,255, end-2 = 255,255,255, end-3 =
255,255,255, end-1 = 255,255,212, end-edge = 255,216,135 (red and green clip, the wood's blue does not); 2,480 pure
white pixels, 8,421 pixels with red = 255; only 221 distinct colours in the end square (x 355..444, y 255..344) – the
wood's boards are lost in the white. glow = 147,102,64, wall-near-end = 42,29,18, ceiling = 10,7,4, floor = 9,6,4,
wall-right = 9,7,4, floor-left = 24,15,9, red-corner = 38,14,9.

## `float-buffer`
- **Task:** Render the scene into an off-screen framebuffer whose colour buffer is a floating-point texture (`GL_RGBA16F`, values above 1.0 are kept), then draw that texture on a screen quad into the window with `hdr.fs`, which only gamma-corrects. Move the gamma correction from `lighting.fs` to `hdr.fs`.
- **Hint:** Like learnopengl: `glTexImage2D(GL_TEXTURE_2D, 0, GL_RGBA16F, SCR_WIDTH, SCR_HEIGHT, 0, GL_RGBA, GL_FLOAT, NULL);` for `colorBuffer`, a depth renderbuffer (`glRenderbufferStorage(GL_RENDERBUFFER, GL_DEPTH_COMPONENT, SCR_WIDTH, SCR_HEIGHT)`), both attached to `hdrFBO`. In the loop: bind `hdrFBO` and clear before the scene, bind 0 after it, clear, `hdrShader.use()`, bind `colorBuffer` to unit 0 and `renderQuad()`. `lighting.fs` writes `FragColor = vec4(ambient + lighting, 1.0);`; `hdr.fs`: `vec3 hdrColor = texture(hdrBuffer, TexCoords).rgb; vec3 result = pow(hdrColor, vec3(1.0 / gamma));`.
- **When done:** `main.cpp`: `Shader hdrShader("hdr.vs", "hdr.fs");`; learnopengl's `// configure floating point
  framebuffer` block (`hdrFBO`, `colorBuffer` with `GL_RGBA16F` / `GL_RGBA` / `GL_FLOAT` / `NULL`, `GL_LINEAR` min/mag,
  `rboDepth` with `GL_DEPTH_COMPONENT`, `glFramebufferTexture2D(GL_FRAMEBUFFER, GL_COLOR_ATTACHMENT0, GL_TEXTURE_2D,
  colorBuffer, 0)`, `glFramebufferRenderbuffer(GL_FRAMEBUFFER, GL_DEPTH_ATTACHMENT, GL_RENDERBUFFER, rboDepth)`,
  `glCheckFramebufferStatus`); `hdrShader.setInt("hdrBuffer", 0);`; in the loop `glBindFramebuffer(GL_FRAMEBUFFER,
  hdrFBO)` + `glClear(GL_COLOR_BUFFER_BIT | GL_DEPTH_BUFFER_BIT)` before the scene and, after `renderCube()`,
  `glBindFramebuffer(GL_FRAMEBUFFER, 0)`, `glClear(…)`, `hdrShader.use()`, `glActiveTexture(GL_TEXTURE0)`,
  `glBindTexture(GL_TEXTURE_2D, colorBuffer)`, `renderQuad()`; cleanup deletes `colorBuffer`, `rboDepth`, `hdrFBO`.
  `lighting.fs` ends with `FragColor = vec4(ambient + lighting, 1.0);` (no `pow`); `hdr.fs` reads `hdrBuffer` and writes
  `pow(hdrColor, vec3(1.0 / gamma))`. **No visible change:** the picture is identical to the start (0 pixels differ by
  more than 2; every named point as in the start, end-centre still 255,255,255) – the buffer now holds values above 1.0,
  but nothing maps them into 0..1 yet, so the window still clips them.

## `reinhard`
- **Task:** Tone-map the HDR colour with Reinhard before the gamma correction: `hdrColor / (hdrColor + 1.0)` maps 0..∞ into 0..1.
- **Hint:** In `hdr.fs`: `vec3 result = hdrColor / (hdrColor + vec3(1.0));` then `result = pow(result, vec3(1.0 / gamma));`.
- **When done:** `hdr.fs` has `vec3 result = hdrColor / (hdrColor + vec3(1.0));` followed by `result = pow(result,
  vec3(1.0 / gamma));`. **The far end shows its wood again** – no pixel is pure white any more (0 white pixels, 0 with
  red = 255; 408 distinct colours in the end square): end-centre = 242,228,198, end-1 = 231,210,168, end-2 =
  239,222,187, end-3 = 246,236,211, end-edge = 203,170,122, glow = 131,96,62 (was 147,102,64). The dark rest of the
  tunnel is darker by at most a step that rounds away (x / (x + 1) ≈ x for small x): wall-near-end 42,29,18, ceiling
  10,7,4, floor 9,6,4, wall-right 9,7,4, floor-left 24,15,9, red-corner 38,14,9 – unchanged. 14,037 pixels change,
  all in x 337..462, y 237..362 (the end and its glow); the mean brightness drops slightly (mean red 30.2 → 29.5).

## `exposure`
- **Task:** Replace Reinhard with learnopengl's exposure tone mapping `1.0 - exp(-hdrColor * exposure)`, with an `exposure` uniform set to 1.0 from the program (keep the Reinhard line as a comment).
- **Hint:** `main.cpp`: a global `float exposure = 1.0f;` and `hdrShader.setFloat("exposure", exposure);` before `renderQuad()`. `hdr.fs`: `uniform float exposure;` and `vec3 result = vec3(1.0) - exp(-hdrColor * exposure);`.
- **When done:** `main.cpp`: the global `float exposure = 1.0f;` and `hdrShader.setFloat("exposure", exposure);` in pass
  2; `hdr.fs`: `uniform float exposure;`, the Reinhard line commented out (`// vec3 result = hdrColor / (hdrColor +
  vec3(1.0));`) and `vec3 result = vec3(1.0) - exp(-hdrColor * exposure);`, then the gamma correction – learnopengl's
  6.hdr.fs without the `hdr` toggle. The far end is **brighter than with Reinhard but still shows its boards** (no pure
  white pixel; 3,536 pixels with red = 255 where the end is brightest; 391 distinct colours in the end square):
  end-centre = 255,252,222, end-1 = 253,236,184, end-2 = 255,248,208, end-3 = 255,254,237, end-edge = 228,186,128,
  glow = 138,99,63; the dark rest unchanged (wall-near-end 42,29,18, ceiling 10,7,4, floor 9,6,4, wall-right 9,7,4,
  floor-left 24,15,9, red-corner 38,14,9). 11,826 pixels differ from `reinhard` (12,155 from `float-buffer`), all in
  x 343..456, y 243..356. This is the solution.
- With exposure 1.0 the result is close to Reinhard; the parameter is the point: a **higher exposure** (e.g. 5.0)
  brightens the dark tunnel walls and lets the far end saturate again – it shows the dark parts; a **lower exposure**
  (e.g. 0.1) darkens the walls to black and brings out the far end's boards – it shows the bright parts. learnopengl
  changes it with Q/E at run time; here try other values in `main.cpp`.
