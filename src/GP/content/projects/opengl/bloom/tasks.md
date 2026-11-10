# Bloom – tasks (OpenGL)

learnopengl "Bloom": `src/5.advanced_lighting/7.bloom`. Files: `main.cpp`, `shader_m.h`, `wood.png`, `container2.png`,
`bloom.vs/.fs` (the scene's lighting), `light_box.fs` (the light cubes, with `bloom.vs`), `blur.vs/.fs` (the Gaussian
blur: `blur.fs`'s `main` is a TODO), `bloom_final.vs/.fs` (the screen quad's tone mapping).

**Fixed choices (the same in every API):**
- Camera: (0, 0, 5) looking down -z (yaw -90, pitch 0, fov 45, 800/600, near 0.1, far 100) – learnopengl's. Clear
  (0.0, 0.0, 0.0), depth test on, no culling.
- Scene (learnopengl's bloom.cpp, all with `renderCube()`, the 2×2×2 cube): the floor cube translate(0, -1, 0) ·
  scale(12.5, 0.5, 12.5) with `wood.png`; six boxes with `container2.png`: (0, 1.5, 0) scale 0.5; (2, 0, 1) scale 0.5;
  (-1, -1, 2) rotate 60° about normalize(1, 0, 1) (no scale); (0, 2.7, 4) rotate 23° about normalize(1, 0, 1) scale
  1.25; (-2, 1, -3) rotate 124° about normalize(1, 0, 1) (no scale); (-3, 0, 0) scale 0.5. Both textures loaded as
  **sRGB** (`loadTexture(…, true)` → `GL_SRGB` / `GL_SRGB_ALPHA`), `GL_REPEAT`, flipped on load, unit 0, sampler
  `diffuseTexture`.
- Four lights: positions (0, 0.5, 1.5), (-4, 0.5, -3), (3, 0.5, 1), (-0.8, 2.4, -1); colours (5, 5, 5), (10, 0, 0),
  (0, 0, 15), (0, 5, 0). `bloom.fs`: no ambient, diffuse with `1.0 / (distance * distance)`, no specular. The light
  cubes: translate(lightPositions[i]) · scale(0.25), drawn with `bloom.vs` + `light_box.fs` (`FragColor =
  vec4(lightColor, 1.0)`).
- Exposure 1.0, tone mapping as learnopengl's bloom_final.fs: `result = vec3(1.0) - exp(-hdrColor * exposure)`, then
  `pow(result, vec3(1.0 / 2.2))`.
- **Start** = the hdr chapter's end state with this scene: the scene rendered into one `GL_RGBA16F` colour texture
  (`colorBuffer`, `GL_LINEAR`, `GL_CLAMP_TO_EDGE`) + a depth renderbuffer (`hdrFBO`), then tone-mapped to the window
  by `bloom_final.fs` (sampler `scene`) on learnopengl's `renderQuad()`.
- What the window shows in the intermediate tasks: after `bright-pass` the final quad samples the **bright texture**
  (colour attachment 1) instead of the scene, after `blur` the **blurred bright texture** – both through the same
  bloom_final tone mapping + gamma (only the texture bound to the `scene` sampler changes). After `combine` the
  scene plus the blurred bright texture, tone-mapped.
- Blur: learnopengl's ping-pong framebuffers (two `GL_RGBA16F` 800×600 textures, `GL_LINEAR`, `GL_CLAMP_TO_EDGE`, no
  depth), `amount = 10` passes starting horizontal, the first pass reading the bright texture; weights 0.2270270270,
  0.1945945946, 0.1216216216, 0.0540540541, 0.0162162162; texel offset `1.0 / textureSize(image, 0)` (one texel of the
  800×600 target). The final pass reads `pingpongColorbuffers[!horizontal]` (= the last one written: index 0 after
  10 passes: the result of a vertical pass).
- No input: learnopengl toggles bloom with Space and the exposure with Q/E; there is no `bloom` uniform here – the
  `combine` task adds the bloom for good.
