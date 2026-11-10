# Parallax Mapping (Vulkan) – tasks

learnopengl "Parallax Mapping": `src/5.advanced_lighting/5.1.parallax_mapping`, `5.2.steep_parallax_mapping`,
`5.3.parallax_occlusion_mapping`. Files: `main.cpp`, `shaders/parallax_mapping.vert` (complete: the normal-mapping
chapter's vertex shader – TBN with Gram-Schmidt, light/view/fragment positions in tangent space),
`shaders/parallax_mapping.frag`, `textures/bricks2.png` (sandy bricks, deep mortar), `textures/bricks2_normal.png` (its
tangent-space normal map) and `textures/bricks2_disp.png` (its **depth** map: white = deep – the mortar –, black = the
brick surface), all 256×256 RGB, loaded by `loadTexture` as `VK_FORMAT_R8G8B8A8_UNORM` (linear – the normal and depth
maps hold directions and depths, not colours), after `stbi_set_flip_vertically_on_load(true)` as in Normal Mapping, and
read with one sampler (REPEAT, linear filtering, anisotropy as in every chapter, no mipmaps).

**Fixed choices (the same in every API):**
- Scene: the normal-mapping chapter's quad (`createQuadVertices()`: 2×2 at z = 0, facing +z, with tangents/bitangents)
  with the model matrix `glm::rotate(glm::mat4(1.0f), glm::radians(-45.0f), glm::vec3(1.0f, 0.0f, 0.0f))` in the push
  constants: a **fixed -45° about x** – the top edge tilts away, the quad's normal points to (0, 0.707, 0.707), so the
  camera looks at the bricks from 45° above their surface, like a floor in front of it (learnopengl turns the quad with
  time, `glfwGetTime() * -10.0` degrees about normalize(1, 0, 1)).
- `lightPos` (0.5, 1.0, 0.3), `heightScale` = 0.1 (a global `float heightScale = 0.1f;` copied into the uniform buffer
  every frame; learnopengl changes it with the Q and E keys – no input here), camera globals at (0, 0, 3) looking down -z
  (yaw -90, pitch 0, fov 45, 800/600, 0.1, 100), clear (0.1, 0.1, 0.1), depth test on, no culling.
- Lighting as in normal mapping (ambient 0.1, diffuse, Blinn-Phong `vec3(0.2) * pow(…, 32.0)`), with the normal map and
  the colour sampled at the (shifted) `texCoords`.
- `ParallaxMapping` uses `viewDir.xy / viewDir.z` (learnopengl's chapter text; its 5.1 source file uses `viewDir.xy`
  without the division – "offset limiting"). learnopengl's `while` loop is kept in the steep / occlusion versions.
- **Deviation from learnopengl:** no light marker quad (as in normal mapping).

**Vulkan notes:** everything happens in tangent space, so Vulkan's clip space (y flip, depth 0..1) does not matter here.
What matters is the v direction: the three maps are loaded flipped like OpenGL's (see Normal Mapping), so the colour,
normal and depth maps are sampled at the same coordinates and the bitangent (+v) points up the images – `viewDir.xy` in
tangent space then shifts the coordinates in the right direction. `heightScale` sits in the uniform buffer right after
`lightPos` (std140: a float may fill the last 4 bytes of a vec3's 16-byte slot – it replaces `pad2`). The steep and
occlusion loops sample with `texture()` inside a `while` loop whose count depends on texture reads – non-uniform
control flow, where implicit derivatives are strictly undefined in GLSL; learnopengl does it and lavapipe gives the
pictures below (the sampler has no mipmaps; anisotropic filtering also uses the derivatives, so a driver could differ
slightly at the bricks' sides – `textureGrad` with the derivatives of `fs_in.texCoord` taken before the loop would be the
strict version).

Start: the normal-mapped quad with bricks2 (TBN, tangent space), no depth map: `main` of `parallax_mapping.frag` already
computes `viewDir` (tangent space) first and samples the normal map and the colour at `vec2 texCoords =
fs_in.texCoord;` – the TODO is the line that shifts `texCoords`. TODO in `main.cpp`: load the depth map.

Pixels measured on lavapipe, coordinates from the top left of the 800×600 window; nothing depends on time. Every picture
equals the OpenGL chapter's (mean difference ≤ 0.35/255, at most 0.27 % of the pixels off by more than 24 – only at
the quad's border in `parallax`, where OpenGL's mipmaps pick a coarser level at the wrap-around; the named points within
2/255 except top-edge in `parallax`: 118,106,97 here, 138,97,72 in OpenGL – the same reason). The quad covers x 84..715,
y 162..522 (a trapezoid, narrower at the top), 184,592 pixels. Named points (the same as OpenGL's): **background**
(400,100) = 26,26,26 in every state; **brick-top-1** (300,230) and **brick-top-2** (250,400) – on brick surfaces (depth
0: never shifted, the same in every state); **highlight** (560,240); **centre** (400,300); **front-1** (600,470) and
**front-2** (200,500) – where the bricks' front sides show once they look raised; **top-edge** (400,165) – just inside
the quad's far edge; **corner** (95,515) – just inside its near left corner. "Mean luminance" below = the mean of
0.299 R + 0.587 G + 0.114 B over the quad's pixels (those that are not the background colour); "pixels change" = pixels
that differ at all from the previous state.

**Start picture:** flat bricks: the mortar's bevels from the normal map, but every brick at the same height:
brick-top-1 = 121,76,49, brick-top-2 = 123,78,50, highlight = 238,163,117, centre = 75,69,63 (mortar), front-1 =
118,101,89 (mortar), front-2 = 21,15,11 (a bevel facing down), top-edge = 95,62,42, corner = 33,21,14. Mean luminance
inside the quad ≈ 92.2.

## parallax
- **Task:** Load the depth map (`textures/bricks2_disp.png`) into a fourth binding of the descriptor set (`depthMap`, binding 3), give the shaders `heightScale` (0.1) in the uniform buffer, and add learnopengl's `ParallaxMapping`: read the depth at the fragment's texture coordinates and shift the coordinates against the view direction (tangent space) by that depth times `heightScale`; sample the normal map and the colour at the shifted coordinates.
- **Hint:** `float heightScale = 0.1f;` (global); in `UniformBufferObject` `float heightScale;` in place of `pad2`, `ubo.heightScale = heightScale;` in `updateUniformBuffer()`, and `float heightScale;` after `lightPos` in the fragment shader's block. Members `heightMapImage`, `heightMapImageMemory`, `heightMapImageView`; `loadTexture("textures/bricks2_disp.png", heightMapImage, heightMapImageMemory, heightMapImageView);`; a fourth layout binding (binding 3, combined image sampler, fragment stage), `poolSizes[1].descriptorCount = 3`, `createDescriptorSet(diffuseMapImageView, normalMapImageView, heightMapImageView, textureSampler, descriptorSet)` with a fourth `VkWriteDescriptorSet`; the three destroy calls. In the shader: `layout(binding = 3) uniform sampler2D depthMap;`, `vec2 ParallaxMapping(vec2 texCoords, vec3 viewDir) { float height = texture(depthMap, texCoords).r; return texCoords - viewDir.xy / viewDir.z * (height * ubo.heightScale); }` and `texCoords = ParallaxMapping(fs_in.texCoord, viewDir);`. The depth map stores depth (white = deep) instead of height, so the shift is subtracted.
- **When done:** `main.cpp`: `float heightScale = 0.1f;` (global), `float heightScale` in `UniformBufferObject` after
  `lightPos` and `ubo.heightScale = heightScale;`, `loadTexture("textures/bricks2_disp.png", heightMapImage,
  heightMapImageMemory, heightMapImageView)`, descriptor set layout with 4 bindings (binding 3 = combined image sampler,
  fragment stage), the pool with 3 image samplers, `createDescriptorSet(diffuseMapImageView, normalMapImageView,
  heightMapImageView, textureSampler, descriptorSet)` writing binding 3, the three destroy calls.
  `parallax_mapping.frag`: `float heightScale;` in the uniform block, `layout(binding = 3) uniform sampler2D depthMap;`,
  the one-sample `ParallaxMapping` and `texCoords = ParallaxMapping(fs_in.texCoord, viewDir);`. **The bricks look
  raised** above the mortar: their front sides appear towards the camera, the mortar narrows. ≈ 121,900 pixels change.
  brick-top-1/2 unchanged (120,75,49 / 124,78,50, ±1), highlight = 219,139,91, centre = 188,121,81, front-1 =
  192,124,83, front-2 = 169,128,102, top-edge = 118,106,97, corner = 94,59,38 – at the quad's borders the shifted
  coordinates leave 0..1 and the texture repeats there (bits of the neighbouring bricks show along the edges). Mean
  luminance inside the quad ≈ 98.7. Close up, the bricks' sides look smeared (one sample cannot follow the depth map's
  steep steps).

## discard-edges
- **Task:** Discard the fragments whose shifted texture coordinates leave the 0..1 range, so the quad's borders show the bricks' outline instead of repeated texture.
- **Hint:** After `ParallaxMapping`: `if (texCoords.x > 1.0 || texCoords.y > 1.0 || texCoords.x < 0.0 || texCoords.y < 0.0) discard;`.
- **When done:** `parallax_mapping.frag`: the `if (…) discard;` line after `texCoords = ParallaxMapping(…)`. The quad's
  borders become **ragged**: where the bricks' (raised) outline ends, the background shows: top-edge (400,165) =
  26,26,26, corner (95,515) = 26,26,26; ≈ 7,050 pixels change, all along the borders (the quad shrinks from 184,592 to
  177,542 pixels, bounding box x 91..708, y 167..522). Everything inside is unchanged (centre 188,121,81, front-1
  192,124,83, front-2 169,128,102, highlight 219,139,91).

## steep
- **Task:** Replace the single sample with steep parallax mapping: walk along the view direction through depth layers (8 when looking straight at the surface, up to 32 at grazing angles) until the layer is deeper than the depth map, and return those texture coordinates.
- **Hint:** `float numLayers = mix(maxLayers, minLayers, abs(dot(vec3(0.0, 0.0, 1.0), viewDir)));` (`minLayers = 8`, `maxLayers = 32`), `layerDepth = 1.0 / numLayers`, `vec2 P = viewDir.xy / viewDir.z * ubo.heightScale; vec2 deltaTexCoords = P / numLayers;` then `while (currentLayerDepth < currentDepthMapValue) { currentTexCoords -= deltaTexCoords; currentDepthMapValue = texture(depthMap, currentTexCoords).r; currentLayerDepth += layerDepth; }` and `return currentTexCoords;`.
- **When done:** `parallax_mapping.frag` `ParallaxMapping`: learnopengl 5.2's layer loop (`minLayers`, `maxLayers`,
  `numLayers`, `layerDepth`, `currentLayerDepth`, `P`, `deltaTexCoords`, the `while` loop, `return currentTexCoords;`).
  **The bricks get sharp, solid sides**, but with visible **steps** (horizontal bands, one per layer) on the front sides:
  centre = 151,99,67, front-1 = 136,92,65, front-2 = 171,128,101, highlight = 221,141,92, corner = 69,43,28; brick tops
  unchanged; ≈ 105,600 pixels change against `discard-edges`; the quad 174,219 pixels (bounding box x 91..708,
  y 171..522), mean luminance ≈ 91.6.

