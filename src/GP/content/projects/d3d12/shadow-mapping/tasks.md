# Shadow Mapping – tasks (DirectX 12)

learnopengl.com "Shadow Mapping": `src/5.advanced_lighting/3.1.1.shadow_mapping_depth`, `3.1.2.shadow_mapping_base`,
`3.1.3.shadow_mapping`; the Direct3D 12 side follows Microsoft's D3D12Multithreading sample (its shadow map: an
`R32_TYPELESS` texture with a `D32_FLOAT` depth stencil view and an `R32_FLOAT` shader resource view, a pipeline state
without a pixel shader and without render targets, barriers DEPTH_WRITE ↔ PIXEL_SHADER_RESOURCE). Files: `main.cpp`,
`shadow_mapping.hlsl` (the scene's shaders), `shadow_mapping_depth.hlsl` (the depth pass: only `VSMain` – complete in the
start, not compiled yet), `debug_quad.hlsl` (shows the shadow map – complete in the start, not compiled yet), `wood.png`.

Scene (learnopengl's): one vertex buffer – the floor (vertices 0–5: ±25 at y = -0.5, normal up, texture coordinates up
to 25 with v flipped, the sampler's WRAP mode), learnopengl's `renderCube` cube (vertices 6–41: 2×2×2, normals, v
flipped) and, from `depth-map` on, the debug quad (42–47). The three cubes of learnopengl's `renderScene`: (0, 1.5, 0)
scale 0.5; (2, 0, 1) scale 0.5; (-1, 0, 2) rotated 60° about normalize(1, 0, 1), scale 0.25 – in DirectXMath's row-vector
order `XMMatrixScaling * XMMatrixRotationAxis * XMMatrixTranslation` – all wood. In `PopulateCommandList` four
`ModelConstants` (`floorConstants`, `cube1Constants` … : the model matrix and the normal matrix – transpose(inverse(model)),
which stored transposed for HLSL is `XMMatrixInverse(nullptr, model)`) are computed once and set with
`SetGraphicsRoot32BitConstants(0, …)` before each of the scene's four draws, in every pass. `lightPos` (-2, 4, -1). The
camera globals at (0, 0, 3) looking down -z (yaw -90, pitch 0, fov 45, 800/600, 0.1, 100), clear (0.1, 0.1, 0.1),
depth test on, no culling. `shadow_mapping.hlsl` `PSMain` is learnopengl's: light colour 0.3, ambient 0.3 × light colour,
diffuse, Blinn-Phong specular (64), `lighting = (ambient + (1.0f - shadow) * (diffuse + specular)) * color`.
Root signature: 0 = 32 root constants (`cbuffer ModelConstants : register(b0)`, vertex shaders), 1 = the CBV table
(`cbuffer SceneConstantBuffer : register(b1)`, all shaders), 2 = the SRV table (t0 the wood; from `depth-map` on two SRVs:
t0 the wood, t1 the shadow map – consecutive descriptors in heap slots 1 and 2, the table starts at slot 1); static
samplers s0 (wood: linear, WRAP) and, from `depth-map` on, s1 (shadow map: point).

Start: no shadows (`float shadow = 0.0f;` in `PSMain`), no shadow map, no light-space matrix. TODO comments: the depth
pass's and the debug quad's pipeline states and the quad's vertices (`LoadAssets`), the shadow map (`LoadAssets`), the
light's matrix (`OnUpdate`), pass 1 and the debug quad (`PopulateCommandList`), `ShadowCalculation` and its call
(`shadow_mapping.hlsl`).

**What the camera sees:** from (0, 0, 3) only the floating cube (0, 1.5, 0) is in view (top centre, seen from below),
plus the floor and the floating cube's shadow on it (lower right). The cubes at (2, 0, 1) and (-1, 0, 2) are just outside
the view, close to the camera on its left and right; their shadows fall outside the view too. They show in the depth map.

Pixels in the 800×600 client area from the top left; nothing depends on time. D3D12 cannot run here. The start picture is
the app's simulator's (it follows every state, the depth-only pass included); they match the OpenGL project's Mesa
screenshots within a few units at every named point. Named points (as OpenGL's): **background** (400,100) = 26,26,26;
**cube0-bottom** (400,50) ≈ 6,4,3 and (300,30) ≈ 15,11,6 (the floating cube's underside: ambient only); **floor-left**
(200,450) ≈ 62,42,26 and (330,520) ≈ 60,41,25 (lit, never in shadow); **shadow-1** (650,450), **shadow-2** (560,440),
**shadow-3** (700,480) – inside the floating cube's shadow; **floor-right** (750,560) ≈ 57,39,24 (lit, outside the shadow).

**Start picture:** the wood floor lit evenly (dim: light colour 0.3) and the cube's underside at the top: floor-left ≈
62,42,26 / 60,41,25, shadow-1 ≈ 58,39,24, shadow-2 ≈ 62,42,26, shadow-3 ≈ 61,42,26 (no shadow yet), floor-right ≈ 57,39,24,
cube0-bottom ≈ 6,4,3 / 15,11,6, background 26,26,26.

## depth-map
- **Task:** Create the shadow map – a 1024×1024 depth texture with a depth stencil view and a shader resource view – and its depth-only pipeline state; every frame draw the scene into it from the light (pass 1), then show it on a quad over the whole window with the debug quad's shaders.
- **Hint:** The texture is `CD3DX12_RESOURCE_DESC::Tex2D(DXGI_FORMAT_R32_TYPELESS, SHADOW_WIDTH, SHADOW_HEIGHT, 1, 1, 1, 0, D3D12_RESOURCE_FLAG_ALLOW_DEPTH_STENCIL)` – typeless, because the DSV sees it as `D32_FLOAT` and the SRV as `R32_FLOAT` (a resource with a depth format cannot have an SRV); clear value `D32_FLOAT`, depth 1.0; initial state `DEPTH_WRITE`. Its DSV goes to DSV heap slot 1 (the heap needs 2 descriptors and `m_dsvDescriptorSize`), its SRV to CBV/SRV slot 2 (3 descriptors), right after the wood's, and the root signature's SRV range grows to 2 (t0, t1); sampler s1 = s0 with `D3D12_FILTER_MIN_MAG_MIP_POINT` (learnopengl: `GL_NEAREST`, still WRAP like learnopengl's `GL_REPEAT` here). The depth pass's PSO: `shadow_mapping_depth.hlsl`'s `VSMain`, `psoDesc.PS = CD3DX12_SHADER_BYTECODE(nullptr, 0)` (no pixel shader: the rasterizer writes the depth – learnopengl's empty fragment shader), `NumRenderTargets = 0`, `RTVFormats[0] = DXGI_FORMAT_UNKNOWN`, `DSVFormat = D32_FLOAT`. The light: `XMMatrixOrthographicRH(20.0f, 20.0f, near_plane, far_plane)` (1.0, 7.5: the same box as learnopengl's symmetric `glm::ortho(-10, 10, -10, 10, …)`; `XMMatrixOrthographicOffCenterRH(-10.0f, 10.0f, -10.0f, 10.0f, …)` would be the literal translation) and `XMMatrixLookAtRH(lightPos, origin, up)`; with row vectors `lightSpaceMatrix = lightView * lightProjection`. Pass 1: `SetPipelineState(m_depthPipelineState)`, the shadow viewport/scissor (1024×1024), `OMSetRenderTargets(0, nullptr, FALSE, &shadowDsvHandle)` (no render target – learnopengl's `glDrawBuffer(GL_NONE)`), clear the depth to 1.0, the four draws, barrier DEPTH_WRITE → PIXEL_SHADER_RESOURCE; then back to `m_pipelineState` and the window's viewport; at the end of the frame the barrier back to DEPTH_WRITE.
- **When done:** `main.cpp`: `static const UINT SHADOW_WIDTH = 1024, SHADOW_HEIGHT = 1024;`; members `m_shadowViewport`,
  `m_shadowScissorRect` (set in the constructor), `m_depthPipelineState`, `m_debugQuadPipelineState`, `m_dsvDescriptorSize`,
  `m_shadowMap`; `XMFLOAT4X4 lightSpaceMatrix;` after `projection` in `SceneConstantBuffer` (and `float4x4
  lightSpaceMatrix;` after `projection` in `shadow_mapping.hlsl`'s cbuffer, so both layouts stay the same);
  `dsvHeapDesc.NumDescriptors = 2`, `cbvSrvHeapDesc.NumDescriptors = 3`, `m_dsvDescriptorSize =
  GetDescriptorHandleIncrementSize(D3D12_DESCRIPTOR_HEAP_TYPE_DSV)`; `ranges[1].Init(D3D12_DESCRIPTOR_RANGE_TYPE_SRV, 2,
  0)`; `samplers[2]` with `samplers[1] = samplers[0]; samplers[1].Filter = D3D12_FILTER_MIN_MAG_MIP_POINT;
  samplers[1].ShaderRegister = 1;`; the two PSOs (`D3DCompileFromFile(L"shadow_mapping_depth.hlsl", …, "VSMain", "vs_5_0",
  …)` → `m_depthPipelineState` with `PS = CD3DX12_SHADER_BYTECODE(nullptr, 0)`, `NumRenderTargets = 0`, `RTVFormats[0] =
  DXGI_FORMAT_UNKNOWN`; `debug_quad.hlsl` `VSMain`/`PSMain` → `m_debugQuadPipelineState` with `NumRenderTargets = 1`,
  `RTVFormats[0] = R8G8B8A8_UNORM`, `DepthStencilState.DepthEnable = FALSE`); the 6 quad vertices; the shadow map block
  (`R32_TYPELESS`, `ALLOW_DEPTH_STENCIL`, clear value `D32_FLOAT` 1.0, `D3D12_RESOURCE_STATE_DEPTH_WRITE`,
  `CreateDepthStencilView` with `D32_FLOAT` at DSV slot 1, `CreateShaderResourceView` with `R32_FLOAT` /
  `D3D12_SRV_DIMENSION_TEXTURE2D` at CBV/SRV slot 2); `OnUpdate`: `near_plane = 1.0f, far_plane = 7.5f`,
  `XMMatrixOrthographicRH(20.0f, 20.0f, near_plane, far_plane)`, `XMMatrixLookAtRH(XMLoadFloat3(&lightPos), XMVectorSet(0,
  0, 0, 0), XMVectorSet(0, 1, 0, 0))`, `lightSpaceMatrix = lightView * lightProjection`, stored transposed;
  `PopulateCommandList`: pass 1 as in the hint (before the window's pass), after the scene's draws in the window
  `SetPipelineState(m_debugQuadPipelineState.Get())` + `DrawInstanced(6, 1, 42, 0)` (the quad reads `Texture2D depthMap :
  register(t1)` through the same table), and after the back buffer's RENDER_TARGET → PRESENT barrier the shadow map's
  PIXEL_SHADER_RESOURCE → DEPTH_WRITE barrier.
  The window shows the **depth map** (grey, the 1024×1024 map stretched to 800×600; it is upright: the shadow map's row 0
  is the light's NDC y = +1 and the quad shows v = 0 at the top): the floor as a vertical gradient – white at the top
  (beyond the far plane nothing was drawn and the cleared 1.0 stays) (400,100) = 255,255,255, mid grey (200,300) ≈
  163,163,163, dark towards the bottom (400,450) ≈ 53,53,53, (400,505) ≈ 13,13,13, then white again (400,560) =
  255,255,255 (in front of the near plane: clipped). The cubes: the floating cube **dark** (closest to the light)
  (398,275) ≈ 69,69,69; the cube at (2, 0, 1) lighter than the floor around it (400,230) ≈ 169,169,169 (floor next to it
  (330,230) ≈ 214,214,214); the small rotated cube (488,300) ≈ 129,129,129. r = g = b everywhere.

## shadows
- **Task:** Draw the scene with shadows (learnopengl 3.1.2): pass the fragment's position in light space from the vertex shader, read the shadow map (t1, sampler s1) in the pixel shader with a `ShadowCalculation` that compares the fragment's depth with the shadow map's, and stop drawing the debug quad.
- **Hint:** `PSInput` gets `float4 fragPosLightSpace : TEXCOORD1;`, `VSMain` sets `result.fragPosLightSpace = mul(worldPos, lightSpaceMatrix);`. In `ShadowCalculation`: `float3 projCoords = fragPosLightSpace.xyz / fragPosLightSpace.w;` then **only x and y** go to texture coordinates, and y is flipped: `float2 shadowUV = float2(projCoords.x * 0.5f + 0.5f, -projCoords.y * 0.5f + 0.5f);` – Direct3D's v = 0 is the top row (NDC y = +1), and its depth is already 0..1 (learnopengl's `projCoords * 0.5 + 0.5` maps z too, because OpenGL's NDC z is -1..1). `float closestDepth = shadowMap.Sample(shadowSampler, shadowUV).r; float currentDepth = projCoords.z;` and `shadow = currentDepth > closestDepth ? 1.0f : 0.0f`. In `main.cpp` comment out the two debug quad lines.
- **When done:** `shadow_mapping.hlsl`: `Texture2D shadowMap : register(t1);`, `SamplerState shadowSampler : register(s1);`,
  `float4 fragPosLightSpace : TEXCOORD1;` in `PSInput`, `result.fragPosLightSpace = mul(worldPos, lightSpaceMatrix);`,
  `float ShadowCalculation(float4 fragPosLightSpace)` (perspective divide, `shadowUV` with `-projCoords.y`, `closestDepth`
  from `shadowMap.Sample(shadowSampler, shadowUV).r`, `currentDepth = projCoords.z`, `currentDepth > closestDepth ? 1.0f :
  0.0f`) and `float shadow = ShadowCalculation(input.fragPosLightSpace);` in `PSMain`; `main.cpp`: `//
  m_commandList->SetPipelineState(m_debugQuadPipelineState.Get());` and `// m_commandList->DrawInstanced(6, 1, 42, 0);`
  (commented out, like learnopengl's `//renderQuad();`). The scene is back with the floating cube's **shadow** (lower
  right) and **shadow acne**: fine dark stripes (moiré rings) all over the lit floor. shadow-1 (650,450) ≈ 16,11,6,
  shadow-2 (560,440) ≈ 16,11,7, shadow-3 (700,480) ≈ 17,11,7 (ambient only); acne: (330,520) ≈ 16,11,7 (on a stripe),
  (200,450) ≈ 62,42,26 and floor-right (750,560) ≈ 57,39,24 happen to be lit – check the stripes as a region: in x 0..330,
  y 340..600 the mean luminance drops to ≈ 28 (start ≈ 44) and ≈ 45,000 pixels are darker than 20 (start ≈ 3,900: the
  wood's seams). Cube underside and background unchanged.

## bias
- **Task:** Remove the shadow acne with a bias that depends on the surface's slope towards the light: `max(0.05f * (1.0f - dot(normal, lightDir)), 0.005f)`, subtracted from the fragment's depth before the comparison.
- **Hint:** Give `ShadowCalculation` the normal and the light direction – `float ShadowCalculation(float4 fragPosLightSpace, float3 normal, float3 lightDir)`, called as `ShadowCalculation(input.fragPosLightSpace, normal, lightDir)` (HLSL has no globals for the inputs; learnopengl recomputes them from `fs_in`). Then `float bias = max(0.05f * (1.0f - dot(normal, lightDir)), 0.005f);` and `currentDepth - bias > closestDepth`. The depth is linear 0..1 between near and far in both APIs, so learnopengl's bias values fit unchanged. (Direct3D can also bias in the rasterizer: the depth pass PSO's `RasterizerState.DepthBias` / `SlopeScaledDepthBias` – not used here.)
- **When done:** `shadow_mapping.hlsl`: the new signature, `float bias = max(0.05f * (1.0f - dot(normal, lightDir)),
  0.005f);`, `float shadow = currentDepth - bias > closestDepth ? 1.0f : 0.0f;`, and the call with `normal, lightDir`.
  **The stripes are gone**, the shadow stays (hard, jagged edges): floor-left (200,450) ≈ 62,42,26, (330,520) ≈ 60,41,25,
  floor-right ≈ 57,39,24 (as in the start); shadow-1/2/3 ≈ 16,11,6 / 16,11,7 / 17,11,7; region x 0..330, y 340..600: mean
  luminance ≈ 44, ≈ 3,900 pixels darker than 20 (as the start). Column 600: the shadow's top edge between rows 415 and
  416 (62 → 16), its bottom edge between 483 and 484 (14 → 53) – a hard step.
  **Peter panning** (discussed, not a task): a bias makes shadows start a little away from the object's foot. learnopengl
  suggests culling front faces in the depth pass (here: `psoDesc.RasterizerState.CullMode = D3D12_CULL_MODE_FRONT` for
  `m_depthPipelineState`), but that breaks for the floor, a single plane with no back side – the reason it is not used.

## over-sampling
- **Task:** Stop over-sampling: outside the shadow map nothing should be in shadow – give sampler s1 a white border (depth 1.0) – and fragments farther than the light's far plane (`projCoords.z > 1.0f`) are never in shadow.
- **Hint:** In the root signature, after `samplers[1].ShaderRegister = 1;`: `AddressU`, `AddressV`, `AddressW` = `D3D12_TEXTURE_ADDRESS_MODE_BORDER` and `samplers[1].BorderColor = D3D12_STATIC_BORDER_COLOR_OPAQUE_WHITE;` (a static sampler has three border colours to choose from: transparent black, opaque black, opaque white – learnopengl: `GL_CLAMP_TO_BORDER` + `GL_TEXTURE_BORDER_COLOR` 1.0). In `ShadowCalculation` before `return`: `if (projCoords.z > 1.0f) shadow = 0.0f;`.
- **When done:** `main.cpp`: the four `samplers[1]` lines (`D3D12_TEXTURE_ADDRESS_MODE_BORDER` ×3,
  `D3D12_STATIC_BORDER_COLOR_OPAQUE_WHITE`); `shadow_mapping.hlsl`: `if (projCoords.z > 1.0f) shadow = 0.0f;` before
  `return shadow;`. **From the default camera this changes almost nothing:** the regions outside the light's frustum lie
  far away near the horizon (the floor beyond the far plane needs 2x + z > 11.4, outside the view; the floor outside the
  20×20 box starts at about z < -11). Only ≈ 86 pixels change, a thin line on the far floor at the right: rows 317–319,
  x 706–799, e.g. (722,317) ≈ 16,11,7 → 27,19,11. Everything else is identical to `bias` (named points unchanged). The
  OpenGL project checked it with a camera moved back and up (cameraPos (0, 12, 22), pitch -28.6°): before, the right part
  of the floor beyond the far plane is dark and a wrapped copy of the shadows shows far away; after, that floor is lit.
  So check the code (the border address mode and colour, the `projCoords.z > 1.0f` test) rather than the picture.

## pcf
- **Task:** Soften the shadow's edges with percentage-closer filtering: average the comparison over the 3×3 shadow map texels around the position (`GetDimensions` gives the shadow map's size).
- **Hint:** `float shadow = 0.0f; uint width, height; shadowMap.GetDimensions(width, height); float2 texelSize = 1.0f / float2(width, height);` (GLSL: `1.0 / textureSize(shadowMap, 0)`), then `for (int x = -1; x <= 1; ++x)` / `for (int y = -1; y <= 1; ++y)` with `float pcfDepth = shadowMap.Sample(shadowSampler, shadowUV + float2(x, y) * texelSize).r; shadow += currentDepth - bias > pcfDepth ? 1.0f : 0.0f;` and finally `shadow /= 9.0f;` – `closestDepth` is no longer needed. (Direct3D has hardware PCF too: a comparison sampler, `D3D12_FILTER_COMPARISON_MIN_MAG_LINEAR_MIP_POINT` with `ComparisonFunc = D3D12_COMPARISON_FUNC_LESS_EQUAL`, and `SampleCmpLevelZero(…, currentDepth - bias)` – what Microsoft's samples use; learnopengl's loop is used here.)
- **When done:** `shadow_mapping.hlsl` `ShadowCalculation`: no `closestDepth`; `shadowMap.GetDimensions(width, height)`,
  `float2 texelSize = 1.0f / float2(width, height);`, the two nested `for` loops with `shadowMap.Sample(shadowSampler,
  shadowUV + float2(x, y) * texelSize).r`, `shadow /= 9.0f;`, then the `projCoords.z > 1.0f` test. The shadow's **edges
  become soft**: the inside and the lit floor stay the same (shadow-1/2/3 ≈ 16,11,6 / 16,11,7 / 17,11,7, floor-left ≈
  62,42,26, floor-right ≈ 57,39,24), but edge pixels get in-between values: column 600, top edge rows 414–417 = 62, 47,
  31, 15 (was 62, 62, 16, 16); bottom edge rows 482–485 ≈ 27, 27, 40, 54 (was 14, 14, 53, 53). In the box x 450..800,
  y 400..520 the pixels with red 20..49 go from ≈ 1,030 (bias) to ≈ 3,300, the fully dark ones (red < 20) from ≈ 22,400 to
  ≈ 21,200. This is the solution (learnopengl's `shadow_mapping.fs`).

**Coordinates (DirectX 12):** the light's orthographic projection (`XMMatrixOrthographicRH`) gives NDC x, y in -1..1 and
z already in 0..1 (the depth written into the shadow map), so `projCoords.z` is compared as it is; x and y go through
`* 0.5f + 0.5f`, and y is negated because Direct3D's texture v = 0 is the render target's top row, NDC y = +1.
