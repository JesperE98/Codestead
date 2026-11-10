# light-casters – DirectX 12

learnopengl.com "Light casters": `light_casters_directional.cpp` (5.1), `light_casters_point.cpp` (5.2),
`light_casters_spot.cpp` (5.3) and `light_casters_spot_soft.cpp` (5.4). Files: `main.cpp`, `light_casters.hlsl`,
`light_cube.hlsl`, `container2.png`, `container2_specular.png`.

Start (prepared from the Lighting Maps solution without the emission exercise): the lit object's shaders are renamed
to `light_casters.hlsl` (diffuse + specular map, `Light { position; ambient; diffuse; specular; }`), `matrix.png`,
`m_emissionMap` and `emissionMap` are gone (heap: 3 descriptors, SRV range of 2). New in the start: learnopengl's
**ten containers** – `XMFLOAT3 cubePositions[]` (the ten positions of Coordinate Systems) in `PopulateCommandList` and
a `for` loop that draws each with `model = XMMatrixRotationAxis((1.0, 0.3, 0.5), 20° · i) * XMMatrixTranslation(cubePositions[i])`
(no time-dependent rotation, as in learnopengl) and its own normal matrix, all lit by the point light at
`lightPos (1.2, 1, 2)` with `light.ambient` 0.2, `light.diffuse` 0.5, `light.specular` 1.0, `material.shininess` 64;
the lamp is drawn as before (its `XMMATRIX model` is declared in its own block now, after the loop).

**Camera back to learnopengl's (0, 0, 3)** for this chapter and Multiple Lights (the same in every API):
`cameraPos = XMVectorSet(0.0f, 0.0f, 3.0f, 0.0f)`, `cameraFront = XMVectorSet(0.0f, 0.0f, -1.0f, 0.0f)`, `yaw =
-90.0f`, `pitch = 0.0f` (comment `// camera: back at (0, 0, 3) looking down -z, so all ten containers are in view`),
so the containers are in view and the flashlight (at the camera) lights container 0 in the centre. The lamp at
(1.2, 1, 2) is then **outside the window** (to the right of the camera); the lamp's draw call is still part of the
steps below, but no lamp pixels are visible.

HLSL notes: `linear` is a keyword of HLSL (an interpolation modifier), so learnopengl's attenuation fields `constant`,
`linear`, `quadratic` are called `constantTerm`, `linearTerm`, `quadraticTerm` in the shader and the C++ struct, and the
local `distance` is `dist` (`distance` is an HLSL function). The `Light` fields keep learnopengl's order except that
the attenuation terms come right after `position` / `direction` / the cut-offs (as in learnopengl's `SpotLight` of
Multiple Lights): there they fill the 16-byte row after a `float3`, so every `float3` starts a row and the C++ padding
is simple. The C++ `Light` struct is replaced as a whole in each step; its fields have the same byte offsets as HLSL's
in every step.

