# Area Lights – tasks (DirectX 12)

learnopengl "Guest Articles / Area Lights": `src/8.guest/2022/7.area_lights/1.area_light/area_lights.cpp` with
`7.area_light.vs/.fs` and `7.light_plane.vs/.fs`, then `2.multiple_area_lights/multiple_area_lights.cpp` with
`7.multi_area_light.fs` (the last task), and `ltc_matrix.hpp`, in Direct3D 12. Files: `main.cpp`, `area_light.hlsl`
(the floor's LTC shading: `VSMain` / `PSMain`), `light_plane.hlsl` (the light's rectangle in one colour),
`ltc_matrix.hpp` (the LTC tables, unchanged from `src/GP/content/textures/ltc/` – its licence and the paper's reference
are at its top) and `wood.png`.

**Screenshot time: 1.0 s** (nothing moves).

**Fixed choices (the same in every API – see the OpenGL tasks.md):** the LTC tables LTC1 / LTC2 (64 × 64 × RGBA floats,
from Heitz et al.'s `ltc_code`), as float textures with nearest minification, linear magnification and clamping, LTC1
first, LTC2 second, the floor's texture third; row 0 of each table is texture row 0 (v = 0) – no flip, the tables are not
images; learnopengl's floor (±10 at y = 0, texture coordinates 0…1) with `wood.png` as an **sRGB** texture; the light's
rectangle (x = -8, y 0.4…2.4, z -1…1, facing +x; its corners = vertices 0, 1, 4, 5), colour **BurlyWood (0.870588,
0.721569, 0.529412)**, intensity **4**, two-sided, roughness **0.5** (`SLATE_GRAY` and `ROUGHNESS`: the material's
colour is not used by the shader), `mSpecular = ToLinear(0.23)`, output `ToSRGB` (pow 1/2.2); the camera globals at
**(0, 1, 0.5), yaw 180, pitch 0** (front (-1, 0, 0)), fov 45, 800/600, near 0.1, far 100; clear (0, 0, 0), depth test on,
no culling. The last task: **eight lights** on a ring (`struct AreaLight { offset, yRotation, color, intensity = 2,
twoSided = true }`, rotation 45° · i about y, the course's colour table) and learnopengl's multi-light camera
**(-0.224556, 10.4038, -18.9259), yaw 89.3999, pitch -34.3001** (`cameraFront = (0.00865, -0.56356, 0.82605)`).

**Direct3D 12's choices:**
- **Textures** through one helper, `CreateTexture(pixels, width, height, format, rowPitch, texture, uploadHeap,
  descriptorIndex)` (default heap, upload heap, `UpdateSubresources`, barrier to `PIXEL_SHADER_RESOURCE`, the SRV in the
  given heap slot), used by `LoadTexture(path, gammaCorrection, …)` (learnopengl's `loadTexture`: stb_image RGBA,
  `DXGI_FORMAT_R8G8B8A8_UNORM_SRGB` with gamma correction – sampling returns linear colours, OpenGL's `GL_SRGB`) and, from
  `ltc-textures` on, `LoadLTCTexture(table, …)` (learnopengl's `loadMTexture` / `loadLUTTexture` in one function: the
  table straight from the header, `DXGI_FORMAT_R32G32B32A32_FLOAT`, `RowPitch = 64 * 4 * sizeof(float)`).
  `struct LTC_matrices { ComPtr<ID3D12Resource> mat1, mat2; }` keeps learnopengl's name (`m_LTC`). One mip level (the
  course's Direct3D 12 textures have no mipmaps: the far floor may shimmer a little more than OpenGL's).
- **Heap and root signature**: CBV/SRV heap slot 0 = the constant buffer, 1 = LTC1, 2 = LTC2, 3 = the wood. Root
  parameter 0 = 20 root constants at b0 (`ObjectConstants { XMFLOAT4X4 model; XMFLOAT4 lightColor; }`: per draw – the
  floor's model matrix, and each rectangle's model matrix and colour), parameter 1 = the CBV table at b1, parameter 2 =
  one table of three SRVs t0, t1, t2 (OpenGL's texture units 0, 1, 2). Static samplers: s0 for the tables
  (`D3D12_FILTER_MIN_POINT_MAG_LINEAR_MIP_POINT`, `CLAMP` – learnopengl's `GL_NEAREST` / `GL_LINEAR`), s1 for the wood
  (linear, `WRAP`). In the start the table already spans t0…t2 but the shader reads only t2 (a root signature 1.0 table
  may hold descriptors the shaders never read).
- **The light in the constant buffer** (`SceneConstantBuffer`, written every frame in `OnUpdate` – learnopengl sets the
  uniforms once; Direct3D 12 has no per-program uniforms, so the whole buffer is filled each frame): `view`, `projection`,
  `viewPosition`, `Material material` (`albedoRoughness`), `Light areaLight` (one light) / `Light areaLights[32]` with
  `int numAreaLights` (the last task). **HLSL packing**: in `struct Light { float intensity; float3 color; float4
  points[4]; bool twoSided; }` intensity and color share one 16-byte row; every element of a cbuffer array starts a new
  16-byte row, so the corners are `float4`s (w unused, `.xyz` in the shader – GLSL's `vec3 points[4]`) and the C++ struct
  is `XMFLOAT4 points[4]`; `bool` is 4 bytes in a cbuffer (`BOOL` in C++), and the C++ struct is padded to 96 bytes (a
  struct in a cbuffer array takes whole rows). `numAreaLights` sits right after `viewPosition` (it fills that row's last
  4 bytes – C++ `int numAreaLights` where the one-light version has a `float padding`).
- **The shader's matrices**: GLSL's `mat3(a, b, c)` takes **columns**, HLSL's `float3x3(a, b, c)` **rows**: learnopengl's
  `Minv = mat3(vec3(t1.x, 0, t1.y), vec3(0, 1, 0), vec3(t1.z, 0, t1.w))` is `float3x3(float3(t1.x, 0, t1.z), float3(0, 1,
  0), float3(t1.y, 0, t1.w))`, and `transpose(mat3(T1, T2, N))` is simply `float3x3(T1, T2, N)`; `Minv * v` is
  `mul(Minv, v)` (a column vector on the right, as in GLSL). The normal: `mul(aNormal, (float3x3)model)` – the model
  matrix's upper 3 × 3 part (learnopengl passes `mat3(model)` as the normal matrix; right while there is no non-uniform
  scale). `inversesqrt` → `rsqrt`, `clamp(x, 0, 1)` → `saturate`, `texture` → `Sample`.
- **Multiple lights**: learnopengl's multi-light shader renames `struct Light` to `AreaLight`; here the shader's struct
  stays **`Light`**, because `AreaLight` is the C++ struct that places the lights (learnopengl's) and the constant
  buffer's C++ mirror must have the shader's type name. Each light's model matrix `XMMatrixRotationY(yRotation) *
  XMMatrixTranslation(offset)` (learnopengl's `translate * rotate`, in DirectXMath's row-vector order;
  `XMMatrixRotationY` turns the same way as `glm::rotate` about +y) moves the base rectangle's corners
  (`XMVector3Transform`) in `OnUpdate` and the rectangle itself in `PopulateCommandList` (one draw per light with its
  matrix and colour as root constants).

**What the camera sees (one light)** (OpenGL's picture, Mesa): the light's rectangle a little right of the middle, above
the horizon (x 355…535, y 173…353, BurlyWood), the floor below the horizon (its far edge at y ≈ 372), black above. Named
points: **light** (400,263), **under** (400,380), **glossy** (400,420), **near** (400,560), **left** (60,560), **right**
(740,470), **sky** (400,100).

**Start picture**: the floor's shader writes black (no light yet), only the light's rectangle shows: light =
222,184,135, all the other points 0,0,0.

## `ltc-textures`
- **Task:** Make the two LTC lookup tables of `ltc_matrix.hpp` into 64 × 64 float textures – `LTC1` (the inverse matrices) in heap slot 1 (t0) and `LTC2` (the BRDF's magnitude, Fresnel and the horizon-clipping sphere) in slot 2 (t1) – with a function `LoadLTCTexture` and the struct `LTC_matrices` that holds them.
- **Hint:** `#include "ltc_matrix.hpp"`; `CreateTexture(table, 64, 64, DXGI_FORMAT_R32G32B32A32_FLOAT, 64 * 4 * sizeof(float), texture, uploadHeap, descriptorIndex);` – a float format: the numbers are outside 0…1. In `LoadAssets`: `LoadLTCTexture(LTC1, m_LTC.mat1, ltcMat1UploadHeap, 1); LoadLTCTexture(LTC2, m_LTC.mat2, ltcMat2UploadHeap, 2);` – the upload heaps must live until the setup command list has run (the end of `LoadAssets`).
- **When done:** `main.cpp`: `#include "ltc_matrix.hpp"`, `struct LTC_matrices { ComPtr<ID3D12Resource> mat1; …
  mat2; };`, the member `LTC_matrices m_LTC;`, `LoadLTCTexture` (declared and defined), `ltcMat1UploadHeap` /
  `ltcMat2UploadHeap` and the two calls. The shader does not use them yet: **no visible change**.

## `diffuse`
- **Task:** Light the floor with the light's diffuse part: in the pixel shader declare the tables (`LTC1` at t0, `LTC2` at t1, sampler s0), add learnopengl's `IntegrateEdgeVec` (the edge integral with the fitted acos) and `LTC_Evaluate` (rotate the light's corners into a frame around the normal, transform them by a matrix, normalise them, sum the four edge integrals, and take the form factor of the polygon – clipped at the horizon with the sphere value from `LTC2.w`; zero behind a one-sided light), and call it with the identity matrix – the plain cosine distribution, i.e. Lambert's diffuse light. The floor's colour is the texture times the light's colour, intensity and that integral.
- **Hint:** `static const float LUT_SIZE = 64.0f; LUT_SCALE = (LUT_SIZE - 1.0f) / LUT_SIZE; LUT_BIAS = 0.5f / LUT_SIZE;` (sample at texel centres). In `LTC_Evaluate`: `T1 = normalize(V - N * dot(V, N)); T2 = cross(N, T1); Minv = mul(Minv, float3x3(T1, T2, N));` (HLSL's rows T1, T2, N = GLSL's `transpose(mat3(T1, T2, N))`), `L[0] = mul(Minv, points[0].xyz - P);` …, `float scale = LTC2.Sample(ltcSampler, uv).w;`. In `PSMain`: `float3 diffuse = LTC_Evaluate(N, V, P, identity, areaLight.points, areaLight.twoSided); result = areaLight.color * areaLight.intensity * (mDiffuse * diffuse);` with `float3x3 identity`.
- **When done:** `area_light.hlsl`: `Texture2D LTC1 : register(t0);`, `Texture2D LTC2 : register(t1);`, `SamplerState
  ltcSampler : register(s0);`, the three constants, `IntegrateEdgeVec`, `LTC_Evaluate`, the diffuse term. **The floor
  lights up** in the light's warm colour, brightest just in front of the light, fading towards the camera (wood boards
  visible): light = 222,184,135, under = 137,86,47, glossy = 94,59,32, near = 40,25,14, left = 38,24,13, right =
  47,30,16, sky = 0,0,0 (OpenGL's values).

## `specular`
- **Task:** Add the light's glossy reflection: look the inverse LTC matrix up in `LTC1` by the roughness and the view angle (`sqrt(1 - dot(N, V))`), build `Minv` from its four numbers, evaluate the polygon with it, scale that by the Fresnel and shadowing terms from `LTC2` (`mSpecular * t2.x + (1 - mSpecular) * t2.y`), and add it to the diffuse part.
- **Hint:** `float2 uv = float2(material.albedoRoughness.w, sqrt(1.0f - dotNV)); uv = uv * LUT_SCALE + LUT_BIAS; float4 t1 = LTC1.Sample(ltcSampler, uv); float4 t2 = LTC2.Sample(ltcSampler, uv);`, `float3x3 Minv = float3x3(float3(t1.x, 0.0f, t1.z), float3(0.0f, 1.0f, 0.0f), float3(t1.y, 0.0f, t1.w));` (rows – GLSL's columns `vec3(t1.x, 0, t1.y)`, …), then `result = areaLight.color * areaLight.intensity * (specular + mDiffuse * diffuse);`.
- **When done:** `area_light.hlsl`: `uv`, `t1`, `t2`, `Minv`, `float3 specular = LTC_Evaluate(N, V, P, Minv, …)`, the
  Fresnel line, the sum. **A soft, stretched reflection of the light** appears on the floor between the light and the
  camera (roughness 0.5: blurred, whitish): light = 222,184,135, under = 139,89,51, glossy = 167,141,117, near =
  81,70,59, left = 39,25,15, right = 49,32,19, sky = 0,0,0.

## `multiple-lights`
- **Task:** learnopengl's second demo: eight area lights. Describe each light by a struct (offset, rotation about y, colour, intensity 2, two-sided); in `OnUpdate` compute each one's four corners with its model matrix (rotation about y, then the offset) and put them, its colour, intensity and sides into `areaLights[i]` of the constant buffer, with `numAreaLights`; in the shader loop over the lights and add up their diffuse and specular parts; draw every light's rectangle in its colour; and move the camera up and back to see the whole ring.
- **Hint:** C++: `struct AreaLight { XMFLOAT3 offset; float yRotation; XMFLOAT3 color; float intensity = 2.0f; bool twoSided = true; };`, `const int NUM_AREA_LIGHTS = 8;` and the table with `XMConvertToRadians(45.0f * i)`; `XMMATRIX model = XMMatrixRotationY(areaLights[i].yRotation) * XMMatrixTranslation(…offset…);`, `XMStoreFloat4(&constantBufferData.areaLights[i].points[0], XMVector3Transform(XMLoadFloat3(&areaLightVertices[0].position), model));` … (vertices 0, 1, 4, 5); the cbuffer gets `int numAreaLights;` after `viewPosition` and `Light areaLights[32];` (C++ and HLSL). HLSL: `for (int i = 0; i < numAreaLights; i++) { … result += areaLights[i].color * areaLights[i].intensity * (specular + mDiffuse * diffuse); }` (`uv`, `t1`, `t2`, `Minv` stay outside the loop). The camera: (-0.224556, 10.4038, -18.9259), front (0.00865, -0.56356, 0.82605), yaw 89.3999, pitch -34.3001.
- **When done:** `area_light.hlsl`: `int numAreaLights;`, `Light areaLights[32];`, the loop. `main.cpp`: `struct
  AreaLight`, `NUM_AREA_LIGHTS = 8`, `areaLights[]` (no `LIGHT_COLOR` / `LIGHT_INTENSITY` any more), the C++
  `SceneConstantBuffer` with `int numAreaLights` and `Light areaLights[32]`, the loop in `OnUpdate`, the rectangles'
  loop in `PopulateCommandList` (model matrix and colour as root constants, one `DrawInstanced(6, 1, 0, 0)` each), the
  new camera values. **A ring of eight coloured lights** stands on the floor seen from above and behind, each lighting
  the boards in front of it in its colour, with glossy reflections between the lights and the camera. Named points
  (OpenGL's): **light-2** (400,90), **light-6** (395,360), **light-0** (680,190), **light-4** (118,190), **centre**
  (470,260), **front** (400,450), **floor-left** (60,340), **floor-right** (740,340), **below** (400,550), **top**
  (400,20): light-2 = 140,255,89, light-6 = 204,102,255, light-0 = 255,140,64, light-4 = 76,191,255, centre = 47,30,19,
  front = 119,67,80, floor-left = 41,30,26, floor-right = 61,29,22, below = 0,0,0, top = 0,0,0. This is the solution.

*Simulator:* every state matches Mesa's OpenGL picture of the same step (the LTC tables from `ltc_matrix.hpp`, the
eight lights' corners in the constant buffer): `diffuse` and `specular` within 1 % of the pixels (differences of a few
grey levels), `multiple-lights` 1.1 %.
