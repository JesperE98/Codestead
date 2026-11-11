# Cascaded Shadow Mapping – tasks (DirectX 12)

learnopengl "Guest Articles / Cascaded Shadow Mapping": `src/8.guest/2021/2.csm/shadow_mapping.cpp` with its
`10.shadow_mapping`, `10.shadow_mapping_depth` (with the geometry shader) and `10.debug_quad` shaders, written on top of
the course's Direct3D 12 `shadow-mapping` chapter. Files: `main.cpp`, `wood.png`, `shadow_mapping.hlsl` (the scene's
lighting; the cascades and `ShadowCalculation` are TODOs), `shadow_mapping_depth.hlsl` (the depth pass: `VSMain` and a
pass-through `GSMain` in the start), `debug_quad.hlsl` (shows one layer of the shadow maps; complete in the start, used
from `depth-maps` on). The visualisation of the cascade volumes (learnopengl's `drawCascadeVolumeVisualizers`, key C)
is described in the text, not a task.

**Screenshot time: 1.0 s** (nothing moves; the light-space matrices are recomputed every frame in `OnUpdate`, so they
would follow a moving camera).

**Fixed choices (the same in every API – see the OpenGL tasks.md):**
- Scene: learnopengl's floor (±25 at **y = -2**, normals up, the wood repeated 25 times, v flipped for Direct3D) and the
  **ten cubes** at the course's fixed placements (globals `cubePositions[]`, `cubeAngles[]`, `cubeScales[]`; model =
  `XMMatrixScaling(s) * XMMatrixRotationAxis(normalize(1, 0, 1), angle) * XMMatrixTranslation(position)` – learnopengl's
  translate · rotate · scale in row-vector order), drawn by `RenderScene()` (floor, then the cubes), which both passes call.
- Camera (globals): `cameraPos = (0, 3, 17)`, `cameraFront = (0, -0.25882, -0.96593)` (yaw -90, pitch -15), fov 45,
  800/600, `cameraNearPlane = 0.1f`, `cameraFarPlane = 500.0f` (`XMMatrixLookAtRH` / `XMMatrixPerspectiveFovRH`). Clear
  (0.1, 0.1, 0.1).
- Light: `const XMVECTOR lightDir = XMVector3Normalize(XMVectorSet(20.0f, 50.0f, 20.0f, 0.0f));` (the direction towards
  the light), Blinn-Phong with light colour 0.3, exponent 64, ambient `0.3 * lightColor` (the Shadow Mapping chapter's).
- Cascades: `std::vector<float> shadowCascadeLevels{ cameraFarPlane / 50.0f, … / 25.0f, … / 10.0f, … / 2.0f }` = 10,
  20, 50, 250 → five cascades. `getFrustumCornersWorldSpace(projview)` (a free function), `getLightSpaceMatrix(near,
  far)` and `getLightSpaceMatrices()` (`D3D12App` methods: they need `m_width` / `m_height` for the aspect ratio).
  **Two Direct3D differences** from learnopengl's maths: (1) the corners of clip space have **z = 0 and 1** (Direct3D's
  depth range; `XMVectorSet(2.0f * x - 1.0f, 2.0f * y - 1.0f, static_cast<float>(z), 1.0f)`), not -1 and 1 – with the
  perspective matrices of `XMMatrixPerspectiveFovRH` that puts the corners on the cascade's near and far planes, as
  learnopengl's do; (2) the light projection is `XMMatrixOrthographicOffCenterRH(minX, maxX, minY, maxY, minZ, maxZ)`:
  it maps the same light-space box to Direct3D's depth 0..1 exactly where `glm::ortho` maps it to -1..1 – so the depth
  stored in the shadow maps (Direct3D's z, OpenGL's window depth z · 0.5 + 0.5) is the same number in both APIs. Both
  points matter: with z from -1 the cascades' boxes would be wrong. DirectXMath values are kept in containers as storage
  types: `std::vector<XMFLOAT4>` corners, `std::vector<XMFLOAT4X4>` matrices (`XMVECTOR` in a `std::vector` is not
  portable and warns in GCC). `<windows.h>`'s `min`/`max` macros: `fminf`/`fmaxf` and `FLT_MAX` / `-FLT_MAX` instead of
  `std::min`/`max` and `numeric_limits`.
- The light-space matrices go into a **second constant buffer** (learnopengl's uniform block `LightSpaceMatrices`, 16
  `float4x4`, 1024 bytes): `struct LightSpaceMatrices { XMFLOAT4X4 lightSpaceMatrices[16]; }`, persistently mapped,
  filled (transposed) every frame in `OnUpdate`, its CBV in CBV/SRV heap slot 3 behind **root parameter 3** (a table
  with one CBV at b2, visible to all shaders: the depth pass's geometry shader and the scene's pixel shader read it).
  The cascades' distances are in the scene's constant buffer: `XMFLOAT4 cascadePlaneDistances[16]` (HLSL `float4
  cascadePlaneDistances[16]`, using `.x`: every element of a cbuffer array takes a whole 16-byte row), `float
  farPlane`, `int cascadeCount`.
