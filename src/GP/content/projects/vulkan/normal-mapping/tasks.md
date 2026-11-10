# Normal Mapping (Vulkan) – tasks

learnopengl "Normal Mapping": `src/5.advanced_lighting/4.normal_mapping` (`normal_mapping.cpp`, `4.normal_mapping.vs/.fs`).
Files: `main.cpp`, `shaders/normal_mapping.vert/.frag` (built to `normal_mapping.vert.spv` / `.frag.spv`),
`textures/brickwall.png` (red bricks, 256×256 RGB) and `textures/brickwall_normal.png` (its tangent-space normal map,
OpenGL convention: +x right, +y up in the texture as loaded with the vertical flip, z out of the wall). Both are loaded
by `loadTexture` as `VK_FORMAT_R8G8B8A8_UNORM` (linear – the normal map holds directions, not colours) and read with one
sampler (`VK_SAMPLER_ADDRESS_MODE_REPEAT`, linear filtering).

**Fixed choices (the same in every API):**
- Scene: learnopengl's `renderQuad()` – here `createQuadVertices()`, called in `initVulkan()` before
  `createVertexBuffer()`; it fills the member `std::vector<Vertex> vertices` (as vulkan-tutorial's `loadModel()` does) –
  a 2×2 quad at z = 0 facing +z, positions (-1, 1), (-1, -1), (1, -1), (1, 1), texture coordinates (0, 1), (0, 0), (1, 0),
  (1, 1), two triangles 1-2-3 and 1-3-4, drawn with `vkCmdDraw(commandBuffer, static_cast<uint32_t>(vertices.size()), 1,
  0, 0)` and the model matrix `glm::rotate(glm::mat4(1.0f), glm::radians(-30.0f), glm::normalize(glm::vec3(1.0, 0.0,
  1.0)))` in the push constants – a **fixed -30°** (learnopengl turns the quad with time: `glfwGetTime() * -10.0`
  degrees).
- `lightPos` (0.5, 1.0, 0.3), camera globals at (0, 0, 3) looking down -z (yaw -90, pitch 0, fov 45, 800/600, 0.1, 100,
  `proj[1][1] *= -1`), clear (0.1, 0.1, 0.1), depth test on, no culling. Uniform buffer (binding 0, vertex + fragment):
  `view`, `proj`, `viewPos` (+ `float pad1`), `lightPos` (+ `float pad2`) – std140 pads each vec3 to 16 bytes.
- Lighting (learnopengl's 4.normal_mapping.fs): ambient `0.1 * color`, diffuse `max(dot(lightDir, normal), 0.0) * color`,
  Blinn-Phong specular `vec3(0.2) * pow(max(dot(normal, halfwayDir), 0.0), 32.0)`, no attenuation.
- **Deviation from learnopengl:** learnopengl also draws the quad a second time, scaled 0.1 at the light's position, as
  a marker for the light; the course leaves that out (it would be a tiny normal-mapped brick square lit edge-on).

**Texture orientation (Vulkan):** the earlier Vulkan chapters keep stb_image's rows as they are (row 0 = the image's top
= v 0) and flip v in the vertex data. That would not work here: the tangent and bitangent are computed from the texture
coordinates, so with flipped v the bitangent would point *down* the quad while the normal map's green channel means *up*
the image – the bumps would be lit from the wrong side (the "OpenGL vs DirectX normal map" problem; the fix would be
`normal.y = -normal.y`). So this chapter does what learnopengl's samples do: `stbi_set_flip_vertically_on_load(true);`
before loading (row 0 = the image's bottom = v 0), and learnopengl's texture coordinates unchanged. The picture is
upright (Vulkan's projection flip makes world +y point up on the screen), T = +u = right, B = +v = up – the normal map's
convention.

Start: `normal_mapping.vert` passes `fragPos`, `normal` (with the normal matrix) and `texCoord` in a `VS_OUT` block; the
fragment shader lights with the quad's own normal (`normalize(fs_in.normal)`) in world space. `createQuadVertices()`
already builds the quad from learnopengl's `pos1`…`pos4`, `uv1`…`uv4`, `nm` – `{pos1, nm, uv1}` etc. (`Vertex` = `pos`,
`normal`, `texCoord`). TODOs: load the normal map (`initVulkan()`), the tangent/bitangent calculation
(`createQuadVertices()`).

Pixels measured on lavapipe, coordinates from the top left of the 800×600 window; nothing depends on time. Every picture
equals the OpenGL chapter's (mean difference ≤ 0.06/255, the named points within 1/255). The quad covers about 221,500
pixels (corners near (277,42), (682,187) and (57,435); the bottom corner lies below the window). Named points (the same
as OpenGL's): **background** (50,50) = 26,26,26 in every state; brick faces (flat in the normal map, so they look the
same with the geometric normal and with correct normal mapping): **highlight** (480,180), **brick-1** (300,250),
**brick-2** (600,300), **brick-3** (150,380); bevels (where the normal map tilts): **bevel-up** (544,476) – a bevel facing
up towards the light, **bevel-down** (303,388) – a bevel facing down.

**Start picture:** flat bricks: the texture with its light mortar lines, upright, lit evenly with a highlight in the
upper right of the quad: highlight = 229,125,101, brick-1 = 99,43,30, brick-2 = 125,55,39, brick-3 = 68,30,21, bevel-up =
82,36,25, bevel-down = 94,46,34. Mean luminance inside the quad ≈ 68 (0.299 R + 0.587 G + 0.114 B), no pixel inside the
quad darker than 25.

## normal-map
- **Task:** Load the normal map (`textures/brickwall_normal.png`) into a second texture at binding 2 of the descriptor set (`normalMap`) and use its value as the normal: sample it, map the 0..1 colour to a -1..1 vector, normalise – used directly as if it were a world-space normal (learnopengl's first attempt).
- **Hint:** Members `normalMapImage`, `normalMapImageMemory`, `normalMapImageView`; `loadTexture("textures/brickwall_normal.png", normalMapImage, normalMapImageMemory, normalMapImageView);` (after the flip, like the colour texture). A third layout binding (binding 2, combined image sampler, fragment stage), `poolSizes[1].descriptorCount = 2`, `createDescriptorSet(diffuseMapImageView, normalMapImageView, textureSampler, descriptorSet)` with a third `VkWriteDescriptorSet`; destroy the image, its view and memory in `cleanup()`. In the fragment shader: `layout(binding = 2) uniform sampler2D normalMap;`, `vec3 normal = texture(normalMap, fs_in.texCoord).rgb; normal = normalize(normal * 2.0 - 1.0);`.
- **When done:** `main.cpp`: `loadTexture("textures/brickwall_normal.png", normalMapImage, normalMapImageMemory,
  normalMapImageView)`; descriptor set layout with 3 bindings (binding 2 = `VK_DESCRIPTOR_TYPE_COMBINED_IMAGE_SAMPLER`,
  fragment stage); the pool with 2 image samplers; `createDescriptorSet(diffuseMapImageView, normalMapImageView,
  textureSampler, descriptorSet)` writing binding 2; the three destroy calls. `normal_mapping.frag`: `layout(binding = 2)
  uniform sampler2D normalMap;`, `vec3 normal = texture(normalMap, fs_in.texCoord).rgb;` and `normal = normalize(normal *
  2.0 - 1.0);` (instead of `normalize(fs_in.normal)`). **The bricks get bumps, but lit wrongly:** the map's normals point
  along +z (the quad's direction *before* the rotation), so the whole quad is darker, most of all its lower left, and the
  bevels do not match the light: highlight = 162,78,58, brick-1 = 59,25,18, brick-2 = 75,32,23, brick-3 = 24,11,7,
  bevel-up = 26,11,8 (dark although it faces the light), bevel-down = 18,9,7. Mean luminance inside the quad ≈ 39; ≈
  102,600 pixels inside the quad are darker than 25.

## tangents
- **Task:** Calculate the tangent and bitangent of both triangles on the CPU from their edges and texture coordinate differences, and pass them as two more vertex attributes (locations 3 and 4).
- **Hint:** For a triangle with `edge1 = pos2 - pos1`, `edge2 = pos3 - pos1`, `deltaUV1 = uv2 - uv1`, `deltaUV2 = uv3 - uv1`: `f = 1.0f / (deltaUV1.x * deltaUV2.y - deltaUV2.x * deltaUV1.y)`, `tangent = f * (deltaUV2.y * edge1 - deltaUV1.y * edge2)`, `bitangent = f * (-deltaUV2.x * edge1 + deltaUV1.x * edge2)` (written per component like learnopengl). The second triangle uses pos1, pos3, pos4. `Vertex` gets `glm::vec3 tangent; glm::vec3 bitangent;` and two more attribute descriptions (`std::array<VkVertexInputAttributeDescription, 5>`, locations 3 and 4, `VK_FORMAT_R32G32B32_SFLOAT`, `offsetof(Vertex, tangent)` / `offsetof(Vertex, bitangent)`); each vertex becomes `{pos1, nm, uv1, tangent1, bitangent1}` etc. In the vertex shader: `layout(location = 3) in vec3 inTangent; layout(location = 4) in vec3 inBitangent;`.
- **When done:** `main.cpp`: `Vertex` with `tangent` and `bitangent` and 5 attribute descriptions (locations 3, 4 at
  `offsetof(Vertex, tangent)`, `offsetof(Vertex, bitangent)`); in `createQuadVertices()` learnopengl's
  tangent/bitangent block (`tangent1`, `bitangent1`, `tangent2`, `bitangent2`, `edge1`, `edge2`, `deltaUV1`,
  `deltaUV2`, `f`) and the six vertices with their triangle's tangent/bitangent. `normal_mapping.vert`: `layout(location =
  3) in vec3 inTangent;`, `layout(location = 4) in vec3 inBitangent;`. **No visible change** (the shaders do not use them
  yet): the picture is identical to `normal-map` (0 pixels differ). For this quad both triangles get tangent (1, 0, 0)
  and bitangent (0, 1, 0).

## tbn
- **Task:** Build the TBN matrix in the vertex shader (tangent, bitangent and normal transformed with the normal matrix) and use its transpose to bring the light position, the view position and the fragment position into tangent space; the fragment shader lights with those, so the normal map's normals are used in the space they were made in.
- **Hint:** `mat3 normalMatrix = transpose(inverse(mat3(pc.model))); vec3 T = normalize(normalMatrix * inTangent); vec3 B = normalize(normalMatrix * inBitangent); vec3 N = normalize(normalMatrix * inNormal); mat3 TBN = transpose(mat3(T, B, N));` then `vs_out.tangentLightPos = TBN * ubo.lightPos;` (and `tangentViewPos`, `tangentFragPos = TBN * vs_out.fragPos`). In the fragment shader: `lightDir = normalize(fs_in.tangentLightPos - fs_in.tangentFragPos)`, `viewDir = normalize(fs_in.tangentViewPos - fs_in.tangentFragPos)`. Both `VS_OUT` blocks must list the same members in the same order (their locations follow from it).
- **When done:** `normal_mapping.vert` and `.frag`: the `VS_OUT` block is `fragPos`, `texCoord`, `tangentLightPos`,
  `tangentViewPos`, `tangentFragPos` (no `normal`); the vertex shader computes `normalMatrix`, `T`, `B`, `N`, `TBN =
  transpose(mat3(T, B, N))` and the three tangent-space positions; the fragment shader's `lightDir` and `viewDir` use
  them. **The bricks' bumps are lit correctly:** the faces look as in the start, the bevels facing the light are bright,
  those facing away dark: highlight = 229,126,101, brick-1 = 98,43,30, brick-2 = 125,55,39, brick-3 = 68,30,21 (≈ the
  start: the faces are flat in the map), bevel-up = 107,48,34 (brighter than the start's 82,36,25), bevel-down = 18,9,7
  (in its own shade). Mean luminance inside the quad ≈ 65.5; ≈ 16,900 pixels inside the quad darker than 25 (the lower
  bevels and the grooves).

## gram-schmidt
- **Task:** Re-orthogonalise the TBN vectors in the vertex shader (Gram-Schmidt): make T perpendicular to N again and compute B as the cross product of N and T, instead of reading the bitangent attribute.
- **Hint:** `vec3 T = normalize(normalMatrix * inTangent); vec3 N = normalize(normalMatrix * inNormal); T = normalize(T - dot(T, N) * N); vec3 B = cross(N, T);`. On meshes with smooth (averaged) normals and tangents, T and N are no longer exactly perpendicular; this keeps the TBN matrix orthonormal, so its transpose is its inverse.
- **When done:** `normal_mapping.vert`: `T = normalize(T - dot(T, N) * N);` and `vec3 B = cross(N, T);` (the
  `inBitangent` line removed; the attribute stays in the vertex data and declared in the shader, like learnopengl's).
  **No visible change:** on this flat quad T, B and N are already perpendicular and `cross(N, T)` equals the computed
  bitangent – the picture is identical to `tbn` (0 pixels differ). This is the solution (learnopengl's
  `4.normal_mapping.vs/.fs`).

Simulator (checked with the app's simulator): every state matches lavapipe (mean difference ≤ 0.02/255, no pixel off by
more than 24) – including `stbi_set_flip_vertically_on_load(true)` and the vertices built in `createQuadVertices()`.
