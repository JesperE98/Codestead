# Parallax Mapping – tasks (OpenGL)

learnopengl "Parallax Mapping": `src/5.advanced_lighting/5.1.parallax_mapping`, `5.2.steep_parallax_mapping`,
`5.3.parallax_occlusion_mapping`. Files: `main.cpp`, `shader_m.h`, `parallax_mapping.vs` (complete: the normal-mapping
chapter's vertex shader – TBN with Gram-Schmidt, light/view/fragment positions in tangent space), `parallax_mapping.fs`,
`bricks2.png` (sandy bricks, deep mortar), `bricks2_normal.png` (its tangent-space normal map) and `bricks2_disp.png`
(its **depth** map: white = deep – the mortar –, black = the brick surface), all 256×256 RGB, loaded with round 1's
`loadTexture` (flipped on load, linear, `GL_REPEAT`, mipmaps); the normal and depth maps must stay linear.

**Fixed choices (the same in every API):**
- Scene: the normal-mapping chapter's `renderQuad()` (2×2 at z = 0, facing +z, with tangents/bitangents, 14 floats per
  vertex) with `model = glm::rotate(glm::mat4(1.0f), glm::radians(-45.0f), glm::vec3(1.0f, 0.0f, 0.0f))`: a **fixed
  -45° about x** – the top edge tilts away, the quad's normal points to (0, 0.707, 0.707), so the camera looks at the
  bricks from 45° above their surface, like a floor in front of it (learnopengl turns the quad with time
  `glfwGetTime() * -10.0` degrees about normalize(1, 0, 1)).
- `lightPos` (0.5, 1.0, 0.3), `heightScale` = 0.1 (a global `float heightScale = 0.1f;`; learnopengl changes it with the
  Q and E keys – no input here), camera globals at (0, 0, 3) looking down -z (yaw -90, pitch 0, fov 45, 800/600, 0.1,
  100), clear (0.1, 0.1, 0.1), depth test on, no culling.
- Lighting as in normal mapping (ambient 0.1, diffuse, Blinn-Phong `vec3(0.2) * pow(…, 32.0)`), with the normal map
  and the colour sampled at the (shifted) `texCoords`.
- `ParallaxMapping` uses `viewDir.xy / viewDir.z` (learnopengl's chapter text; its 5.1 source file uses `viewDir.xy`
  without the division – "offset limiting"). learnopengl's `while` loop is kept in the steep / occlusion versions.
- **Deviation from learnopengl:** no light marker quad (as in normal mapping).

Start: the normal-mapped quad with bricks2 (TBN, tangent space), no depth map: `main` of `parallax_mapping.fs` already
computes `viewDir` (tangent space) first and samples the normal map and the colour at `vec2 texCoords =
fs_in.TexCoords;` – the TODO is the line that shifts `texCoords`. TODO in `main.cpp`: load the depth map.

Pixels measured with Mesa (llvmpipe), coordinates from the top left of the 800×600 window; nothing depends on time.
The quad covers x 84..715, y 162..522 (a trapezoid, narrower at the top), 184,592 pixels. Named points:
**background** (400,100) = 26,26,26 in every state; **brick-top-1** (300,230) and **brick-top-2** (250,400) – on brick
surfaces (depth 0: never shifted, the same in every state); **highlight** (560,240); **centre** (400,300);
**front-1** (600,470) and **front-2** (200,500) – where the bricks' front sides show once they look raised;
**top-edge** (400,165) – just inside the quad's far edge; **corner** (95,515) – just inside its near left corner.

**Start picture:** flat bricks: the mortar's bevels from the normal map, but every brick at the same height:
brick-top-1 = 121,76,49, brick-top-2 = 123,78,50, highlight = 237,162,116, centre = 75,68,63 (mortar), front-1 =
118,102,89 (mortar), front-2 = 21,15,11 (a bevel facing down), top-edge = 95,62,41, corner = 33,21,14. Mean luminance
inside the quad ≈ 88.0.

## `parallax`
- **Task:** Load the depth map (unit 2, sampler `depthMap`) and add learnopengl's `ParallaxMapping`: read the depth at the fragment's texture coordinates and shift the coordinates against the view direction (tangent space) by that depth times `heightScale`; sample the normal map and the colour at the shifted coordinates.
- **Hint:** `unsigned int heightMap = loadTexture("bricks2_disp.png");`, `shader.setInt("depthMap", 2);`, `shader.setFloat("heightScale", heightScale);`, `glActiveTexture(GL_TEXTURE2); glBindTexture(GL_TEXTURE_2D, heightMap);`. In the shader: `vec2 ParallaxMapping(vec2 texCoords, vec3 viewDir) { float height = texture(depthMap, texCoords).r; return texCoords - viewDir.xy / viewDir.z * (height * heightScale); }` and `texCoords = ParallaxMapping(fs_in.TexCoords, viewDir);`. The depth map stores depth (white = deep) instead of height, so the shift is subtracted.
- **When done:** `main.cpp`: `float heightScale = 0.1f;` (global), `unsigned int heightMap  =
  loadTexture("bricks2_disp.png");`, `shader.setInt("depthMap", 2);`, `shader.setFloat("heightScale", heightScale);` in
  the loop, `glActiveTexture(GL_TEXTURE2); glBindTexture(GL_TEXTURE_2D, heightMap);` before `renderQuad()`,
  `glDeleteTextures(1, &heightMap);`. `parallax_mapping.fs`: `uniform sampler2D depthMap;`, `uniform float heightScale;`,
  the one-sample `ParallaxMapping` and `texCoords = ParallaxMapping(fs_in.TexCoords,  viewDir);`. **The bricks look
  raised** above the mortar: their front sides appear towards the camera, the mortar narrows. ≈ 80,400 pixels change.
  brick-top-1/2 unchanged (120,75,49 / 123,78,50, ±1), highlight = 220,140,91, centre = 188,121,81, front-1 = 192,124,83,
  front-2 = 169,129,102, top-edge = 138,97,72, corner = 95,59,38 – at the quad's borders the shifted coordinates leave
  0..1 and the texture repeats there (bits of the neighbouring bricks show along the edges). Mean luminance inside the
  quad ≈ 94.6. Close up, the bricks' sides look smeared (one sample cannot follow the depth map's steep steps).