- Shadow maps: **one texture array** `m_lightDepthMaps`, `R32_TYPELESS`, **1024 × 1024 × 5** (`DepthOrArraySize = 5`;
  learnopengl: 4096², the simulator draws on the CPU), a `D32_FLOAT` DSV with `D3D12_DSV_DIMENSION_TEXTURE2DARRAY`,
  `ArraySize = 5` (DSV heap slot 1), an `R32_FLOAT` SRV with `D3D12_SRV_DIMENSION_TEXTURE2DARRAY` (CBV/SRV heap slot 2,
  t1 next to the wood's t0), sampled with the static sampler s1 (point filtering, `D3D12_TEXTURE_ADDRESS_MODE_BORDER` with
  `D3D12_STATIC_BORDER_COLOR_OPAQUE_WHITE`). Barriers DEPTH_WRITE → PIXEL_SHADER_RESOURCE after the depth pass and back
  at the end of the frame.
- **One depth pass** (learnopengl's): the scene is drawn once with `m_depthPipelineState` (vertex shader: world
  position; geometry shader compiled with `gs_5_0`, `psoDesc.GS`; no pixel shader, no render target). The geometry
  shader uses **geometry shader instancing** – `[instance(5)]`, `uint invocation : SV_GSInstanceID` (GLSL's
  `layout(invocations = 5)` / `gl_InvocationID`) – and writes `SV_RenderTargetArrayIndex = invocation` (`gl_Layer`).
  One pass per cascade with a single-slice DSV each (`FirstArraySlice = i, ArraySize = 1`) and the cascade's matrix in
  root constants would work too, but draws the scene five times from the CPU – the geometry shader does the copies on
  the GPU, as the article does.
- Lookup: `CascadeLayer(fragPosWorldSpace)` (view-space depth `abs(mul(float4(fragPos, 1), view).z)`, learnopengl's
  loop), `mul(float4(fragPos, 1), lightSpaceMatrices[layer])`, `shadowUV = float2(x * 0.5 + 0.5, -y * 0.5 + 0.5)` (v
  points down in Direct3D), z as it is (0..1), no shadow beyond 1.0, the bias scaled by the cascade's far distance,
  `shadowMap.Sample(shadowSampler, float3(shadowUV, layer))`, the size from `GetDimensions(width, height, elements)`.
- Debug view: `bool showQuad`, `int debugLayer = 2` globals; `m_debugQuadPipelineState` draws vertices 42–47 with the
  layer as root constants (`DebugConstants { int layer; }`; root parameter 0 is visible to all shaders).