Pixel positions are in the 800×600 client area from the top left, at time = 1 s (nothing depends on time). D3D12
cannot run here: the colours come from a software model of this code (the app's simulator; bilinear filtering, one mip
level as in the code) and agree with OpenGL's Mesa screenshots of the same steps within a few units (OpenGL's mipmaps
make far or slanted containers a little different). Container 0 faces the camera: its front face is x ≈ 255..545,
y ≈ 155..445 (wood inside a steel frame). Named points: **centre** (400,300) = wood of container 0, **frame** (265,300)
= the left steel frame of container 0, **top-frame** (400,165), **corner** (262,162) = top-left corner of container 0
(outside the flashlight's inner cone), **right-edge** (560,300) = the container just right of container 0, **c8**
(640,260), **c7** (600,70), **c9** (191,139), **far** (483,100) = a far container (top), **background** (400,520) and
(30,300) = 26,26,26.

Start picture: centre ≈ 82,54,28, frame ≈ 76,77,80, top-frame ≈ 86,88,91, c8 ≈ 62,43,23, c7 ≈ 93,60,32, c9 ≈ 88,57,30,
far ≈ 104,68,36 (no attenuation yet: far containers are as bright as near ones).

## directional
- **Task:** Turn the light into a directional light: the HLSL and C++ `Light` get `direction` instead of `position` (keep `position` as a comment), `lightDir = normalize(-light.direction)`; in `OnUpdate` set `light.direction` to (-0.2, -1.0, -0.3) instead of `light.position`, and shininess 32. A directional light has no position, so comment out the lamp's drawing.
- **Hint:** The direction points from the light towards the scene; the lighting maths wants the direction towards the light, hence the minus. `constantBufferData.light.direction = XMFLOAT3(-0.2f, -1.0f, -0.3f);` The C++ struct keeps its layout: `XMFLOAT3 direction; float padding0;` in place of the position.
- **When done:** `light_casters.hlsl`: `struct Light { // float3 position; … float3 direction; float3 ambient; float3
  diffuse; float3 specular; };`, `float3 lightDir = normalize(-light.direction);`. `main.cpp`: `struct Light { //
  XMFLOAT3 position; … XMFLOAT3 direction; float padding0; … }`, `constantBufferData.light.direction =
  XMFLOAT3(-0.2f, -1.0f, -0.3f);` (no `light.position`), `material.shininess = 32.0f`; the lamp's five lines in
  `PopulateCommandList` commented out (comment: a lamp object is weird with only a directional light) – one draw per
  container only. All containers are lit **from above, the same everywhere**: the front faces facing the camera get
  little light – centre ≈ 51,33,18, frame ≈ 51,52,54, c8 ≈ 30,21,11, c7 ≈ 30,20,10, far ≈ 31,20,11; faces turned upwards
  are brighter, e.g. c9 ≈ 79,53,30.

## point-light
- **Task:** Back to a point light, now with attenuation: `Light` gets `position` again, right after it `float constantTerm, linearTerm, quadraticTerm;`, then the three colours; the pixel shader multiplies ambient, diffuse and specular by `1.0 / (constantTerm + linearTerm * d + quadraticTerm * d²)`; set the terms to 1.0, 0.09, 0.032 (a range of about 50 units), `light.position` = `lightPos` again, and draw the lamp again.
- **Hint:** `float dist = length(light.position - input.fragPos); float attenuation = 1.0f / (light.constantTerm + light.linearTerm * dist + light.quadraticTerm * (dist * dist));` then `ambient *= attenuation; diffuse *= attenuation; specular *= attenuation;`. C++: `XMFLOAT3 position; float constantTerm; float linearTerm; float quadraticTerm; float padding0[2];` then `ambient`, `diffuse`, `specular` with a `float` each – the three floats fill the row of `position` and the next row up to byte 24, and `ambient` (12 bytes) does not fit in the remaining 8, so HLSL starts it at byte 32.
- **When done:** `light_casters.hlsl`: `struct Light { float3 position; float constantTerm; float linearTerm; float
  quadraticTerm; float3 ambient; float3 diffuse; float3 specular; };`, `lightDir = normalize(light.position -
  input.fragPos)`, the `// attenuation` block before `result`. `main.cpp`: the C++ `Light` of the hint,
  `constantBufferData.light.position = lightPos;`, `light.constantTerm = 1.0f`, `light.linearTerm = 0.09f`,
  `light.quadraticTerm = 0.032f`; the lamp block active again (lamp off-screen with this camera). Near containers lit,
  **far ones fade out**: centre ≈ 61,40,21, frame ≈ 54,54,57, top-frame ≈ 66,67,70, c8 ≈ 39,28,14, c7 ≈ 48,31,17,
  c9 ≈ 50,33,17, far (483,100) ≈ **9,6,3** (almost black). (= learnopengl's `light_casters_point.cpp`.)

## spotlight
- **Task:** Make the light a flashlight at the camera: `Light` gets `float3 direction; float cutOff;` after `position`; the pixel shader computes `theta = dot(lightDir, normalize(-light.direction))` and lights the fragment only if `theta > light.cutOff`, otherwise only ambient. In `OnUpdate` set `light.position` = `cameraPos`, `light.direction` = `cameraFront`, `light.cutOff` = `cos(12.5°)`, ambient 0.1, diffuse 0.8; comment out the lamp again.
- **Hint:** Compare cosines, not angles: `constantBufferData.light.cutOff = std::cos(XMConvertToRadians(12.5f));` – a bigger cosine means a smaller angle, hence `>`. `XMStoreFloat3(&constantBufferData.light.position, cameraPos);` (the same for `direction` with `cameraFront`). Sample the two maps once before the `if` (`diffuseColor`, `specularColor`): `Sample` computes the texture's level of detail from neighbouring pixels, which must not take another branch. Do not attenuate the ambient term inside the cone, or the inside could get darker than the outside. C++ layout: `position, padding0, direction, cutOff, constantTerm, linearTerm, quadraticTerm, padding1, ambient, padding2, diffuse, padding3, specular, padding4`.
- **When done:** `light_casters.hlsl`: `struct Light { float3 position; float3 direction; float cutOff; float
  constantTerm; float linearTerm; float quadraticTerm; float3 ambient; float3 diffuse; float3 specular; };`, `PSMain`
  computes `lightDir`, `diffuseColor`, `specularColor` and `theta`, then `if (theta > light.cutOff)` { ambient,
  diffuse, specular, attenuation of diffuse and specular (`// ambient *= attenuation;` commented with learnopengl's
  reason), `return float4(result, 1.0f);` } `else` { `return float4(light.ambient * diffuseColor, 1.0f);` }.
  `main.cpp`: the C++ `Light` of the hint, `XMStoreFloat3(&constantBufferData.light.position, cameraPos)`,
  `XMStoreFloat3(&constantBufferData.light.direction, cameraFront)`, `light.cutOff = std::cos(XMConvertToRadians(12.5f))`,
  `light.ambient` 0.1, `light.diffuse` 0.8 (with learnopengl's comment), the lamp block commented out. A **round,
  hard-edged spot of light** in the middle of container 0, everything else dim: centre ≈ 112,77,47, frame (265,300) ≈
  112,114,118, top-frame ≈ 112,114,118; the corner (262,162) ≈ 15,15,16 (outside the circle: ambient only), right-edge
  ≈ 58,38,20, other containers ≈ 12..15 (c8 ≈ 12,9,4, c9 ≈ 13,9,5).

## soft-edges
- **Task:** Smooth the spotlight's edge: an `outerCutOff` (cos 17.5°) after `cutOff` – `intensity = clamp((theta - outerCutOff) / (cutOff - outerCutOff), 0.0, 1.0)` scales diffuse and specular; replace the if/else by this (ambient, diffuse, specular, intensity, attenuation for all three, as in learnopengl's 5.4).
- **Hint:** Inside the inner cone intensity is 1, outside the outer cone 0, in between it fades linearly. `constantBufferData.light.outerCutOff = std::cos(XMConvertToRadians(17.5f));`. With no branch the maps are sampled where they are used again. In the C++ struct `outerCutOff` takes the place of `padding1`: it and the three terms fill the row after `direction`/`cutOff` (learnopengl's `SpotLight` order).
- **When done:** `light_casters.hlsl`: `float outerCutOff;` after `cutOff`; `PSMain` without `if`: ambient, diffuse,
  specular, `// spotlight (soft edges)` (`theta`, `epsilon = (light.cutOff - light.outerCutOff)`, `intensity =
  clamp((theta - light.outerCutOff) / epsilon, 0.0f, 1.0f)`, `diffuse *= intensity; specular *= intensity;`),
  `// attenuation` of all three terms, `result`. `main.cpp`: C++ `Light` = `position, padding0, direction, cutOff,
  outerCutOff, constantTerm, linearTerm, quadraticTerm, ambient, padding1, diffuse, padding2, specular, padding3`;
  `constantBufferData.light.outerCutOff = std::cos(XMConvertToRadians(17.5f));`. The spot's **edge fades softly**:
  centre ≈ 107,75,45, frame ≈ 108,109,113, the corners of container 0 now in the soft zone – (262,162) ≈ 54,55,57,
  (538,162) ≈ 53,54,56 – right-edge ≈ 51,33,18; the other containers almost black (ambient is now attenuated too: c8,
  c7 ≈ 6,4,2, c9 ≈ 7,5,2, far ≈ 3,2,1). Final state (= learnopengl's `light_casters_spot_soft.cpp`).
