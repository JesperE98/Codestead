# multiple-lights – DirectX 12

learnopengl.com "Multiple lights": `multiple_lights.cpp` with `6.multiple_lights.vs/.fs` and `6.light_cube.vs/.fs`.
Files: `main.cpp`, `multiple_lights.hlsl`, `light_cube.hlsl`, `container2.png`, `container2_specular.png`.

Start (prepared from the Light Casters solution): the ten containers, the diffuse + specular maps, shininess 32, the
camera at (0, 0, 3) looking down -z (comment `// camera: at (0, 0, 3) looking down -z, so all ten containers are in
view`; yaw -90, pitch 0), the lamp's pipeline state `m_lightCubePipelineState`. The lit object's shaders are renamed to
`multiple_lights.hlsl`: `VSMain` unchanged; the textures, `struct Material { float shininess; }`, the cbuffer
`SceneConstantBuffer` with `view`, `projection`, `viewPos`, `material` (no light), and a fresh `PSMain` that computes
`norm` and `viewDir`, sets `float3 result = float3(0.0f, 0.0f, 0.0f);` and has three TODOs (phase 1: directional
light, phase 2: point lights, phase 3: spot light) before `return float4(result, 1.0f);`. In `main.cpp` the C++
`Light` struct and the `lightPos` global are gone (`SceneConstantBuffer` = `view`, `projection`, `viewPos`,
`padding0`, `material`); `OnUpdate` sets only `viewPos` and `material.shininess`, followed by learnopengl's comment
block about setting the values of all lights by hand and three TODOs (directional light, point lights 1 to 4, spot
light); a TODO stands where the lamps are drawn in `PopulateCommandList`.

HLSL notes: the light functions are defined **before** `PSMain` (HLSL code defines a function before its use;
learnopengl declares prototypes and defines them after `main`), and they get the texture coordinates as an extra last
parameter `float2 texCoord` (GLSL's functions read the global input `TexCoords`). As in Light Casters, the attenuation
fields are `constantTerm`, `linearTerm`, `quadraticTerm` (`linear` is an HLSL keyword) and the local `distance` is
`dist`. The structs keep learnopengl's field order (`PointLight`: position, the three terms, the colours; `SpotLight`:
position, direction, cutOff, outerCutOff, the three terms, the colours) – with it every `float3` starts a 16-byte row.
The C++ structs (`DirLight` 64 bytes, `PointLight` 80, `SpotLight` 96) have the same layout; the array
`PointLight pointLights[4]` matches HLSL's array, whose elements each start a new row (stride 80). In the final state
the constant buffer is 640 bytes (all 46 fields at the same offsets in HLSL and C++); the buffer and its view are
rounded up to 768 by `CalculateConstantBufferByteSize`.

Pixel positions are in the 800×600 client area from the top left, at time = 1 s (nothing depends on time). D3D12
cannot run here: the colours come from a software model of this code (the app's simulator; bilinear filtering, one mip
level as in the code) and agree with OpenGL's Mesa screenshots of the same steps within a few units (OpenGL's mipmaps
make far containers a little different). Container 0 faces the camera (front face x ≈ 255..545, y ≈ 155..445). Named
points: **centre** (400,300) = wood of container 0, **frame** (265,300) = its left steel frame, **top-frame** (400,165),
**corner** (262,162), **spot-edge** (330,230) = wood inside the flashlight's soft edge, **c8** (640,260), **c7**
(600,70), **c9** (191,139), **far** (483,100), **right-border** (797,160), **background** (400,520) and (30,300) =
26,26,26.

Start picture: **all containers black** 0,0,0 (no light yet) on the 26,26,26 background.

