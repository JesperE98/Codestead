# Normal Mapping – tasks (DirectX 12)

learnopengl.com "Normal Mapping": `src/5.advanced_lighting/4.normal_mapping` (`normal_mapping.cpp`, `4.normal_mapping.vs/.fs`),
on the D3D12HelloWorld structure of the earlier chapters. Files: `main.cpp`, `normal_mapping.hlsl` (`VSMain`, `PSMain`),
`brickwall.png` (red bricks, 256×256 RGB) and `brickwall_normal.png` (its tangent-space normal map, **OpenGL convention**:
+x right, +y *up* the image, z out of the wall). Both are loaded by the earlier chapters' `LoadTexture` (no flip,
`R8G8B8A8_UNORM` – the normal map must stay linear: it holds directions, not colours).

**Fixed choices (the same in every API):**
- Scene: learnopengl's `renderQuad()` built in `LoadAssets` – a 2×2 quad at z = 0 facing +z, positions `pos1`…`pos4` =
  (-1, 1), (-1, -1), (1, -1), (1, 1), normal `nm` (0, 0, 1), two triangles 1-2-3 and 1-3-4 – with
  `model = XMMatrixRotationAxis(XMVector3Normalize(XMVectorSet(1.0f, 0.0f, 1.0f, 0.0f)), XMConvertToRadians(-30.0f))`, a
  **fixed -30°** (learnopengl turns the quad with time: `glfwGetTime() * -10.0` degrees). Texture coordinates
  `uv1`…`uv4` = (0, 0), (0, 1), (1, 1), (1, 0): learnopengl's with v flipped (Direct3D's v = 0 is the image's top).
- `lightPos` (0.5, 1.0, 0.3), camera globals at (0, 0, 3) looking down -z (yaw -90, pitch 0, fov 45, 800/600, 0.1, 100),
  clear (0.1, 0.1, 0.1), depth test on, no culling.
