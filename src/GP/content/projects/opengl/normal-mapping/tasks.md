# Normal Mapping – tasks (OpenGL)

learnopengl "Normal Mapping": `src/5.advanced_lighting/4.normal_mapping` (`normal_mapping.cpp`, `4.normal_mapping.vs/.fs`).
Files: `main.cpp`, `shader_m.h`, `normal_mapping.vs/.fs`, `brickwall.png` (red bricks, 256×256 RGB) and
`brickwall_normal.png` (its tangent-space normal map, OpenGL convention: +x right, +y up in the texture as loaded with
the vertical flip, z out of the wall). Both are loaded by round 1's `loadTexture` (flipped on load, linear `GL_RGB`,
`GL_REPEAT`, mipmaps) – the normal map must stay linear (it holds directions, not colours).

**Fixed choices (the same in every API):**
- Scene: learnopengl's `renderQuad()` – a 2×2 quad at z = 0 facing +z, positions (-1, 1), (-1, -1), (1, -1), (1, 1),
  texture coordinates (0, 1), (0, 0), (1, 0), (1, 1), two triangles 1-2-3 and 1-3-4 – with
  `model = glm::rotate(glm::mat4(1.0f), glm::radians(-30.0f), glm::normalize(glm::vec3(1.0, 0.0, 1.0)))`, a **fixed
  -30°** (learnopengl turns the quad with time: `glfwGetTime() * -10.0` degrees).
- `lightPos` (0.5, 1.0, 0.3), camera globals at (0, 0, 3) looking down -z (yaw -90, pitch 0, fov 45, 800/600, 0.1, 100),
  clear (0.1, 0.1, 0.1), depth test on, no culling.
