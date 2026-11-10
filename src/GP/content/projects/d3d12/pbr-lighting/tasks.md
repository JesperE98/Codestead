# PBR Lighting – tasks (DirectX 12)

learnopengl.com "PBR / Lighting": `src/6.pbr/1.1.lighting` and `1.2.lighting_textured`; the Direct3D 12 side keeps the
structure of the Advanced Lighting projects (one file modelled on the D3D12HelloWorld samples, `LoadPipeline` /
`LoadAssets` / `OnUpdate` / `PopulateCommandList`, a `RenderScene()` helper, root constants per draw, a constant buffer
view per frame, `LoadTexture`). Files: `main.cpp`, `pbr.hlsl` (`VSMain` = learnopengl's pbr.vs, `PSMain` = pbr.fs) and
the material's maps `albedo.png`, `normal.png`, `metallic.png`, `roughness.png`, `ao.png` (used by the last task).

**Fixed choices for the whole PBR part (`pbr-theory`, `pbr-lighting`, `diffuse-irradiance`, `specular-ibl`), the same in
every API** (the OpenGL project's `tasks.md` has the full list):
- Window 800×600. **Camera: (0, 0, 22) looking down -z** (yaw -90, pitch 0, fov 45, near 0.1, far 100), the camera
  globals of the earlier chapters (`XMMatrixLookAtRH`, `XMMatrixPerspectiveFovRH`); learnopengl's camera starts at
  (0, 0, 3), in the middle of the grid.
- Sphere: learnopengl's `renderSphere()` UV sphere, radius 1, **24 × 24 segments** (learnopengl 64 × 64), an indexed
  triangle strip (25 × 25 vertices, 1200 indices). `struct Vertex { XMFLOAT3 position; XMFLOAT3 normal; XMFLOAT2
  texCoord; XMFLOAT3 tangent; }` (input layout POSITION / NORMAL / TEXCOORD / TANGENT, byte offsets 0, 12, 24, 32):
  normal = position, tangent = (-sin(2π·xSegment), 0, cos(2π·xSegment)), **texCoord = (xSegment, 1 - ySegment)** –
  learnopengl's uv with v flipped, because the images are not flipped when loaded (Direct3D's v = 0 is the image's top
  row; OpenGL flips the images instead). Built in `LoadAssets` with learnopengl's loops into `std::vector<Vertex>
  vertices` / `std::vector<UINT> indices`, copied into `m_sphereVertexBuffer` / `m_sphereIndexBuffer` (upload heaps),
  drawn by `RenderSphere()`: `IASetPrimitiveTopology(D3D_PRIMITIVE_TOPOLOGY_TRIANGLESTRIP)`, `IASetVertexBuffers`,
  `IASetIndexBuffer` (`DXGI_FORMAT_R32_UINT`), `DrawIndexedInstanced(m_indexCount, 1, 0, 0, 0)`. No culling
  (`D3D12_CULL_MODE_NONE`).
- The grid (`RenderScene()`, globals `nrRows = 7`, `nrColumns = 7`, `spacing = 2.5f`): 7 × 7 spheres at ((col - 3) · 2.5,
  (row - 3) · 2.5, 0); `metallic = row / 7` (bottom row 0), `roughness = std::clamp(col / 7, 0.05f, 1.0f)` (left column
  0.05), albedo (0.5, 0.0, 0.0), ao 1.0 – all in the **root constants** of the draw (root parameter 0, `cbuffer
  ModelConstants : register(b0)`: `model`, `normalMatrix`, `float3 albedo`, `float metallic`, `float roughness`, `float
  ao` = 38 32-bit values; `albedo` and `metallic` share a 16-byte row in HLSL and in the C++ struct).
- Four lights (globals `XMFLOAT4 lightPositions[]` / `lightColors[]`) at (-10, 10, 10), (10, 10, 10), (-10, -10, 10),
  (10, -10, 10), colour (300, 300, 300), copied in `OnUpdate` into the constant buffer (`cbuffer SceneConstantBuffer :
  register(b1)`: `view`, `projection`, `float4 lightPositions[4]`, `float4 lightColors[4]`, `float3 camPos` – `float4`
  because every element of an HLSL array takes a 16-byte row; the shader uses `.xyz` / `.rgb`). learnopengl also draws a
  small sphere at each light; with this camera they are outside the view, so the course does not draw them.
- Clear colour (0.1, 0.1, 0.1), a D32_FLOAT depth buffer, the default depth test.
- **The textured spheres** (last task here and in `specular-ibl`): a **3 × 3 grid** of large spheres: `nrRows = 3`,
  `nrColumns = 3`, `spacing = 6.0f`, each `XMMatrixScaling(2.4f, 2.4f, 2.4f) * XMMatrixRotationY(XMConvertToRadians(90.0f))
  * XMMatrixTranslation((col - 1) · 6, (row - 1) · 6, 0)` (row vectors: = learnopengl-style translate · rotate · scale).
  The five maps are loaded linear (`DXGI_FORMAT_R8G8B8A8_UNORM`, one mip level, static sampler WRAP, not flipped); the
  albedo is converted in the shader with `pow(…, 2.2f)` (learnopengl's way); metallic, roughness and ao are read from
  the red channel; the normal comes from the normal map through a TBN matrix built in the pixel shader from the
  interpolated vertex normal and tangent.
- IBL numbers (the course's simulator runs on the CPU; a real GPU handles learnopengl's easily): environment cube map
  128² per face (learnopengl 512²), irradiance map 32² with `sampleDelta = 0.1` (0.025), pre-filter map 64² with 5 mip
  levels and `SAMPLE_COUNT = 128u` (128², 1024), BRDF lookup texture 128² with `SAMPLE_COUNT = 128u` (512², 1024).

**This chapter.** Start: `VSMain` complete, and the skeleton of `PSMain` – `N`, `V`, `Lo = 0`, the ambient term
`float3(0.03f, 0.03f, 0.03f) * albedo * ao` and `return float4(color, 1.0f)`. TODOs in `pbr.hlsl`: the three BRDF
functions, the light loop, the tone mapping. `main.cpp` is complete for the first five tasks (it already sends
`metallic`, `roughness`, the lights and `camPos`); it has TODO comments for the textures of the last task (members, the
static sampler, the loading, the descriptor table); `LoadTexture` is there, unused until then.

HLSL against learnopengl's GLSL: `vec3` → `float3`, `mix` → `lerp`, `uniform`s → the two cbuffers, `WorldPos` /
`Normal` / `TexCoords` → `input.worldPos` / `input.normal` / `input.texCoords`, `lightPositions[i]` →
`lightPositions[i].xyz`, `FragColor = …` → `return …`. C++ matrices are stored transposed (`XMMatrixTranspose`) and
multiplied with the vector on the left (`mul(position, model)`), as in every chapter; the normal matrix
transpose(inverse(model)) stored transposed is `XMMatrixInverse(nullptr, model)`.

Pixels: coordinates from the top left of the 800×600 client area; nothing depends on time. D3D12 cannot run here; the
values are the OpenGL project's (Mesa), which the app's simulator reproduces for this project in every state (at full
size all but about 16 edge pixels equal up to `tone-map`; see *Simulator* at the end). The spheres' centres are at x = 153, 235, 318, 400, 482, 565, 647 (col 0..6) and y = 547, 465,
382, 300, 218, 135, 53 (row 0..6, row 0 at the bottom); each is about 66 pixels wide (the centre one covers x 367..432,
y 267..332). About 174,600 pixels belong to spheres in every state of the 7 × 7 grid. Named points (as OpenGL's):
**background** (20,20) and **gap** (359,259) (between four spheres) = 26,26,26 in every state of the 7 × 7 grid; sphere
centres **c00** (153,547) (bottom left: non-metal, smooth), **c03** (400,547), **c06** (647,547) (bottom right:
non-metal, rough), **c33** (400,300), **c60** (153,53) (top left: metal, smooth), **c63** (400,53), **c66** (647,53)
(top right: metal, rough); highlight points (where one light's reflection sits in the finished shader): **h00**
(162,537) on sphere (row 0, col 0), **h02** (326,535), **h33** (411,288), **h60** (165,47), **h62** (331,46); edge points
**e33** (400,270) (top of the centre sphere) and **e66** (647,26).

**Start picture:** nearly black spheres on the grey clear colour: every sphere pixel = 4,0,0 (the ambient term
(0.015, 0, 0) written without gamma correction), background = 26,26,26.

## lambert
- **Task:** Write the light loop in `PSMain` (`pbr.hlsl`): for each of the four lights compute the light direction `L`, the radiance that arrives (`lightColors[i].rgb` times the attenuation `1.0f / (distance * distance)`) and `NdotL`, and add the diffuse (Lambert) reflection `albedo / PI * radiance * NdotL` to `Lo`.
- **Hint:** `for (int i = 0; i < 4; ++i) { float3 L = normalize(lightPositions[i].xyz - input.worldPos); float distance = length(lightPositions[i].xyz - input.worldPos); float attenuation = 1.0f / (distance * distance); float3 radiance = lightColors[i].rgb * attenuation; float NdotL = max(dot(N, L), 0.0f); Lo += (albedo / PI) * radiance * NdotL; }` – dividing by π is the Lambertian BRDF; the lights' 300 is so large because the squared distance (about 300) eats it.
- **When done:** `pbr.hlsl`: the `for (int i = 0; i < 4; ++i)` loop with `L`, `distance`, `attenuation = 1.0f / (distance * distance)`, `radiance = lightColors[i].rgb * attenuation`, `NdotL = max(dot(N, L), 0.0f)` and `Lo += (albedo / PI) * radiance * NdotL;`. The spheres are **matt red**, all 49 alike (metallic and roughness are not used yet), brighter towards the grid's corners (closer to a light), only the red channel: c00 = 138,0,0, c03 = 108,0,0, c06 = 140,0,0, c33 = 97,0,0, c60 = 137,0,0, c63 = 108,0,0, c66 = 138,0,0, h33 = 86,0,0, h02 = 88,0,0, h62 = 95,0,0, e33 = 71,0,0, e66 = 129,0,0; background = 26,26,26. No pixel is saturated.

## ndf
- **Task:** Add the normal distribution function `DistributionGGX(N, H, roughness)` (Trowbridge-Reitz GGX) and use it: compute the halfway vector `H` in the loop and, for now, add the NDF alone as the specular term: `float3 specular = float3(NDF, NDF, NDF);`, `Lo += (albedo / PI + specular) * radiance * NdotL;`.
- **Hint:** learnopengl's function: `float a = roughness * roughness; float a2 = a * a; float NdotH = max(dot(N, H), 0.0f); float NdotH2 = NdotH * NdotH; float denom = (NdotH2 * (a2 - 1.0f) + 1.0f); denom = PI * denom * denom; return a2 / denom;` (the roughness is squared first: that looks more natural). `float3 H = normalize(V + L);`. The function's parameter `roughness` hides the cbuffer's value of the same name inside the function – as in learnopengl's GLSL.
- **When done:** `pbr.hlsl`: `float DistributionGGX(float3 N, float3 H, float roughness)` as learnopengl writes it; in the loop `float3 H = normalize(V + L);`, `float NDF = DistributionGGX(N, H, roughness);`, `float3 specular = float3(NDF, NDF, NDF);` and `Lo += (albedo / PI + specular) * radiance * NdotL;`. **Glaring white highlights that grow with the roughness**, the same in every row: in the left column (roughness 0.05) four tiny white dots per sphere (h00 = 255,255,255, h60 = 255,255,255; the sphere's centre stays c00 = 138,0,0, c60 = 137,0,0), in the middle four fat white blobs (h33 = 255,255,255, h02 = 255,255,255, h62 = 255,255,255, between them c33 = 192,95,95, c03 = 240,131,131, c63 = 240,132,132, e33 = 86,15,15), on the right the whole sphere is white (c06 = 255,255,255, c66 = 255,255,255, e66 = 255,255,255). About 39,270 pixels are pure white. Background = 26,26,26. Nothing limits the NDF yet, so the spheres reflect far more light than arrives.

## geometry
- **Task:** Add the geometry function – `GeometrySchlickGGX(NdotV, roughness)` with `k = (roughness + 1)² / 8` and `GeometrySmith(N, V, L, roughness)` – and make the specular term `NDF * G / (4 * NdotV * NdotL + 0.0001)`.
- **Hint:** `float r = (roughness + 1.0f); float k = (r * r) / 8.0f; return NdotV / (NdotV * (1.0f - k) + k);` and `GeometrySmith` multiplies the value for `max(dot(N, V), 0.0f)` with the one for `max(dot(N, L), 0.0f)`. In the loop: `float G = GeometrySmith(N, V, L, roughness); float numerator = NDF * G; float denominator = 4.0f * max(dot(N, V), 0.0f) * max(dot(N, L), 0.0f) + 0.0001f; float3 specular = numerator / denominator;` – the 0.0001 prevents a division by zero (HLSL widens the one float to the three channels).
- **When done:** `pbr.hlsl`: `float GeometrySchlickGGX(float NdotV, float roughness)` (`k = (r * r) / 8.0f`) and `float GeometrySmith(float3 N, float3 V, float3 L, float roughness)`; in the loop `float G = GeometrySmith(N, V, L, roughness);`, `float numerator = NDF * G;`, `float denominator = 4.0f * max(dot(N, V), 0.0f) * max(dot(N, L), 0.0f) + 0.0001f;`, `float3 specular = numerator / denominator;`. The highlights are **smaller and dimmer on the rough spheres**, which are pink now instead of white: c06 = 255,120,120 (was 255,255,255), c66 = 255,118,118, e66 = 222,93,93, c03 = 156,47,47, c33 = 133,36,36, c63 = 155,48,48, e33 = 79,8,8; the highlights of the smooth and middle spheres are still white: h00, h60, h33, h02, h62 = 255,255,255; c00 = 138,0,0, c60 = 137,0,0. About 4,740 pixels are pure white. Background = 26,26,26. Still every sphere reflects like a perfect mirror in the highlight (no Fresnel factor), and rows look the same.

## fresnel
- **Task:** Add `fresnelSchlick(cosTheta, F0)` and finish the reflectance equation: `F0 = lerp(0.04, albedo, metallic)`, the Cook-Torrance specular term `NDF * G * F / (4 * NdotV * NdotL + 0.0001)`, `kS = F`, `kD = (1 - kS) * (1 - metallic)` and `Lo += (kD * albedo / PI + specular) * radiance * NdotL`.
- **Hint:** `return F0 + (1.0f - F0) * pow(clamp(1.0f - cosTheta, 0.0f, 1.0f), 5.0f);`. Before the loop: `float3 F0 = float3(0.04f, 0.04f, 0.04f); F0 = lerp(F0, albedo, metallic);` (`lerp` is HLSL's `mix`). In the loop: `float3 F = fresnelSchlick(clamp(dot(H, V), 0.0f, 1.0f), F0);`, `float3 numerator = NDF * G * F;`, then `float3 kS = F; float3 kD = float3(1.0f, 1.0f, 1.0f) - kS; kD *= 1.0f - metallic;`. The specular term is not multiplied by `kS` again: `F` is already in it.
- **When done:** `pbr.hlsl`: `float3 fresnelSchlick(float cosTheta, float3 F0)`; `float3 F0 = float3(0.04f, 0.04f, 0.04f);` + `F0 = lerp(F0, albedo, metallic);` before the loop; in the loop `float3 F = fresnelSchlick(clamp(dot(H, V), 0.0f, 1.0f), F0);`, `float3 numerator = NDF * G * F;`, `float3 kS = F;`, `float3 kD = float3(1.0f, 1.0f, 1.0f) - kS;`, `kD *= 1.0f - metallic;`, `Lo += (kD * albedo / PI + specular) * radiance * NdotL;` – learnopengl's finished reflectance equation. **The rows differ now**: the bottom row (non-metal) keeps its red diffuse colour with small white highlights (c00 = 133,0,0, c03 = 106,2,2, c06 = 139,5,5, h00 = 255,255,255, h02 = 154,70,70), towards the top (metal) the diffuse light disappears and the highlights take the albedo's red: c33 = 53,1,1, h33 = 208,16,16, c60 = 15,0,0, c63 = 33,0,0, c66 = 66,1,1, h60 = 255,12,12, h62 = 255,22,22, e33 = 35,0,0, e66 = 54,1,1. Only about 54 pixels are pure white. Background = 26,26,26. The picture is dark and harsh: the colours are linear and clipped at 1.0.

## tone-map
- **Task:** At the end of `PSMain` tone map the colour with the Reinhard operator `color / (color + 1.0)` and gamma correct it with `pow(color, 1.0 / 2.2)` before returning it.
- **Hint:** The lighting is computed with linear, unbounded (HDR) values; the window stores gamma-encoded values between 0 and 1. Tone mapping first, then gamma – learnopengl's last lines: `color = color / (color + float3(1.0f, 1.0f, 1.0f)); color = pow(color, 1.0f / 2.2f);`.
- **When done:** `pbr.hlsl`: `color = color / (color + float3(1.0f, 1.0f, 1.0f));` then `color = pow(color, 1.0f / 2.2f);` before `return float4(color, 1.0f);`. learnopengl's picture: **brighter, softer spheres**, the highlights no longer clipped: c00 = 157,1,1, c03 = 146,27,27, c06 = 159,41,41, c33 = 115,19,19, c60 = 68,0,0, c63 = 95,11,11, c66 = 124,17,17, h00 = 243,243,243, h02 = 164,127,127, h33 = 177,71,71, h60 = 228,62,62, h62 = 239,81,81, e33 = 98,9,9, e66 = 116,15,15; background = 26,26,26 (the clear colour is not tone mapped). Bottom row: red plastic-like spheres from shiny (left) to matt (right); top row: dark red metal, the highlights wide and dim on the right.

## textured
- **Task:** Take the material from the five maps instead of the root constants: load `albedo.png`, `normal.png`, `metallic.png`, `roughness.png`, `ao.png` with `LoadTexture` into five consecutive slots of the CBV/SRV heap, add a descriptor table for them (registers t0–t4) and a static sampler to the root signature, and in `pbr.hlsl` read albedo (converted to linear with `pow(…, 2.2f)`), metallic, roughness and ao from them and the normal from the normal map with a TBN matrix built from the vertex normal and tangent. Draw a 3 × 3 grid of large spheres (spacing 6.0, scale 2.4, turned 90° about the y axis) so the material can be seen.
- **Hint:** `main.cpp`: `ModelConstants` shrinks to `model` and `normalMatrix` (32 values; `sizeof(ModelConstants) / 4` follows); five `ComPtr<ID3D12Resource>` members; `cbvSrvHeapDesc.NumDescriptors = 6`; `CD3DX12_DESCRIPTOR_RANGE ranges[2]` with `ranges[1].Init(D3D12_DESCRIPTOR_RANGE_TYPE_SRV, 5, 0)`, `CD3DX12_ROOT_PARAMETER rootParameters[3]` with `rootParameters[2].InitAsDescriptorTable(1, &ranges[1], D3D12_SHADER_VISIBILITY_PIXEL)`, a `D3D12_STATIC_SAMPLER_DESC samplers[1]` (`D3D12_FILTER_MIN_MAG_MIP_LINEAR`, `D3D12_TEXTURE_ADDRESS_MODE_WRAP`, register 0) passed to `rootSignatureDesc.Init`; five `LoadTexture("albedo.png", m_albedoTexture, albedoUploadHeap, 1)` … slot 5 (each with its own upload heap `ComPtr` that lives until the end of `LoadAssets`); in `PopulateCommandList` `CD3DX12_GPU_DESCRIPTOR_HANDLE materialTextures(m_cbvSrvHeap->GetGPUDescriptorHandleForHeapStart(), 1, m_cbvSrvDescriptorSize); m_commandList->SetGraphicsRootDescriptorTable(2, materialTextures);`; the globals `nrRows = 3`, `nrColumns = 3`, `spacing = 6.0f`; in `RenderScene` no material values, and `XMMATRIX model = XMMatrixScaling(2.4f, 2.4f, 2.4f) * XMMatrixRotationY(XMConvertToRadians(90.0f)) * XMMatrixTranslation(…)`. `pbr.hlsl`: `Texture2D albedoMap : register(t0);` … `Texture2D aoMap : register(t4);`, `SamplerState wrapSampler : register(s0);`; the material fields leave `cbuffer ModelConstants`; `float3 tangent : TANGENT` as a fourth input of `VSMain` and a fourth field of `PSInput`, `result.tangent = mul(float4(tangent, 0.0f), model).xyz;`; `float3 getNormalFromMap(PSInput input) { float3 tangentNormal = normalMap.Sample(wrapSampler, input.texCoords).xyz * 2.0f - 1.0f; float3 N = normalize(input.normal); float3 T = normalize(input.tangent); T = normalize(T - dot(T, N) * N); float3 B = cross(N, T); float3x3 TBN = float3x3(T, B, N); return normalize(mul(tangentNormal, TBN)); }` and at the top of `PSMain`: `float3 albedo = pow(albedoMap.Sample(wrapSampler, input.texCoords).rgb, 2.2f); float metallic = metallicMap.Sample(wrapSampler, input.texCoords).r; float roughness = roughnessMap.Sample(wrapSampler, input.texCoords).r; float ao = aoMap.Sample(wrapSampler, input.texCoords).r; float3 N = getNormalFromMap(input);`.
- **When done:** `main.cpp`: `struct ModelConstants { XMFLOAT4X4 model; XMFLOAT4X4 normalMatrix; };`; members `m_albedoTexture`, `m_normalTexture`, `m_metallicTexture`, `m_roughnessTexture`, `m_aoTexture`; `cbvSrvHeapDesc.NumDescriptors = 6`; `ranges[1].Init(D3D12_DESCRIPTOR_RANGE_TYPE_SRV, 5, 0)`, `rootParameters[2].InitAsDescriptorTable(1, &ranges[1], D3D12_SHADER_VISIBILITY_PIXEL)`, `samplers[0]` (`MIN_MAG_MIP_LINEAR`, WRAP ×3, `ShaderRegister = 0`) and `rootSignatureDesc.Init(_countof(rootParameters), rootParameters, _countof(samplers), samplers, …)`; `LoadTexture("albedo.png", m_albedoTexture, albedoUploadHeap, 1);`, `("normal.png", …, 2)`, `("metallic.png", …, 3)`, `("roughness.png", …, 4)`, `("ao.png", …, 5)`; `SetGraphicsRootDescriptorTable(2, materialTextures)` with the handle at heap slot 1; `nrRows = 3`, `nrColumns = 3`, `spacing = 6.0f`; `RenderScene` without `albedo` / `ao` / `metallic` / `roughness` and with `XMMatrixScaling(2.4f, 2.4f, 2.4f) * XMMatrixRotationY(XMConvertToRadians(90.0f)) * XMMatrixTranslation(…)`. `pbr.hlsl`: the five `Texture2D` (t0–t4) and `SamplerState wrapSampler : register(s0)`; `cbuffer ModelConstants` with only the two matrices; `float3 tangent : TANGENT` in `VSMain`'s inputs and in `PSInput`, `result.tangent = mul(float4(tangent, 0.0f), model).xyz;`; `getNormalFromMap(PSInput input)` (T made perpendicular to N, `B = cross(N, T)`, `float3x3 TBN = float3x3(T, B, N)`, `mul(tangentNormal, TBN)`); the material read from the maps (albedo with `pow(…, 2.2f)`), `float3 N = getNormalFromMap(input);` (the rest of the shader is unchanged: its `albedo`, `metallic`, `roughness`, `ao` are now local variables).
  **Picture:** nine large spheres (about 158 pixels wide; centres at x = 202, 400, 598 and y = 102, 300, 498; the centre one covers x 321..478, y 221..378) of **riveted steel with rust**: a dark groove cross through the middle of each sphere, four dome-shaped rivets around it, grey shiny steel with the four lights' soft white highlights, and matt orange-brown rust patches (mostly on the right and in the lower part of each sphere) without highlights. On the centre sphere (the simulator's values for this project; OpenGL's Mesa values in brackets – they differ by a level or two where the maps are minified, because the textures have no mipmaps here): **steel-l** (370,270) = 229,230,231 (230,230,232) and **steel-r** (430,270) = 222,223,225 (222,222,224) (the two upper highlights on steel), **steel-low** (377,327) = 197,198,201 (198,199,202), **rust** (450,330) = 114,66,42 (114,67,42), **groove** (400,262) = 93,94,96 (95,96,98) (the vertical groove), **rivet** (369,281) = 209,210,212 (208,209,211) (the lit top of the upper left rivet; right below it the rivet's shaded side is dark, about 90). Other spheres: **top-steel** (372,70) = 199,198,200 (201,200,202), **left-steel** (172,270) = 199,200,203 (197,198,201), **bottom-rust** (255,540) = 108,62,38 (the same), **right-rust** (650,330) = 119,81,60 (118,81,60). Against the OpenGL screenshot 685 pixels differ by more than 10 levels (texture detail and sphere edges), the mean difference is 0.24 levels. Background (20,20) = 26,26,26 and between the spheres (300,200) = 26,26,26. About 186,000 pixels are not the clear colour; none is saturated. **The rivets look raised**: each rivet's highlights sit on the sides facing the lights, the grooves' far walls catch the light. This is the solution.

## Notes
- **Vertex tangents instead of screen-space derivatives.** learnopengl's `getNormalFromMap()` builds the tangent from
  `dFdx` / `dFdy` of the world position and the texture coordinates "to keep things simple". The course uses the
  Normal Mapping chapter's way: a tangent per vertex (computed with the sphere: the derivative of the position by u,
  normalised), interpolated, made perpendicular to the normal again (Gram-Schmidt) and completed with `B = cross(N, T)`.
  The function keeps learnopengl's name; in HLSL it takes the `PSInput` (there are no global inputs).
- **Texture coordinates and the normal map's y in Direct3D.** The maps are tangent-space normal maps with OpenGL's
  convention (green = up in the image). OpenGL flips the images when loading them (its v = 0 is the bottom row);
  Direct3D does not flip, and the sphere's `texCoord.y` is `1 - ySegment` instead – so both sample the same texel at
  every point of the sphere, and the same world-space formulas hold: `T` is where u grows, `B = cross(N, T)` is where
  the image's rows go up (the normal map's +y), `N_world = x · T + y · B + z · N`. (The Normal Mapping chapter's quad
  has its v growing down the image, and so flips y there; here the flipped v already does it.) `float3x3(T, B, N)` has
  T, B, N as its **rows**, so the vector goes on the left: `mul(tangentNormal, TBN)` = learnopengl's `mat3(T, B, N) *
  tangentNormal`. With the sphere's uv the images appear turned by 180° on the sphere (not mirrored), as in OpenGL.
- learnopengl converts the albedo with `pow(…, vec3(2.2))` in the shader; loading it as an sRGB texture
  (`DXGI_FORMAT_R8G8B8A8_UNORM_SRGB`, the Gamma Correction chapter) would do the same conversion in the sampler.
  Metallic, roughness, ao and the normal map are data, not colours: they must stay linear. `LoadTexture` creates the
  textures with one mip level (Direct3D 12 has no `glGenerateMipmap`; see `specular-ibl` for how mip levels are made
  by hand) – learnopengl's textures have mipmaps, which only shows where the maps are minified.
- **Root signature.** Root parameter 0 = 32-bit constants (b0, visible to all shaders: the vertex shader reads the
  matrices, the pixel shader the material), 1 = a table with the CBV (b1), and after `textured` 2 = a table with the 5
  SRVs (t0–t4: consecutive heap slots 1–5, set once per frame – all spheres share the material). The triangle strip
  needs no change of the pipeline state: `PrimitiveTopologyType` is `TRIANGLE` for lists and strips; the strip itself
  is chosen with `IASetPrimitiveTopology`.
- The numbers that are smaller than learnopengl's (24 segments instead of 64) are for the course's simulator, which
  runs on the CPU; a real GPU handles learnopengl's values easily.

## Simulator
Checked with a runner on the app's simulator (`Simulator.Build` + `Rasterizer.Render`, commit e1fc5e0), every state:
it follows this project – the sphere's indexed triangle strip (`D3D_PRIMITIVE_TOPOLOGY_TRIANGLESTRIP`, per draw), the
38 root constants per sphere, the constant buffer, the five SRVs of one table. At 800 px the picture equals the OpenGL
project's Mesa screenshot from the start to `tone-map` (at most 16 pixels differ, on sphere edges); after `textured` the
named points agree within 2 levels (mean difference 0.24 levels; the differences sit where the maps are minified).
Render time of the final state: about 12 s at a 240-pixel-wide preview (SIMW=240), about 40 s at 800.
