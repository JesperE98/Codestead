# basic-lighting – DirectX 12

learnopengl.com "Basic Lighting": `basic_lighting_diffuse.cpp` (2.1), `basic_lighting_specular.cpp` (2.2) and exercise 1
(`basic_lighting_exercise1.cpp`, the moving light). Files: `main.cpp`, `basic_lighting.hlsl` (the lit cube),
`light_cube.hlsl` (the lamp).

Start (prepared from the Colors solution): the lit object's shaders are renamed to `basic_lighting.hlsl` (same
contents as `colors.hlsl`; both `D3DCompileFromFile` calls use the new name), and the vertex data is learnopengl's
**36 vertices with position + normal** (`struct Vertex { XMFLOAT3 position; XMFLOAT3 normal; }`, comment
`// positions // normals`). The vertex buffer view's stride is `sizeof(Vertex)` (24 bytes now), so the positions are
still read correctly; the input layout has only `POSITION`, the normal is a TODO in it. The lamp's pipeline state
shares the description (and later the input layout with the normal – an input layout may have more elements than a
vertex shader reads). Same camera as Colors (front-left: cameraPos (-3, 0, 3), cameraFront normalize(3.5, 0.4, -2.2),
yaw -32.2, pitch 5.5).

The constant buffer grows in this chapter; every new `float3` in the cbuffer gets an `XMFLOAT3` plus a `float
padding…` in the C++ struct (HLSL starts each of these float3 in a new 16-byte row). Its size is rounded up to 256
bytes by `CalculateConstantBufferByteSize`, so nothing else changes.