## dir-light
- **Task:** Add the directional light: a `DirLight` struct (direction, ambient, diffuse, specular) in HLSL and C++, `DirLight dirLight;` at the end of the cbuffer / C++ struct, the function `float3 CalcDirLight(DirLight light, float3 normal, float3 viewDir, float2 texCoord)` (before `PSMain`) and `float3 result = CalcDirLight(dirLight, norm, viewDir, input.texCoord);` as phase 1; set learnopengl's values in `OnUpdate`: direction (-0.2, -1.0, -0.3), ambient 0.05, diffuse 0.4, specular 0.5.
- **Hint:** The function does what the directional light of Light Casters did: `lightDir = normalize(-light.direction)`, `diff`, `reflectDir`, `spec` with `material.shininess`, then `ambient`, `diffuse`, `specular` from the two maps (`diffuseMap.Sample(wrapSampler, texCoord).rgb` …), and returns their sum. C++: `struct DirLight { XMFLOAT3 direction; float padding0; XMFLOAT3 ambient; float padding1; XMFLOAT3 diffuse; float padding2; XMFLOAT3 specular; float padding3; };`, `constantBufferData.dirLight.direction = XMFLOAT3(-0.2f, -1.0f, -0.3f);` …
- **When done:** `multiple_lights.hlsl`: `struct DirLight { float3 direction; float3 ambient; float3 diffuse; float3
  specular; };` after `Material`, `DirLight dirLight;` after `material` in `SceneConstantBuffer`, learnopengl's
  `CalcDirLight` (with the `texCoord` parameter) before `PSMain`, phase 1 `float3 result = CalcDirLight(dirLight, norm,
  viewDir, input.texCoord);`. `main.cpp`: the C++ `DirLight` of the hint (before `SceneConstantBuffer`), `DirLight
  dirLight;` at the end of `SceneConstantBuffer`, `// directional light` with `dirLight.direction` (-0.2, -1.0, -0.3),
  `dirLight.ambient` (0.05), `dirLight.diffuse` (0.4), `dirLight.specular` (0.5). The containers are **dimly lit from
  above**: centre ≈ 24,16,8, frame ≈ 24,25,26, c8 ≈ 10,7,4, c7 ≈ 8,5,3, far ≈ 9,6,3; faces turned up are brighter,
  c9 ≈ 48,32,18.

## point-lights
- **Task:** Add four point lights: a `PointLight` struct (position, constantTerm, linearTerm, quadraticTerm, ambient, diffuse, specular), `#define NR_POINT_LIGHTS 4`, `PointLight pointLights[NR_POINT_LIGHTS];` in the cbuffer, `CalcPointLight(PointLight light, float3 normal, float3 fragPos, float3 viewDir, float2 texCoord)` with attenuation, and phase 2 – a loop adding every point light; in `main.cpp` the C++ `PointLight`, `PointLight pointLights[4];` in `SceneConstantBuffer`, learnopengl's `pointLightPositions` as a global array, and for each of the four: position, ambient 0.05, diffuse 0.8, specular 1.0, constantTerm 1.0, linearTerm 0.09, quadraticTerm 0.032.
- **Hint:** Array elements and their fields are set like any C++ array of structs: `constantBufferData.pointLights[0].position = pointLightPositions[0];`. Positions: (0.7, 0.2, 2.0), (2.3, -3.3, -4.0), (-4.0, 2.0, -12.0), (0.0, 0.0, -3.0) – a global, because `PopulateCommandList` needs them too (for the lamps). C++ layout as in Light Casters' point light: `XMFLOAT3 position; float constantTerm; float linearTerm; float quadraticTerm; float padding0[2];` then the three colours with a `float` each (80 bytes, the HLSL array's stride).
- **When done:** `multiple_lights.hlsl`: `struct PointLight { float3 position; float constantTerm; float linearTerm; float
  quadraticTerm; float3 ambient; float3 diffuse; float3 specular; };`, `#define NR_POINT_LIGHTS 4`, `PointLight
  pointLights[NR_POINT_LIGHTS];` after `dirLight`, learnopengl's `CalcPointLight` (diffuse, specular, attenuation applied
  to all three terms) after `CalcDirLight`, phase 2 `for (int i = 0; i < NR_POINT_LIGHTS; i++) result +=
  CalcPointLight(pointLights[i], norm, input.fragPos, viewDir, input.texCoord);`. `main.cpp`: global `XMFLOAT3
  pointLightPositions[]` (4 entries) after `fov`, the C++ `PointLight`, `PointLight pointLights[4];` after `dirLight`,
  and `// point light 1` … `// point light 4`, each with 7 assignments (`pointLights[i].position/ambient/diffuse/
  specular/constantTerm/linearTerm/quadraticTerm`). The scene is **much brighter**, near containers most: centre ≈
  126,83,44, frame ≈ 111,113,117, top-frame ≈ 126,128,133, c9 ≈ 110,73,39, c7 ≈ 100,66,35, c8 ≈ 68,48,25, far ≈
  67,44,23 (lit by the point light at (-4, 2, -12)).