- Lighting (learnopengl's 4.normal_mapping.fs): ambient `0.1 * color`, diffuse `max(dot(lightDir, normal), 0.0) *
  color`, Blinn-Phong specular `vec3(0.2) * pow(max(dot(normal, halfwayDir), 0.0), 32.0)`, no attenuation.
- **Deviation from learnopengl:** learnopengl also draws the quad a second time, scaled 0.1 at the light's position, as
  a marker for the light; the course leaves that out (it would be a tiny normal-mapped brick square lit edge-on).

Start: `normal_mapping.vs` passes FragPos, Normal (with the normal matrix) and TexCoords in a `VS_OUT` block; the fragment
shader lights with the quad's own normal (`normalize(fs_in.Normal)`) in world space. `renderQuad()` already builds the
quad from learnopengl's `pos1`…`pos4`, `uv1`…`uv4`, `nm`, but with 8 floats per vertex (position, normal, texcoords).
TODOs: load the normal map (`main.cpp`), the tangent/bitangent calculation (`renderQuad`).

Pixels measured with Mesa (llvmpipe), coordinates from the top left of the 800×600 window; nothing depends on time.
The quad covers about 221,500 pixels (corners near (277,42), (682,187) and (57,435); the bottom corner lies below the window – the quad leaves it
between x 457 and 573 on the last row). Named points:
**background** (50,50) = 26,26,26 in every state; brick faces (flat in the normal map, so they look the same with
the geometric normal and with correct normal mapping): **highlight** (480,180), **brick-1** (300,250), **brick-2**
(600,300), **brick-3** (150,380); bevels (where the normal map tilts): **bevel-up** (544,476) – a bevel facing up
towards the light, **bevel-down** (303,388) – a bevel facing down.

**Start picture:** flat bricks: the texture with its light mortar lines, lit evenly with a highlight in the upper
right of the quad: highlight = 229,125,101, brick-1 = 99,44,30, brick-2 = 125,55,39, brick-3 = 68,30,21, bevel-up =
82,36,25, bevel-down = 95,46,34. Mean luminance inside the quad ≈ 67.5, no pixel inside the quad darker than 25.

## `normal-map`
- **Task:** Load the normal map (texture unit 1, sampler `normalMap`) and use its value as the normal: sample it, map the 0..1 colour to a -1..1 vector, normalise – used directly as if it were a world-space normal (learnopengl's first attempt).
- **Hint:** `unsigned int normalMap = loadTexture("brickwall_normal.png");`, `shader.setInt("normalMap", 1);`, `glActiveTexture(GL_TEXTURE1); glBindTexture(GL_TEXTURE_2D, normalMap);`. In the fragment shader: `vec3 normal = texture(normalMap, fs_in.TexCoords).rgb; normal = normalize(normal * 2.0 - 1.0);`.
- **When done:** `main.cpp`: `unsigned int normalMap  = loadTexture("brickwall_normal.png");`, `shader.setInt("normalMap",
  1);`, `glActiveTexture(GL_TEXTURE1); glBindTexture(GL_TEXTURE_2D, normalMap);` before `renderQuad()`,
  `glDeleteTextures(1, &normalMap);`. `normal_mapping.fs`: `uniform sampler2D normalMap;`, `vec3 normal =
  texture(normalMap, fs_in.TexCoords).rgb;` and `normal = normalize(normal * 2.0 - 1.0);` (instead of
  `normalize(fs_in.Normal)`). **The bricks get bumps, but lit wrongly:** the map's normals point along +z (the
  quad's direction *before* the rotation), so the whole quad is darker, most of all its lower left, and the bevels do not
  match the light: highlight = 162,78,58, brick-1 = 59,26,18, brick-2 = 75,32,23, brick-3 = 24,10,7, bevel-up =
  26,11,8 (dark although it faces the light), bevel-down = 18,9,7. Mean luminance inside the quad ≈ 38.9; ≈ 102,700
  pixels inside the quad are darker than 25.

## `tangents`
- **Task:** Calculate the tangent and bitangent of both triangles on the CPU from their edges and texture coordinate differences, and pass them as two more vertex attributes (locations 3 and 4).
- **Hint:** For a triangle with `edge1 = pos2 - pos1`, `edge2 = pos3 - pos1`, `deltaUV1 = uv2 - uv1`, `deltaUV2 = uv3 - uv1`: `f = 1.0f / (deltaUV1.x * deltaUV2.y - deltaUV2.x * deltaUV1.y)`, `tangent = f * (deltaUV2.y * edge1 - deltaUV1.y * edge2)`, `bitangent = f * (-deltaUV2.x * edge1 + deltaUV1.x * edge2)` (written per component like learnopengl). The second triangle uses pos1, pos3, pos4. Each vertex gets 14 floats: position, normal, texcoords, tangent, bitangent; stride `14 * sizeof(float)`, tangent offset 8, bitangent offset 11 floats.
- **When done:** `main.cpp` `renderQuad()`: learnopengl's tangent/bitangent block (`tangent1`, `bitangent1`, `tangent2`,
  `bitangent2`, `edge1`, `edge2`, `deltaUV1`, `deltaUV2`, `f`), `quadVertices` with 14 floats per vertex (each
  triangle's three vertices with its tangent/bitangent), the attribute pointers with stride `14 * sizeof(float)` and
  `glVertexAttribPointer(3, 3, …, (void*)(8 * sizeof(float)))`, `glVertexAttribPointer(4, 3, …, (void*)(11 *
  sizeof(float)))` with `glEnableVertexAttribArray(3)` / `(4)`. `normal_mapping.vs`: `layout (location = 3) in vec3
  aTangent;`, `layout (location = 4) in vec3 aBitangent;`. **No visible change** (the shaders do not use them yet):
  the picture is identical to `normal-map` (0 pixels differ). For this quad both triangles get tangent (2, 0, 0) and
  bitangent (0, 2, 0) (2 units of quad per 1 unit of texture; the shaders normalise them).

## `tbn`
- **Task:** Build the TBN matrix in the vertex shader (tangent, bitangent and normal transformed with the normal matrix) and use its transpose to bring the light position, the view position and the fragment position into tangent space; the fragment shader lights with those, so the normal map's normals are used in the space they were made in.
- **Hint:** `mat3 normalMatrix = transpose(inverse(mat3(model))); vec3 T = normalize(normalMatrix * aTangent); vec3 B = normalize(normalMatrix * aBitangent); vec3 N = normalize(normalMatrix * aNormal); mat3 TBN = transpose(mat3(T, B, N));` then `vs_out.TangentLightPos = TBN * lightPos;` (and `TangentViewPos`, `TangentFragPos = TBN * vs_out.FragPos`). In the fragment shader: `lightDir = normalize(fs_in.TangentLightPos - fs_in.TangentFragPos)`, `viewDir = normalize(fs_in.TangentViewPos - fs_in.TangentFragPos)`.
- **When done:** `normal_mapping.vs` and `.fs`: the `VS_OUT` block is `FragPos`, `TexCoords`, `TangentLightPos`,
  `TangentViewPos`, `TangentFragPos` (no `Normal`); the vertex shader computes `normalMatrix`, `T`, `B`, `N`, `TBN =
  transpose(mat3(T, B, N))` and the three tangent-space positions; the fragment shader's `lightDir` and `viewDir` use
  them. **The bricks' bumps are lit correctly:** the faces look as in the start, the bevels facing the light are bright,
  those facing away dark: highlight = 229,126,101, brick-1 = 99,44,30, brick-2 = 125,55,39, brick-3 = 68,29,21 (≈ the
  start: the faces are flat in the map), bevel-up = 107,48,34 (brighter than the start's 82,36,25), bevel-down =
  18,9,7 (in its own shade). Mean luminance inside the quad ≈ 64.6; ≈ 17,000 pixels inside the quad darker than 25 (the
  lower bevels and the grooves).

## `gram-schmidt`
- **Task:** Re-orthogonalise the TBN vectors in the vertex shader (Gram-Schmidt): make T perpendicular to N again and compute B as the cross product of N and T, instead of reading the bitangent attribute.
- **Hint:** `vec3 T = normalize(normalMatrix * aTangent); vec3 N = normalize(normalMatrix * aNormal); T = normalize(T - dot(T, N) * N); vec3 B = cross(N, T);`. On meshes with smooth (averaged) normals and tangents, T and N are no longer exactly perpendicular; this keeps the TBN matrix orthonormal, so its transpose is its inverse.
- **When done:** `normal_mapping.vs`: `T = normalize(T - dot(T, N) * N);` and `vec3 B = cross(N, T);` (the `aBitangent`
  line removed; the attribute stays in the vertex data like learnopengl's). **No visible change:** on this flat quad T,
  B and N are already perpendicular and `cross(N, T)` equals the computed bitangent – the picture is identical to
  `tbn` (0 pixels differ). This is the solution (learnopengl's `4.normal_mapping.vs/.fs`).