Pixel positions are in the 800×600 client area from the top left, at time = 1 s. D3D12 cannot run here: the colours
come from a software model of this code (the app's simulator) and agree with OpenGL's Mesa screenshots of the same
steps within one unit; a GPU may differ by a unit or two. Named points: **front** (302,370) = centre of the cube's
front face (+z, the face on the right), **front-top-left** (271,320), **highlight** (243,278) = upper-left corner
region of the front face where the specular highlight appears, **left** (163,370) = centre of the left face (−x, never
lit by this light), **lamp** (641,195), **background** (400,300) and (100,100) = 26,26,26 (clear colour 0.1).

Start picture = the Colors result: flat coral cube 255,128,79 everywhere (front, left, highlight), white lamp at
(641,195).

## ambient
- **Task:** Replace the flat colour by ambient lighting: in `PSMain` of `basic_lighting.hlsl` compute `ambient = 0.1 * lightColor` and return `ambient * objectColor`.
- **Hint:** `float ambientStrength = 0.1f; float3 ambient = ambientStrength * lightColor; float3 result = ambient * objectColor; return float4(result, 1.0f);`
- **When done:** `basic_lighting.hlsl` `PSMain` has `// ambient`, `float ambientStrength = 0.1f;`,
  `float3 ambient = ambientStrength * lightColor;`, `float3 result = ambient * objectColor;`,
  `return float4(result, 1.0f);`. The cube becomes **very dark coral 26,13,8** on every face (front, left,
  highlight); the lamp stays white (it has its own shaders).

## normals
- **Task:** Feed the normals to the shaders: add a `NORMAL` element to the input layout (3 floats at byte offset 12, after the position), give `VSMain` a second input `float3 normal : NORMAL`, and add `fragPos` (the world-space position) and `normal` to `PSInput`.
- **Hint:** `{ "NORMAL", 0, DXGI_FORMAT_R32G32B32_FLOAT, 0, 12, D3D12_INPUT_CLASSIFICATION_PER_VERTEX_DATA, 0 }`. In `PSInput`: `float3 fragPos : POSITION;` and `float3 normal : NORMAL;` (any semantic names except SV_… pass values on). In `VSMain`: `float4 worldPos = mul(position, model); result.fragPos = worldPos.xyz; result.normal = normal; result.position = mul(mul(worldPos, view), projection);` (learnopengl: `FragPos = vec3(model * vec4(aPos, 1.0))`, `gl_Position = projection * view * vec4(FragPos, 1.0)`).
- **When done:** `main.cpp`: the input layout has `{ "POSITION", … 0, … }` and `{ "NORMAL", 0,
  DXGI_FORMAT_R32G32B32_FLOAT, 0, 12, D3D12_INPUT_CLASSIFICATION_PER_VERTEX_DATA, 0 }`. `basic_lighting.hlsl`:
  `PSInput` has `float3 fragPos : POSITION;` and `float3 normal : NORMAL;`, `VSMain(float4 position : POSITION, float3
  normal : NORMAL)` sets `worldPos = mul(position, model)`, `result.fragPos = worldPos.xyz`, `result.normal = normal`,
  `result.position = mul(mul(worldPos, view), projection)`. **No visible change** (dark coral 26,13,8).

## diffuse
- **Task:** Add diffuse lighting: `float3 lightPos;` in the cbuffer (and `XMFLOAT3 lightPos; float padding2;` in the C++ struct, set to the global `lightPos` in `OnUpdate`), and in `PSMain` the light direction `normalize(lightPos - input.fragPos)`, `diff = max(dot(norm, lightDir), 0.0f)` and `result = (ambient + diffuse) * objectColor`.
- **Hint:** Normalize the interpolated normal first: `float3 norm = normalize(input.normal);`. `float3 diffuse = diff * lightColor;`. In `OnUpdate`: `constantBufferData.lightPos = lightPos;`
- **When done:** `basic_lighting.hlsl` has `float3 lightPos;` after `lightColor` in `SceneConstantBuffer` and the
  `// diffuse` block (`norm`, `lightDir`, `diff`, `diffuse`), `float3 result = (ambient + diffuse) * objectColor;`;
  `main.cpp`: `XMFLOAT3 lightPos; float padding2;` at the end of `SceneConstantBuffer`,
  `constantBufferData.lightPos = lightPos;` in `OnUpdate`. The **front face is lit** (it faces the lamp): front ≈
  202,101,63, front-top-left ≈ 198,99,61, highlight ≈ 192,96,59 (it varies smoothly over the face); the **left face
  stays dark** 26,13,8 (it faces away from the light: `diff` = 0, only ambient).

## normal-matrix
- **Task:** Transform the normals into world space correctly: add `XMFLOAT4X4 normalMatrix;` to `ModelConstants` (C++) and `float4x4 normalMatrix;` to the cbuffer `ModelConstants` (HLSL); in `PopulateCommandList` compute `normalMatrix = XMMatrixTranspose(XMMatrixInverse(nullptr, model))` for the cube and store it (transposed, like every matrix); in `VSMain` use `result.normal = mul(float4(normal, 0.0f), normalMatrix).xyz;`.
- **Hint:** The normal matrix (the transpose of the inverse of the model matrix) keeps normals perpendicular to the surface even under non-uniform scaling. HLSL has no `inverse()` (learnopengl's `mat3(transpose(inverse(model)))`), and inverting per vertex is expensive anyway – so the CPU computes it once per draw and sends it with the model matrix: 32 root constants now (`sizeof(ModelConstants) / 4` follows by itself; the root signature allows 64 32-bit values in all). w = 0 makes the normal a direction: the matrix's translation does not apply (the same as taking its upper-left 3×3).
- **When done:** `main.cpp`: `struct ModelConstants { XMFLOAT4X4 model; XMFLOAT4X4 normalMatrix; };`, after storing the
  cube's model: `XMMATRIX normalMatrix = XMMatrixTranspose(XMMatrixInverse(nullptr, model));` and
  `XMStoreFloat4x4(&modelConstants.normalMatrix, XMMatrixTranspose(normalMatrix));`. `basic_lighting.hlsl`: `float4x4
  normalMatrix;` after `model` in `ModelConstants`, `result.normal = mul(float4(normal, 0.0f), normalMatrix).xyz;`
  instead of `result.normal = normal;`. The lamp's draw sends the same struct (its shaders ignore `normalMatrix`). The
  cube's model matrix is the identity, so **nothing visible changes** (front ≈ 202,101,63).

## specular
- **Task:** Add specular lighting: `float3 viewPos;` in the cbuffer (C++: `XMFLOAT3 viewPos; float padding3;`, set from `cameraPos` in `OnUpdate`), and in `PSMain` `specularStrength = 0.5f`, the view direction, the reflected light direction, `spec = pow(max(dot(viewDir, reflectDir), 0.0f), 32)` and `result = (ambient + diffuse + specular) * objectColor`.
- **Hint:** `float3 viewDir = normalize(viewPos - input.fragPos); float3 reflectDir = reflect(-lightDir, norm);` (`reflect` expects the vector pointing from the light to the fragment). `cameraPos` is an `XMVECTOR`: `XMStoreFloat3(&constantBufferData.viewPos, cameraPos);`
- **When done:** `basic_lighting.hlsl` has `float3 viewPos;` after `lightPos` and the `// specular` block
  (`specularStrength = 0.5f`, `viewDir`, `reflectDir`, `spec` with exponent `32`, `specular = specularStrength * spec *
  lightColor`), `float3 result = (ambient + diffuse + specular) * objectColor;`; `main.cpp`: `XMFLOAT3 viewPos; float
  padding3;` in `SceneConstantBuffer`, `XMStoreFloat3(&constantBufferData.viewPos, cameraPos);` in `OnUpdate`. A
  **highlight** appears in the upper-left part of the front face: highlight (243,278) 192,96,59 → **255,145,90**,
  front-top-left 198,99,61 → 232,116,72; front centre ≈ 204,102,63 and the lower right of the face almost unchanged;
  left face 26,13,8. (= learnopengl's `basic_lighting_specular.cpp`.)

## moving-light
- **Task:** Exercise: move the light over time – in `OnUpdate`, before `lightPos` goes into the constant buffer, take the time since the first frame (`std::chrono`) and set `lightPos.x = 1.0f + std::sin(time) * 2.0f` and `lightPos.y = std::sin(time / 2.0f) * 1.0f`.
- **Hint:** `static auto startTime = std::chrono::high_resolution_clock::now(); float time = std::chrono::duration<float, std::chrono::seconds::period>(currentFrame - startTime).count();` right after the deltaTime lines. `OnUpdate` runs before `PopulateCommandList`, so the lamp's model matrix uses the new position too.
- **When done:** in `OnUpdate` after `lastFrame = currentFrame;`: `static auto startTime`, `float time = …count();`,
  `lightPos.x = 1.0f + std::sin(time) * 2.0f;`, `lightPos.y = std::sin(time / 2.0f) * 1.0f;`. The **lamp moves** (and
  the lighting on the cube with it). At t = 1 s: lightPos = (2.68, 0.48, 2.0), the lamp is at x ≈ 677..710, y ≈
  290..319 (centre (694,304) = 255,255,255), the old lamp point (641,195) is background; front ≈ 198,99,62,
  front-top-left ≈ 183,92,57, highlight ≈ 153,77,48 (the highlight moved off that point), left 26,13,8.
  Time-dependent: the lamp swings between x = −1 and 3 (period 2π s). Final state.

Optional exercises of the chapter (not tasks): play with the ambient/specular strengths and the shininess; do the
lighting in **view space** (learnopengl's `basic_lighting_exercise2`: positions and normals multiplied by `model` and
`view` in the vertex shader, the light position by `view`, `viewDir = normalize(-fragPos)` – the same picture);
**Gouraud shading** (exercise 3: compute the lighting in `VSMain` and pass the colour on – the highlight becomes
blocky, because the cube has only 4 vertices per face). The next chapter starts again with a fixed light.