## spot-light
- **Task:** Add the flashlight: a `SpotLight` struct (position, direction, cutOff, outerCutOff, constantTerm, linearTerm, quadraticTerm, ambient, diffuse, specular), `SpotLight spotLight;` in the cbuffer, `CalcSpotLight` (attenuation × soft-edge intensity) and phase 3 `result += CalcSpotLight(spotLight, norm, input.fragPos, viewDir, input.texCoord);`; set position = `cameraPos`, direction = `cameraFront`, ambient 0, diffuse 1, specular 1, constantTerm 1, linearTerm 0.09, quadraticTerm 0.032, cutOff cos(12.5°), outerCutOff cos(15°).
- **Hint:** It is the soft spotlight of Light Casters as a function: `intensity = clamp((theta - light.outerCutOff) / epsilon, 0.0f, 1.0f)`, and all three terms are multiplied by `attenuation * intensity`. `XMStoreFloat3(&constantBufferData.spotLight.position, cameraPos);`, `constantBufferData.spotLight.cutOff = std::cos(XMConvertToRadians(12.5f));`. C++ layout as Light Casters' final light: `position, padding0, direction, cutOff, outerCutOff, constantTerm, linearTerm, quadraticTerm, ambient, padding1, diffuse, padding2, specular, padding3`.
- **When done:** `multiple_lights.hlsl`: the `SpotLight` struct before `#define NR_POINT_LIGHTS 4`, `SpotLight spotLight;`
  after `pointLights`, learnopengl's `CalcSpotLight` after `CalcPointLight`, phase 3. `main.cpp`: the C++ `SpotLight`,
  `SpotLight spotLight;` after `pointLights`, `// spotLight` with the ten assignments of the task
  (`XMStoreFloat3(&constantBufferData.spotLight.position, cameraPos)`, `XMStoreFloat3(&constantBufferData.spotLight.direction,
  cameraFront)`, `std::cos(XMConvertToRadians(12.5f))`, `std::cos(XMConvertToRadians(15.0f))`). A **bright disc on
  container 0**: centre 126,83,44 → **244,164,93**, frame → 229,232,241, top-frame → 244,247,255, spot-edge (330,230)
  105,70,36 → 201,134,72; the corner (262,162) ≈ 111,112,116 and the other containers unchanged (outside the cone).

## lamps
- **Task:** Draw a lamp at each point light: after the containers, switch to `m_lightCubePipelineState` and loop over the four `pointLightPositions`, each a cube scaled by 0.2 and moved there.
- **Hint:** `m_commandList->SetPipelineState(m_lightCubePipelineState.Get());` once, then in the loop `XMMATRIX model = XMMatrixScaling(0.2f, 0.2f, 0.2f) * XMMatrixTranslation(pointLightPositions[i].x, pointLightPositions[i].y, pointLightPositions[i].z);`, store it in `modelConstants.model`, `SetGraphicsRoot32BitConstants(0, …)` and `DrawInstanced(36, 1, 0, 0)`.
- **When done:** after the containers' loop: `// also draw the lamp object(s)`, `SetPipelineState(m_lightCubePipelineState.Get())`,
  `for (UINT i = 0; i < 4; i++)` with the model of the hint, `XMStoreFloat4x4(&modelConstants.model,
  XMMatrixTranspose(model))`, `SetGraphicsRoot32BitConstants(0, sizeof(ModelConstants) / 4, &modelConstants, 0)` and
  one `DrawInstanced(36, 1, 0, 0)` each. With the camera at (0, 0, 3) the lamps are **hardly visible**: lamp 1
  (0.7, 0.2, 2.0) shows only as a white sliver at the right border (x 795..799, y ≈ 100..233; right-border (797,160)
  26,26,26 → 255,255,255), lamp 2 (2.3, -3.3, -4.0) is below the window, lamp 3 (-4, 2, -12) is hidden behind
  container 9, lamp 4 (0, 0, -3) behind container 0. Everything else unchanged (centre 244,164,93). Best checked in the
  code (4 draws with the lamp's pipeline state). Moving the camera (S to step back, the mouse) shows them. Final state
  (= learnopengl's `multiple_lights.cpp` with the course's camera globals).

Optional exercise of the chapter (not a task): recreate learnopengl's "desert", "factory", "horror" and "biochemical
lab" atmospheres by changing the clear colour and the lights' colours.
