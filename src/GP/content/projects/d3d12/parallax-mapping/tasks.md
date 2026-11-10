# Parallax Mapping – tasks (DirectX 12)

learnopengl.com "Parallax Mapping": `src/5.advanced_lighting/5.1.parallax_mapping`, `5.2.steep_parallax_mapping`,
`5.3.parallax_occlusion_mapping`, on the normal-mapping chapter's Direct3D 12 code. Files: `main.cpp`, `parallax_mapping.hlsl`
(`VSMain` complete: the normal-mapping chapter's – TBN with Gram-Schmidt, `B = cross(T, N)`, light/view/fragment positions
in tangent space), `bricks2.png` (sandy bricks, deep mortar), `bricks2_normal.png` (its tangent-space normal map, OpenGL
convention – `PSMain` flips its y as in normal mapping) and `bricks2_disp.png` (its **depth** map: white = deep – the
mortar –, black = the brick surface), all 256×256 RGB, loaded by `LoadTexture` (no flip, `R8G8B8A8_UNORM`, one mip
level); the normal and depth maps must stay linear.

**Fixed choices (the same in every API):**
- Scene: the normal-mapping chapter's quad (2×2 at z = 0, facing +z, tangents/bitangents computed in `LoadAssets`, 14
  floats per vertex) with `model = XMMatrixRotationX(XMConvertToRadians(-45.0f))`: a **fixed -45° about x** – the top edge
  tilts away, the quad's normal points to (0, 0.707, 0.707), so the camera looks at the bricks from 45° above their
  surface, like a floor in front of it (learnopengl turns the quad with time, `glfwGetTime() * -10.0` degrees about
  normalize(1, 0, 1)).
- `lightPos` (0.5, 1.0, 0.3), `heightScale` = 0.1 (a global `float heightScale = 0.1f;` copied into the constant buffer
  every frame; learnopengl changes it with the Q and E keys – no input here), camera globals at (0, 0, 3) looking down
  -z (yaw -90, pitch 0, fov 45, 800/600, 0.1, 100), clear (0.1, 0.1, 0.1), depth test on, no culling.
- Lighting as in normal mapping (ambient 0.1, diffuse, Blinn-Phong `float3(0.2f, 0.2f, 0.2f) * pow(…, 32.0f)`), with the
  normal map and the colour sampled at the (shifted) `texCoords`.
- `ParallaxMapping` uses `viewDir.xy / viewDir.z` (learnopengl's chapter text; its 5.1 source file uses `viewDir.xy`
  without the division – "offset limiting"). learnopengl's `while` loop is kept in the steep / occlusion versions.