## occlusion
- **Task:** Parallax occlusion mapping: after the loop, interpolate linearly between the last two layers (before and after the depth map was crossed) to find where the view ray really meets the surface.
- **Hint:** `vec2 prevTexCoords = currentTexCoords + deltaTexCoords; float afterDepth = currentDepthMapValue - currentLayerDepth; float beforeDepth = texture(depthMap, prevTexCoords).r - currentLayerDepth + layerDepth; float weight = afterDepth / (afterDepth - beforeDepth); vec2 finalTexCoords = prevTexCoords * weight + currentTexCoords * (1.0 - weight);` and return `finalTexCoords`.
- **When done:** `parallax_mapping.frag`: learnopengl 5.3's interpolation (`prevTexCoords`, `afterDepth`, `beforeDepth`,
  `weight`, `finalTexCoords`) instead of `return currentTexCoords;`. **The steps disappear**: the bricks' front sides
  become smooth gradients: centre = 136,87,58, front-1 = 130,89,63, front-2 = 166,127,102, highlight = 225,146,97,
  corner = 48,30,19; brick tops and background unchanged; ≈ 94,300 pixels change against `steep` (most by only a few
  levels; almost all on the bricks' front sides); the quad 174,613 pixels, mean luminance ≈ 89.8. This is the solution
  (learnopengl's `5.3.parallax_mapping.fs`).