- Lighting (learnopengl's 4.normal_mapping.fs): ambient `0.1f * color`, diffuse `max(dot(lightDir, normal), 0.0f) *
  color`, Blinn-Phong specular `float3(0.2f, 0.2f, 0.2f) * pow(max(dot(normal, halfwayDir), 0.0f), 32.0f)`.
- Root constants (root parameter 0, `cbuffer ModelConstants : register(b0)`): `model` and `normalMatrix` (stored as
  `XMMatrixInverse(nullptr, model)`: transposed for HLSL that is transpose(inverse(model))); the CBV (b1):
  `view`, `projection`, `viewPos`, `lightPos`; textures t0 (diffuse) and from `normal-map` on t1 (normal) in one table.
- **Deviation from learnopengl:** learnopengl also draws the quad a second time, scaled 0.1 at the light's position, as
  a marker for the light; the course leaves that out (as the OpenGL project).
- **Direct3D's v and the bitangent:** with v growing *down* the image, the bitangent (the direction in which v grows)
  points down the wall – learnopengl's formula gives (0, -2, 0) here, learnopengl's own (0, 2, 0). The normal map's y
  points *up* the image (OpenGL-style, "Y+"; DirectX-style maps store "Y-"), so in tangent space the shader flips it:
  `normal.y = -normal.y;` (task `tbn`), and Gram-Schmidt computes `B = cross(T, N)` (down the image) instead of
  learnopengl's `cross(N, T)` (task `gram-schmidt`). Without the flip the bevels are lit from the wrong side (checked:
  ≈ 51,000 pixels differ from the OpenGL picture).

Start: `normal_mapping.hlsl`'s `VSMain` passes `fragPos`, `normal` (with the normal matrix) and `texCoords`; `PSMain`
lights with the quad's own normal (`normalize(input.normal)`) in world space. `LoadAssets` already builds the quad from
`pos1`…`pos4`, `uv1`…`uv4`, `nm` (`Vertex` = position, normal, texCoord: 8 floats). TODOs: load the normal map
(`LoadAssets`, after the diffuse map), the tangent/bitangent calculation (before the `vertices` array).

Pixels in the 800×600 client area from the top left; nothing depends on time. D3D12 cannot run here; every picture below
is the app's simulator's, and each matches the OpenGL project's Mesa screenshot (mean difference ≤ 0.14 per pixel, no
pixel differs by more than 8). The quad covers about 221,500 pixels (corners near (277,42), (682,187) and (57,435); the
bottom corner lies below the window). Named points (as OpenGL's): **background** (50,50) = 26,26,26 in every state;
brick faces (flat in the normal map): **highlight** (480,180), **brick-1** (300,250), **brick-2** (600,300), **brick-3**
(150,380); bevels: **bevel-up** (544,476) – a bevel facing up towards the light, **bevel-down** (303,388) – a bevel facing
down.

**Start picture:** flat bricks: the texture with its light mortar lines, lit evenly with a highlight in the upper right
of the quad: highlight = 229,125,101, brick-1 = 99,43,30, brick-2 = 125,55,39, brick-3 = 68,30,21, bevel-up = 82,36,25,
bevel-down = 94,46,34. Centre (400,300) = 143,124,115 (a mortar line).

## normal-map
- **Task:** Load the normal map (CBV/SRV heap slot 2, register t1) and use its value as the normal: sample it, map the 0..1 colour to a -1..1 vector, normalise – used directly as if it were a world-space normal (learnopengl's first attempt).
- **Hint:** `ComPtr<ID3D12Resource> m_normalMap;`, `LoadTexture("brickwall_normal.png", m_normalMap, normalMapUploadHeap, 2);` – the heap needs 3 descriptors and the SRV range of root parameter 2 two (t0, t1): `ranges[1].Init(D3D12_DESCRIPTOR_RANGE_TYPE_SRV, 2, 0)`; the table already starts at slot 1, so t1 is slot 2. In `normal_mapping.hlsl`: `Texture2D normalMap : register(t1);`, then `float3 normal = normalMap.Sample(wrapSampler, input.texCoords).rgb; normal = normalize(normal * 2.0f - 1.0f);`.
- **When done:** `main.cpp`: member `m_normalMap`, `cbvSrvHeapDesc.NumDescriptors = 3`, `ranges[1].Init(
  D3D12_DESCRIPTOR_RANGE_TYPE_SRV, 2, 0)`, `LoadTexture("brickwall_normal.png", m_normalMap, normalMapUploadHeap, 2);`.
  `normal_mapping.hlsl`: `Texture2D normalMap : register(t1);`, `normalMap.Sample(wrapSampler, input.texCoords).rgb` and
  `normalize(normal * 2.0f - 1.0f)` (instead of `normalize(input.normal)`). **The bricks get bumps, but lit wrongly:**
  the map's normals point along +z (the quad's direction *before* the rotation), so the whole quad is darker, most of
  all its lower left, and the bevels do not match the light: highlight = 162,78,58, brick-1 = 59,25,18, brick-2 =
  75,32,23, brick-3 = 24,11,7, bevel-up = 26,11,8 (dark although it faces the light), bevel-down = 18,9,7; centre
  (400,300) = 20,17,15. (No y flip here: used as a world-space normal, the map's y is the wall's up.)

## tangents
- **Task:** Calculate the tangent and bitangent of both triangles on the CPU from their edges and texture coordinate differences, and pass them as two more vertex attributes (`TANGENT` and `BINORMAL`).
- **Hint:** For a triangle with `edge1 = pos2 - pos1`, `edge2 = pos3 - pos1`, `deltaUV1 = uv2 - uv1`, `deltaUV2 = uv3 - uv1` (`XMFLOAT3` / `XMFLOAT2` have no operators: write the components, e.g. `XMFLOAT3 edge1(pos2.x - pos1.x, pos2.y - pos1.y, pos2.z - pos1.z);`): `f = 1.0f / (deltaUV1.x * deltaUV2.y - deltaUV2.x * deltaUV1.y)`, `tangent1.x = f * (deltaUV2.y * edge1.x - deltaUV1.y * edge2.x)` (and y, z), `bitangent1.x = f * (-deltaUV2.x * edge1.x + deltaUV1.x * edge2.x)` (and y, z). The second triangle uses pos1, pos3, pos4. `Vertex` gets `XMFLOAT3 tangent; XMFLOAT3 bitangent;` (14 floats), the input layout `{ "TANGENT", 0, DXGI_FORMAT_R32G32B32_FLOAT, 0, 32, … }` and `{ "BINORMAL", 0, DXGI_FORMAT_R32G32B32_FLOAT, 0, 44, … }` (BINORMAL is HLSL's name for the bitangent), `VSMain` the parameters `float3 tangent : TANGENT, float3 bitangent : BINORMAL`.
- **When done:** `main.cpp`: `Vertex` with `tangent` and `bitangent`; learnopengl's tangent/bitangent block
  (`tangent1`, `bitangent1`, `tangent2`, `bitangent2`, `edge1`, `edge2`, `deltaUV1`, `deltaUV2`, `f`) before the
  `vertices` array, whose six vertices are `{ posN, nm, uvN, tangentK, bitangentK }`; the input layout's `TANGENT`
  (offset 32) and `BINORMAL` (offset 44) elements. `normal_mapping.hlsl`: `VSMain(…, float3 tangent : TANGENT, float3
  bitangent : BINORMAL)`. **No visible change** (the shaders do not use them yet): the picture is identical to
  `normal-map`. For this quad both triangles get tangent (2, 0, 0) and bitangent (0, -2, 0) (the quad is 2 units wide
  for one texture: learnopengl's are (2, 0, 0) / (0, 2, 0) with its v up; the shader normalises them).

## tbn
- **Task:** Build the TBN matrix in the vertex shader (tangent, bitangent and normal transformed with the normal matrix) and use it to bring the light position, the view position and the fragment position into tangent space; the pixel shader lights with those, so the normal map's normals are used in the space they were made in – with their y flipped for Direct3D's v.
- **Hint:** `float3 T = normalize(mul(float4(tangent, 0.0f), normalMatrix).xyz);` (and `B` from `bitangent`, `N` from `normal`), `float3x3 TBN = float3x3(T, B, N);` – HLSL's `float3x3(a, b, c)` takes **rows**, GLSL's `mat3(a, b, c)` columns: these rows are already learnopengl's `transpose(mat3(T, B, N))`, the world → tangent space matrix – then `result.tangentLightPos = mul(TBN, lightPos);` (and `tangentViewPos`, `tangentFragPos = mul(TBN, result.fragPos)`). `PSInput`: `tangentLightPos`, `tangentViewPos`, `tangentFragPos` (`TEXCOORD1`…`3`) instead of `normal`. In `PSMain`: `normal.y = -normal.y;` after the normalisation (see "Direct3D's v and the bitangent" above), `lightDir = normalize(input.tangentLightPos - input.tangentFragPos)`, `viewDir = normalize(input.tangentViewPos - input.tangentFragPos)`.
- **When done:** `normal_mapping.hlsl`: `PSInput` is `position`, `fragPos`, `texCoords`, `tangentLightPos`,
  `tangentViewPos`, `tangentFragPos` (no `normal`); `VSMain` computes `T`, `B`, `N`, `float3x3 TBN = float3x3(T, B, N)`
  and the three `mul(TBN, …)`; `PSMain` has `normal.y = -normal.y;` and its `lightDir` / `viewDir` use the tangent-space
  positions. **The bricks' bumps are lit correctly:** the faces look as in the start, the bevels facing the light are
  bright, those facing away dark: highlight = 229,126,101, brick-1 = 99,43,30, brick-2 = 125,55,39, brick-3 = 68,30,21
  (≈ the start: the faces are flat in the map), bevel-up = 107,48,34 (brighter than the start's 82,36,25), bevel-down =
  18,9,7 (in its own shade); centre (400,300) = 20,17,15.

## gram-schmidt
- **Task:** Re-orthogonalise the TBN vectors in the vertex shader (Gram-Schmidt): make T perpendicular to N again and compute B as a cross product of T and N, instead of reading the bitangent attribute.
- **Hint:** `float3 T = normalize(mul(float4(tangent, 0.0f), normalMatrix).xyz); float3 N = normalize(mul(float4(normal, 0.0f), normalMatrix).xyz); T = normalize(T - dot(T, N) * N); float3 B = cross(T, N);` – `cross(T, N)` points down the image like Direct3D's bitangent (learnopengl's `cross(N, T)` points up, with its v; with `cross(N, T)` here the y flip of the normal would be wrong). On meshes with smooth (averaged) normals and tangents, T and N are no longer exactly perpendicular; this keeps the TBN matrix orthonormal, so its transpose is its inverse.
- **When done:** `normal_mapping.hlsl` `VSMain`: `T = normalize(T - dot(T, N) * N);` and `float3 B = cross(T, N);` (the
  line reading `bitangent` removed; the attribute stays in the vertex data like learnopengl's). **No visible change:**
  on this flat quad T, B and N are already perpendicular and `cross(T, N)` equals the normalised bitangent – the
  picture is identical to `tbn` (named points as there). This is the solution (learnopengl's `4.normal_mapping.vs/.fs`,
  ported).

**Simulator:** every state matches the OpenGL project's screenshots (see above); no mismatch found.