**What the camera sees** (the same as OpenGL's): named points **shadow-a** (490,475), **shadow-b** (290,273),
**shadow-c** (405,221), **shadow-d** (155,335), **lit-a** (650,470), **lit-b** (200,280), **lit-c** (480,230),
**cube-front** (400,370), **background** (400,40), **dbg-floor** (100,560). The values below are OpenGL's (Mesa); the
simulator shows this project's start exactly as it shows OpenGL's (shadow-a 59,40,25, shadow-b 65,44,27, cube-front
10,7,4 …).

**Start picture** (no shadows): shadow-a = 60,41,25, shadow-b = 61,42,26, shadow-c = 57,39,24, shadow-d = 53,37,22,
lit-a = 67,46,28, lit-b = 55,38,23, lit-c = 58,40,25, cube-front = 15,10,6, background = 26,26,26, dbg-floor = 18,13,8.

## `light-matrices`
- **Task:** Compute a light-space matrix for each of the five cascades every frame and put them into a constant buffer: the split distances `shadowCascadeLevels`, `getFrustumCornersWorldSpace` (the 8 corners of a frustum from the inverse of view · projection – z from 0 to 1 in Direct3D), `getLightSpaceMatrix(near, far)` (a light view looking at the corners' centre along the light direction, an orthographic box around the corners in light space, its depth range stretched by 10) and `getLightSpaceMatrices()`; the constant buffer (16 matrices, CBV in heap slot 3, root parameter 3 at b2).
- **Hint:** `XMMatrixInverse(nullptr, projview)`, `XMVector4Transform(XMVectorSet(2.0f * x - 1.0f, 2.0f * y - 1.0f, static_cast<float>(z), 1.0f), inv)`, divided by `XMVectorSplatW(pt)`. `XMMatrixLookAtRH(center + lightDir, center, up)`, `XMMatrixOrthographicOffCenterRH(minX, maxX, minY, maxY, minZ, maxZ)`, `lightView * lightProjection`. The root signature gets `ranges[2].Init(D3D12_DESCRIPTOR_RANGE_TYPE_CBV, 1, 2)` and `rootParameters[3]`; `PopulateCommandList` sets table 3 at heap slot 3.
- **When done:** `main.cpp`: `std::vector<float> shadowCascadeLevels{…}`, `std::vector<XMFLOAT4>
  getFrustumCornersWorldSpace(const XMMATRIX& projview)` (+ the `(proj, view)` overload), `struct LightSpaceMatrices`,
  `m_matricesBuffer` / `m_pMatricesDataBegin`, `XMFLOAT4X4 getLightSpaceMatrix(const float nearPlane, const float
  farPlane)` (`zMult = 10.0f`), `std::vector<XMFLOAT4X4> getLightSpaceMatrices()` (5 matrices), the third descriptor
  range and fourth root parameter, the upload-heap buffer with its CBV (slot 3, mapped), in `OnUpdate` `const
  std::vector<XMFLOAT4X4> lightMatrices = getLightSpaceMatrices();` and the transposed copy (`memcpy`), in
  `PopulateCommandList` `SetGraphicsRootDescriptorTable(3, matrices)`. Nothing uses them yet: **no visible change**.

## `depth-maps`
- **Task:** Create the shadow maps – a depth texture array of 1024 × 1024 × 5 layers (`R32_TYPELESS`) with a DSV of all layers and a `Texture2DArray` SRV – and render the scene's depth into all five layers in one pass: the geometry shader runs 5 times per triangle (`[instance(5)]`), transforms it with `lightSpaceMatrices[invocation]` and sends it to layer `invocation` (`SV_RenderTargetArrayIndex`). For now show layer 2 of the array on the debug quad instead of the scene.
- **Hint:** `CD3DX12_RESOURCE_DESC::Tex2D(DXGI_FORMAT_R32_TYPELESS, depthMapResolution, depthMapResolution, layers, 1, 1, 0, D3D12_RESOURCE_FLAG_ALLOW_DEPTH_STENCIL)` with `layers = shadowCascadeLevels.size() + 1`; `dsvDesc.ViewDimension = D3D12_DSV_DIMENSION_TEXTURE2DARRAY; dsvDesc.Texture2DArray.ArraySize = layers;`, `srvDesc.ViewDimension = D3D12_SRV_DIMENSION_TEXTURE2DARRAY`. The depth pass: `m_depthPipelineState` (VS + GS, `psoDesc.GS`), the shadow viewport, `OMSetRenderTargets(0, nullptr, FALSE, &shadowDsvHandle)`, clear, `RenderScene()`, the barrier. The debug view: `bool showQuad = true; int debugLayer = 2;`, `if (showQuad)` – `m_debugQuadPipelineState`, `DebugConstants`, `DrawInstanced(6, 1, 42, 0)`.
- **When done:** `main.cpp`: `showQuad = true` (for now), `debugLayer = 2`, `struct DebugConstants`, `m_lightDepthMaps`
  with its DSV (TEXTURE2DARRAY, ArraySize 5) and SRV (TEXTURE2DARRAY), the depth pass's and the debug quad's pipeline
  states (`D3DCompileFromFile(L"shadow_mapping_depth.hlsl", …, "GSMain", "gs_5_0", …)`), the `// 1.` depth pass in
  `PopulateCommandList`, the debug quad block after the scene, the barrier back to DEPTH_WRITE at the end.
  `shadow_mapping_depth.hlsl`: `cbuffer LightSpaceMatrices : register(b2)`, `[instance(5)]`, `[maxvertexcount(3)]`,
  `uint invocation : SV_GSInstanceID`, `mul(input[i].position, lightSpaceMatrices[invocation])`, `output.layer =
  invocation` (`SV_RenderTargetArrayIndex`). The window shows **layer 2 of the shadow maps** (the cascade 20..50 units
  from the camera, seen from the light): white in the top and the right, the floor's corner as a grey diamond (162..170)
  with its corners near (115,148) and (648,452), the cubes as faint darker patches: shadow-a = 165,165,165, shadow-b =
  170,170,170, shadow-c = 255,255,255, shadow-d = 166,166,166, lit-a = 255,255,255, lit-b = 170,170,170, lit-c =
  255,255,255, cube-front = 168,168,168, background = 255,255,255, dbg-floor = 162,162,162 (the light-space y points up
  in both APIs' debug views: the same picture).

## `cascade-layer`
- **Task:** Back to the scene (`showQuad = false`). Give the scene shader the cascades – `farPlane`, `cascadePlaneDistances[16]`, `cascadeCount` in the constant buffer (filled in `OnUpdate`) – and a function `CascadeLayer` that picks a fragment's cascade from its depth in view space: the first cascade whose far distance is beyond it, else the last. For now tint every fragment with its cascade's colour (red, green, blue, yellow, magenta).
- **Hint:** C++: `XMFLOAT3 lightDir; float farPlane; XMFLOAT4 cascadePlaneDistances[16]; int cascadeCount;` and `constantBufferData.cascadePlaneDistances[i].x = shadowCascadeLevels[i];` in a loop. HLSL: the same fields, `float depthValue = abs(mul(float4(fragPosWorldSpace, 1.0f), view).z);`, learnopengl's loop with `break`; `static const float3 cascadeColors[5]` and `lighting *= cascadeColors[CascadeLayer(input.fragPos)];`.
- **When done:** `main.cpp`: `bool showQuad = false;`, the new `SceneConstantBuffer` fields and their values.
  `shadow_mapping.hlsl`: `farPlane`, `cascadePlaneDistances`, `cascadeCount`, `int CascadeLayer(float3
  fragPosWorldSpace)`, the `cascadeColors` tint. The scene with **coloured bands**: the floor red near the camera
  (cascade 0, below y 481 at x = 400), green in the middle (y 267..480), blue at the back (y 195..266): shadow-a =
  24,41,10, shadow-b = 24,17,26, shadow-c = 23,16,24, shadow-d = 21,37,9, lit-a = 27,46,11, lit-b = 22,15,23, lit-c =
  23,16,25, cube-front = 6,10,3, background = 26,26,26, dbg-floor = 18,5,3 (the simulator: 24,40,10 / 26,18,27 /
  25,17,26 / 23,38,9 / 27,46,11 / 22,15,23 / 23,16,24 / 4,7,2 / 26,26,26 / 18,5,3).

## `shadows`
- **Task:** Shadows: the scene shader gets the shadow maps (`Texture2DArray shadowMap : register(t1)`, sampler s1) and the `LightSpaceMatrices` cbuffer (b2); `ShadowCalculation` transforms the fragment with its cascade's light-space matrix, maps x and y to texture coordinates (v flipped), returns 0 beyond the light's far plane, scales the bias by the cascade's far distance, and compares with one sample of that layer. Remove the debug tint.
- **Hint:** `float4 fragPosLightSpace = mul(float4(fragPosWorldSpace, 1.0f), lightSpaceMatrices[layer]);`, `projCoords = fragPosLightSpace.xyz / fragPosLightSpace.w`, `shadowUV = float2(projCoords.x * 0.5f + 0.5f, -projCoords.y * 0.5f + 0.5f)`, `bias *= 1.0f / (cascadePlaneDistances[layer].x * biasModifier)` (`farPlane` for the last cascade, `biasModifier = 0.5f`), `shadowMap.Sample(shadowSampler, float3(shadowUV, layer)).r`. The C++ side already binds everything (the table t0/t1, root parameter 3).
- **When done:** `shadow_mapping.hlsl`: `Texture2DArray shadowMap : register(t1);`, `SamplerState shadowSampler :
  register(s1);`, `cbuffer LightSpaceMatrices : register(b2)`, `float ShadowCalculation(float3 fragPosWorldSpace, float3
  normal)` (without PCF), `float shadow = ShadowCalculation(input.fragPos, normal);`, no tint. **The cubes cast shadows**
  onto the floor in all three cascades: shadow-a = 15,11,6, shadow-b = 16,11,7, shadow-c = 15,10,6, shadow-d = 14,9,6;
  lit-a = 67,46,28, lit-b = 55,38,23, lit-c = 58,40,25, cube-front = 15,10,6, background = 26,26,26, dbg-floor =
  18,13,8.

## `pcf`
- **Task:** Soften the shadow edges with percentage-closer filtering: average the comparison over the 3 × 3 texels around the position in the cascade's layer.
- **Hint:** `uint width, height, elements; shadowMap.GetDimensions(width, height, elements); float2 texelSize = 1.0f / float2(width, height);`, then two `for` loops from -1 to 1 with `shadowMap.Sample(shadowSampler, float3(shadowUV + float2(x, y) * texelSize, layer)).r` and `shadow /= 9.0f;`.
- **When done:** `shadow_mapping.hlsl`: the PCF loop in `ShadowCalculation`. The shadows' edges get a one-texel soft
  border; the named points keep their values: shadow-a = 15,11,6, shadow-b = 16,11,7, shadow-c = 15,10,6, shadow-d =
  14,9,6, lit-a = 67,46,28, lit-b = 55,38,23, lit-c = 58,40,25, cube-front = 15,10,6, background = 26,26,26, dbg-floor =
  18,13,8. This is the solution.

*Simulator:* the start, `light-matrices` and `cascade-layer` states match (the start pixel for pixel like the OpenGL
project's start in the simulator). The depth pass into the 5-slice array is not followed yet: in `depth-maps` the debug
quad shows 1.0 (white) for every layer, and `shadows` / `pcf` show no shadows – see the D3D12 writer's report.