- **Deviation from learnopengl:** no light marker quad (as in normal mapping).
- **Direct3D:** in tangent space nothing depends on the API's clip space. The texture coordinates have v down the image
  (no flip on load), and so has the tangent frame (T = +u, B = +v, from the tangent calculation and `cross(T, N)`), so
  `viewDir.xy` is in texture-coordinate directions and learnopengl's shift `texCoords - viewDir.xy / viewDir.z * …` works
  unchanged; the colour, normal and depth maps are sampled at the same coordinates. Inside the `while` loop the depth map
  is read with **`SampleLevel(wrapSampler, uv, 0)`**: `Sample` needs the coordinates' rate of change between
  neighbouring pixels to pick a mip level, which is undefined when the number of loop steps differs from pixel to pixel
  – the HLSL compiler (FXC, used by `D3DCompileFromFile`) tries to unroll such a loop and fails ("gradient instruction
  used in a loop with varying iteration"). With one mip level, level 0 is exactly what `Sample` would read; with mipmaps
  one would take `ddx` / `ddy` of the original coordinates before the loop and use `SampleGrad` (what Microsoft's
  ParallaxOcclusionMapping sample does).

Start: the normal-mapped quad with bricks2 (TBN, tangent space), no depth map: `PSMain` already computes `viewDir`
(tangent space) first and samples the normal map and the colour at `float2 texCoords = input.texCoords;` – the TODO is the
line that shifts `texCoords`. TODO in `main.cpp`: load the depth map (`LoadAssets`, after the normal map).

Pixels in the 800×600 client area from the top left; nothing depends on time. D3D12 cannot run here; every picture below
is the app's simulator's. They match the OpenGL project's Mesa screenshots (mean difference ≤ 0.61 per pixel; ≈ 4,000–7,000 pixels differ by more than
8, all along the bricks' edges, where OpenGL samples mipmaps and Direct3D the one level). The quad covers x 84..715, y
162..522 (a trapezoid, narrower at the top), 184,592 pixels. Named points (as OpenGL's): **background** (400,100) =
26,26,26 in every state; **brick-top-1** (300,230) and **brick-top-2** (250,400) – on brick surfaces (depth 0: never
shifted, the same in every state); **highlight** (560,240); **centre** (400,300); **front-1** (600,470) and **front-2**
(200,500) – where the bricks' front sides show once they look raised; **top-edge** (400,165) – just inside the quad's far
edge; **corner** (95,515) – just inside its near left corner.

**Start picture:** flat bricks: the mortar's bevels from the normal map, but every brick at the same height:
brick-top-1 = 121,76,49, brick-top-2 = 123,78,50, highlight = 238,163,117, centre = 75,69,63 (mortar), front-1 =
118,101,89 (mortar), front-2 = 21,15,11 (a bevel facing down), top-edge = 95,62,42, corner = 33,21,14.

## parallax
- **Task:** Load the depth map (CBV/SRV heap slot 3, register t2), pass `heightScale` in the constant buffer, and add learnopengl's `ParallaxMapping`: read the depth at the fragment's texture coordinates and shift the coordinates against the view direction (tangent space) by that depth times `heightScale`; sample the normal map and the colour at the shifted coordinates.
- **Hint:** `float heightScale = 0.1f;` (global), `XMFLOAT3 viewPos; float heightScale;` in `SceneConstantBuffer` (the float fills viewPos's 16-byte row – it replaces `padding0`; HLSL: `float3 viewPos; float heightScale;`), `constantBufferData.heightScale = heightScale;` in `OnUpdate`. `LoadTexture("bricks2_disp.png", m_depthMap, depthMapUploadHeap, 3);` with 4 heap descriptors and 3 SRVs in the range (`ranges[1].Init(D3D12_DESCRIPTOR_RANGE_TYPE_SRV, 3, 0)`). In the shader: `Texture2D depthMap : register(t2);`, `float2 ParallaxMapping(float2 texCoords, float3 viewDir) { float height = depthMap.Sample(wrapSampler, texCoords).r; return texCoords - viewDir.xy / viewDir.z * (height * heightScale); }` and `texCoords = ParallaxMapping(input.texCoords, viewDir);`. The depth map stores depth (white = deep) instead of height, so the shift is subtracted.
- **When done:** `main.cpp`: `float heightScale = 0.1f;` (global), `float heightScale;` instead of `padding0` in
  `SceneConstantBuffer`, member `m_depthMap`, `cbvSrvHeapDesc.NumDescriptors = 4`, `ranges[1].Init(
  D3D12_DESCRIPTOR_RANGE_TYPE_SRV, 3, 0)`, `LoadTexture("bricks2_disp.png", m_depthMap, depthMapUploadHeap, 3);`,
  `constantBufferData.heightScale = heightScale;`. `parallax_mapping.hlsl`: `Texture2D depthMap : register(t2);`, `float
  heightScale;` after `viewPos` in the cbuffer, the one-sample `ParallaxMapping` and `texCoords =
  ParallaxMapping(input.texCoords, viewDir);`. **The bricks look raised** above the mortar: their front sides appear
  towards the camera, the mortar narrows. ≈ 79,900 pixels change by more than 8. brick-top-1/2 unchanged (120,75,49 /
  124,78,50, ±1), highlight = 219,139,91, centre = 188,121,81, front-1 = 192,124,83, front-2 = 169,128,102, corner =
  94,59,38, top-edge = 118,106,97 (OpenGL 138,97,72 – the most shrunken part of the quad, where OpenGL reads a smaller
  mip level) – at the quad's borders the shifted coordinates leave 0..1 and the texture repeats there (bits of the
  neighbouring bricks show along the edges). Close up, the bricks' sides look smeared (one sample cannot follow the
  depth map's steep steps).

## discard-edges
- **Task:** Discard the fragments whose shifted texture coordinates leave the 0..1 range, so the quad's borders show the bricks' outline instead of repeated texture.
- **Hint:** After `ParallaxMapping`: `if (texCoords.x > 1.0f || texCoords.y > 1.0f || texCoords.x < 0.0f || texCoords.y < 0.0f) discard;` (HLSL's `discard`, like GLSL's; `clip(x)` discards where x < 0 is another way).
- **When done:** `parallax_mapping.hlsl`: the `if (…) discard;` line after `texCoords = ParallaxMapping(…)`. The quad's
  borders become **ragged**: where the bricks' (raised) outline ends, the background shows: top-edge (400,165) =
  26,26,26, corner (95,515) = 26,26,26; ≈ 7,000 pixels change, all along the borders (the quad shrinks from 184,592 to
  ≈ 177,540 pixels, bounding box x 91..708, y 167..522). Everything inside is unchanged (centre 188,121,81, front-1
  192,124,83, front-2 169,128,102, highlight 219,139,91).

## steep
- **Task:** Replace the single sample with steep parallax mapping: walk along the view direction through depth layers (8 when looking straight at the surface, up to 32 at grazing angles) until the layer is deeper than the depth map, and return those texture coordinates.
- **Hint:** `float numLayers = lerp(maxLayers, minLayers, abs(dot(float3(0.0f, 0.0f, 1.0f), viewDir)));` (`const float minLayers = 8.0f; const float maxLayers = 32.0f;` – HLSL's `lerp` is GLSL's `mix`), `layerDepth = 1.0f / numLayers`, `float2 P = viewDir.xy / viewDir.z * heightScale; float2 deltaTexCoords = P / numLayers;`, then `while (currentLayerDepth < currentDepthMapValue) { currentTexCoords -= deltaTexCoords; currentDepthMapValue = depthMap.SampleLevel(wrapSampler, currentTexCoords, 0).r; currentLayerDepth += layerDepth; }` and `return currentTexCoords;` – `SampleLevel(…, 0)` instead of `Sample` for every read of the depth map in the function (see "Direct3D" above).
- **When done:** `parallax_mapping.hlsl` `ParallaxMapping`: learnopengl 5.2's layer loop (`minLayers`, `maxLayers`,
  `numLayers` with `lerp`, `layerDepth`, `currentLayerDepth`, `P`, `deltaTexCoords`, the `while` loop,
  `depthMap.SampleLevel(wrapSampler, currentTexCoords, 0)`, `return currentTexCoords;`). **The bricks get sharp, solid
  sides**, but with visible **steps** (horizontal bands, one per layer) on the front sides: centre = 150,98,66, front-1
  = 136,92,65, front-2 = 171,128,101, highlight = 221,141,92, corner = 69,43,28; brick tops unchanged; ≈ 62,700 pixels
  change by more than 8 against `discard-edges`; the quad ≈ 174,200 pixels (bounding box x 91..708, y 171..522).

## occlusion
- **Task:** Parallax occlusion mapping: after the loop, interpolate linearly between the last two layers (before and after the depth map was crossed) to find where the view ray really meets the surface.
- **Hint:** `float2 prevTexCoords = currentTexCoords + deltaTexCoords; float afterDepth = currentDepthMapValue - currentLayerDepth; float beforeDepth = depthMap.SampleLevel(wrapSampler, prevTexCoords, 0).r - currentLayerDepth + layerDepth; float weight = afterDepth / (afterDepth - beforeDepth); float2 finalTexCoords = prevTexCoords * weight + currentTexCoords * (1.0f - weight);` and return `finalTexCoords`.
- **When done:** `parallax_mapping.hlsl`: learnopengl 5.3's interpolation (`prevTexCoords`, `afterDepth`, `beforeDepth`
  with `SampleLevel`, `weight`, `finalTexCoords`) instead of `return currentTexCoords;`. **The steps disappear**: the
  bricks' front sides become smooth gradients: centre = 136,87,58, front-1 = 130,89,63, front-2 = 166,127,102,
  highlight = 225,146,97, corner = 48,30,19; brick tops and background unchanged; ≈ 24,300 pixels change by more than 8
  against `steep`, almost all on the bricks' front sides; the quad ≈ 174,500 pixels. This is the solution
  (learnopengl's `5.3.parallax_mapping.fs`, ported).

**Simulator (checked with the app's simulator on every state):** every state renders as described, including the
`while` loops of `steep` and `occlusion` (the HLSL reader follows them since the simulator update of this round); no
mismatch found.