## `discard-edges`
- **Task:** Discard the fragments whose shifted texture coordinates leave the 0..1 range, so the quad's borders show the bricks' outline instead of repeated texture.
- **Hint:** After `ParallaxMapping`: `if(texCoords.x > 1.0 || texCoords.y > 1.0 || texCoords.x < 0.0 || texCoords.y < 0.0) discard;`.
- **When done:** `parallax_mapping.fs`: the `if (…) discard;` line after `texCoords = ParallaxMapping(…)`. The quad's
  borders become **ragged**: where the bricks' (raised) outline ends, the background shows: top-edge (400,165) =
  26,26,26, corner (95,515) = 26,26,26; ≈ 7,000 pixels change, all along the borders (the quad shrinks from 184,592 to
  177,563 pixels, bounding box x 91..708, y 167..522). Everything inside is unchanged (centre 188,121,81, front-1
  192,124,83, front-2 169,129,102, highlight 220,140,91).

## `steep`
- **Task:** Replace the single sample with steep parallax mapping: walk along the view direction through depth layers (8 when looking straight at the surface, up to 32 at grazing angles) until the layer is deeper than the depth map, and return those texture coordinates.
- **Hint:** `float numLayers = mix(maxLayers, minLayers, abs(dot(vec3(0.0, 0.0, 1.0), viewDir)));` (`minLayers = 8`, `maxLayers = 32`), `layerDepth = 1.0 / numLayers`, `vec2 P = viewDir.xy / viewDir.z * heightScale; vec2 deltaTexCoords = P / numLayers;` then `while(currentLayerDepth < currentDepthMapValue) { currentTexCoords -= deltaTexCoords; currentDepthMapValue = texture(depthMap, currentTexCoords).r; currentLayerDepth += layerDepth; }` and `return currentTexCoords;`.
- **When done:** `parallax_mapping.fs` `ParallaxMapping`: learnopengl 5.2's layer loop (`minLayers`, `maxLayers`,
  `numLayers`, `layerDepth`, `currentLayerDepth`, `P`, `deltaTexCoords`, the `while` loop, `return currentTexCoords;`).
  **The bricks get sharp, solid sides**, but with visible **steps** (horizontal bands, one per layer) on the front sides:
  centre = 150,98,66, front-1 = 136,92,66, front-2 = 171,128,101, highlight = 223,142,93, corner = 69,43,28; brick tops
  unchanged; ≈ 64,600 pixels change against `discard-edges`; the quad 174,330 pixels (bounding box x 91..708,
  y 171..522), mean luminance ≈ 87.7.

## `occlusion`
- **Task:** Parallax occlusion mapping: after the loop, interpolate linearly between the last two layers (before and after the depth map was crossed) to find where the view ray really meets the surface.
- **Hint:** `vec2 prevTexCoords = currentTexCoords + deltaTexCoords; float afterDepth = currentDepthMapValue - currentLayerDepth; float beforeDepth = texture(depthMap, prevTexCoords).r - currentLayerDepth + layerDepth; float weight = afterDepth / (afterDepth - beforeDepth); vec2 finalTexCoords = prevTexCoords * weight + currentTexCoords * (1.0 - weight);` and return `finalTexCoords`.
- **When done:** `parallax_mapping.fs`: learnopengl 5.3's interpolation (`prevTexCoords`, `afterDepth`, `beforeDepth`,
  `weight`, `finalTexCoords`) instead of `return currentTexCoords;`. **The steps disappear**: the bricks' front sides
  become smooth gradients: centre = 136,87,58, front-1 = 130,88,63, front-2 = 168,128,103, highlight = 224,144,95,
  corner = 47,30,19; brick tops and background unchanged; ≈ 24,900 pixels change against `steep`, almost all on the
  bricks' front sides; the quad 174,713 pixels, mean luminance ≈ 85.9. This is the solution (learnopengl's
  `5.3.parallax_mapping.fs`).

## Notes for every API
- Everything happens in tangent space (the TBN of the normal-mapping chapter), so nothing here depends on the API's clip
  space. The only API-specific point is the texture's v direction: OpenGL flips the images on load, so v = 0 is the
  image's bottom row and the normal map's +y points up the texture; an API that does not flip must flip v (or the
  bitangent) consistently for the colour, normal and depth maps – the depth map must be sampled at exactly the same
  coordinates as the other two.
- `while` loops with a data-dependent count: GLSL and HLSL both allow them. Implicit-derivative sampling (`texture()` /
  `Sample`) inside such a loop is, strictly, in non-uniform control flow (GLSL leaves the derivatives undefined there);
  learnopengl does it and Mesa gives the pictures above. HLSL compilers refuse or warn about `Sample` in a loop whose
  count depends on a texture read – use `SampleLevel(…, 0)` or `SampleGrad` with the gradients of the original
  coordinates taken before the loop there, and say so.
