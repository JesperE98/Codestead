# materials – DirectX 12

learnopengl.com "Materials": `materials.cpp` (3.1) with `3.1.materials.vs/.fs`. Files: `main.cpp`, `materials.hlsl`
(the lit cube), `light_cube.hlsl` (the lamp).

Start (prepared from the Basic Lighting solution): the lit object's shaders are renamed to `materials.hlsl` (same
contents as `basic_lighting.hlsl`: ambient 0.1, diffuse, specular 0.5 / 32, normal matrix), and the moving-light
exercise is taken out again – the light stays at `lightPos (1.2, 1.0, 2.0)` as in learnopengl. Same front-left camera
as Colors. The constant buffer at the start: `view`, `projection`, `objectColor`, `lightColor`, `lightPos`, `viewPos`.

HLSL structs in a cbuffer follow the same packing rules as the cbuffer itself: a struct starts a new 16-byte row, each
`float3` starts a new row unless it fits in the rest of the current one, a `float` fills the row after a `float3`.
The C++ structs (`Material`, `Light`, declared in the class before `SceneConstantBuffer`) copy that layout with
`float padding…` members, so every field lands at the same byte offset as in HLSL. (Checked for every step: all
fields at equal offsets.)

Pixel positions are in the 800×600 client area from the top left, at time = 1 s. D3D12 cannot run here: the colours
come from a software model of this code (the app's simulator) and agree with OpenGL's Mesa screenshots of the same
steps within one unit. Named points: **front** (302,370) = centre of the cube's front face, **front-top-left**
(271,320), **highlight** (243,278) = the specular highlight in the upper-left corner of the front face, **left**
(163,370) = centre of the left face (only ambient light reaches it), **lamp** (641,195) = 255,255,255 in every step,
**background** (400,300) and (100,100) = 26,26,26.

Start picture (= Basic Lighting after `specular`): front ≈ 204,102,63, front-top-left ≈ 232,116,72, highlight ≈
255,145,90, left 26,13,8.

## material
- **Task:** Describe the surface with a `Material` struct (`float3 ambient, diffuse, specular; float shininess;`) in `materials.hlsl`, a `Material material;` in the cbuffer (after `viewPos`) instead of `objectColor`, and use its fields instead of `objectColor`, the 0.1/0.5 strengths and the 32; in `main.cpp` the matching C++ struct and learnopengl's coral material, set in `OnUpdate`.
- **Hint:** `ambient = lightColor * material.ambient`, `diffuse = lightColor * (diff * material.diffuse)`, `specular = lightColor * (spec * material.specular)` with `pow(…, material.shininess)`, `result = ambient + diffuse + specular`. C++: `struct Material { XMFLOAT3 ambient; float padding0; XMFLOAT3 diffuse; float padding1; XMFLOAT3 specular; float shininess; };` – `shininess` fits in the row of `specular`, as in HLSL. `constantBufferData.material.ambient = XMFLOAT3(1.0f, 0.5f, 0.31f);` …
- **When done:** `materials.hlsl`: `struct Material { float3 ambient; float3 diffuse; float3 specular; float shininess; };`
  before the cbuffer; `SceneConstantBuffer` = `view`, `projection`, `lightColor`, `lightPos`, `viewPos`, `Material
  material;` (no `objectColor`); `PSMain` without `ambientStrength`/`specularStrength`/`objectColor`, the three terms as
  in the hint. `main.cpp`: the C++ `Material` of the hint, `SceneConstantBuffer` = `view`, `projection`, `lightColor` +
  `padding0`, `lightPos` + `padding1`, `viewPos` + `padding2`, `Material material;`; in `OnUpdate` no `objectColor`,
  `// material properties` with `material.ambient` (1.0, 0.5, 0.31), `material.diffuse` (1.0, 0.5, 0.31),
  `material.specular` (0.5, 0.5, 0.5), `material.shininess` 32.0f. The ambient light is now at full strength, so the
  cube is **far too bright**: left face = full coral **255,128,79**, front ≈ 255,217,135, front-top-left ≈
  255,248,166, highlight ≈ 255,255,229 (almost white).

## light
- **Task:** Give the light its own intensities: a `Light` struct (`float3 position; float3 ambient, diffuse, specular;`) and `Light light;` (after `material`) replace `lightColor` and `lightPos` in the cbuffer; the C++ struct `Light` with a `float` of padding after each `XMFLOAT3`; in `OnUpdate` set `light.position` = `lightPos`, `light.ambient` (0.2, 0.2, 0.2), `light.diffuse` (0.5, 0.5, 0.5) and `light.specular` (1.0, 1.0, 1.0).
- **Hint:** `ambient = light.ambient * material.ambient`, `lightDir = normalize(light.position - input.fragPos)`, `diffuse = light.diffuse * (diff * material.diffuse)`, `specular = light.specular * (spec * material.specular)`. The C++ `SceneConstantBuffer` becomes `view`, `projection`, `viewPos`, `padding0`, `material`, `light`.
- **When done:** `materials.hlsl`: `struct Light { float3 position; float3 ambient; float3 diffuse; float3 specular; };`,
  `SceneConstantBuffer` = `view`, `projection`, `viewPos`, `Material material;`, `Light light;` (no `lightPos` /
  `lightColor`), `PSMain` uses `light.*` as in the hint. `main.cpp`: `struct Light { XMFLOAT3 position; float padding0;
  XMFLOAT3 ambient; float padding1; XMFLOAT3 diffuse; float padding2; XMFLOAT3 specular; float padding3; };`,
  `SceneConstantBuffer { view; projection; XMFLOAT3 viewPos; float padding0; Material material; Light light; }` (256
  bytes); in `OnUpdate` `constantBufferData.light.position = lightPos;` and `// light properties` `light.ambient` (0.2),
  `light.diffuse` (0.5), `light.specular` (1.0); no `lightColor`. The cube looks **lit normally again**: left ≈
  51,26,16 (0.2 × coral), front ≈ 141,71,45, front-top-left ≈ 171,103,76, highlight ≈ 233,165,140 (a whitish
  highlight: the light's specular is white).

## light-color
- **Task:** Let the light's colour change over time: in `OnUpdate`, with the time since the first frame (`std::chrono`), `lightColor = (sin(t * 2.0), sin(t * 0.7), sin(t * 1.3))`, `diffuseColor = lightColor * 0.5`, `ambientColor = diffuseColor * 0.2`, and store them as `light.diffuse` / `light.ambient`.
- **Hint:** `XMFLOAT3 lightColor; lightColor.x = std::sin(time * 2.0f);` … then `XMVECTOR diffuseColor = XMLoadFloat3(&lightColor) * 0.5f; XMVECTOR ambientColor = diffuseColor * 0.2f;` and `XMStoreFloat3(&constantBufferData.light.ambient, ambientColor);` (the same for `diffuse`). The specular stays white.
- **When done:** in `OnUpdate`: `static auto startTime`, `float time = …count();`, `XMFLOAT3 lightColor` with
  `.x = std::sin(time * 2.0f)`, `.y = std::sin(time * 0.7f)`, `.z = std::sin(time * 1.3f)`, `XMVECTOR diffuseColor =
  XMLoadFloat3(&lightColor) * 0.5f;`, `XMVECTOR ambientColor = diffuseColor * 0.2f;`,
  `XMStoreFloat3(&constantBufferData.light.ambient, ambientColor)`, `XMStoreFloat3(&constantBufferData.light.diffuse,
  diffuseColor)`; `light.specular` stays (1, 1, 1). The cube's **colour changes over time**. At t = 1 s lightColor =
  (0.909, 0.644, 0.964): left ≈ 23,8,8, front ≈ 105,38,35, front-top-left ≈ 136,70,67, highlight ≈ 197,133,131 (a dark
  red-brown cube). The lamp stays white (its shaders ignore the light colour). Final state (= learnopengl's
  `materials.cpp`).

Optional exercise of the chapter (not a task): learnopengl's `materials_exercise1` – a **cyan plastic** cube: light
ambient/diffuse/specular all (1, 1, 1), material ambient (0.0, 0.1, 0.06), diffuse (0.0, 0.50980392, 0.50980392),
specular (0.50196078, 0.50196078, 0.50196078), shininess 32 (values from devernay.free.fr's material table).
