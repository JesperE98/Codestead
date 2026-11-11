# Area Lights – tasks (OpenGL)

learnopengl "Guest Articles / Area Lights": `src/8.guest/2022/7.area_lights/1.area_light/area_lights.cpp` with
`7.area_light.vs/.fs` and `7.light_plane.vs/.fs`, then `2.multiple_area_lights/multiple_area_lights.cpp` with
`7.multi_area_light.fs` (the last task), and `ltc_matrix.hpp`. Files: `main.cpp`, `shader_m.h` (the course's Shader
class), `area_light.vs/.fs` (the floor's LTC shading), `light_plane.vs/.fs` (the light's rectangle, one colour),
`ltc_matrix.hpp` and `wood.png`.

**Screenshot time: 1.0 s** (nothing moves).

**OpenGL 3.3 core**, like learnopengl's demo.

**Fixed choices (the same in every API):**
- **`ltc_matrix.hpp`** from `src/GP/content/textures/ltc/` (written by `make_ltc.py`): the LTC tables `const float
  LTC1[]` and `LTC2[]`, 64 × 64 texels × RGBA = 16,384 floats each, from Heitz, Dupuy, Hill and Neubelt's reference
  implementation `github.com/selfshadow/ltc_code` (`fit/results/ltc.js` – the same numbers as learnopengl's file). Its
  BSD-style licence allows redistribution with the copyright notice and a reference to the paper: both are at the top
  of the header (and in `textures/ltc/LICENSE-ltc_code.txt`). Copy the header unchanged next to `main.cpp`.
- **The LTC textures** (`loadMTexture` / `loadLUTTexture`, learnopengl's): 64 × 64, **`GL_RGBA32F`** with `GL_RGBA`,
  `GL_FLOAT` data (learnopengl passes the unsized `GL_RGBA` as the internal format, which stores 8-bit values clamped to
  0…1 – wrong for these tables; the course uses the float format the brief and the paper ask for), `GL_CLAMP_TO_EDGE`,
  min filter `GL_NEAREST`, mag filter `GL_LINEAR` (learnopengl's), LTC1 on unit 0, LTC2 on unit 1, the floor's texture on
  unit 2. Vulkan: `VK_FORMAT_R32G32B32A32_SFLOAT` images uploaded through a staging buffer, samplers with linear
  magnification / nearest minification and clamp-to-edge; D3D12: `DXGI_FORMAT_R32G32B32A32_FLOAT` uploaded with
  `UpdateSubresources`, a static sampler with `D3D12_FILTER_MIN_POINT_MAG_LINEAR_MIP_POINT`, clamp. The texture
  coordinate of texel (x, y) is row y = sqrt(1 - cos θ_view), column x = roughness – row 0 of the array is texture row
  0 (v = 0) in every API (no flip: the tables are not images).
- **Scene (one light)**, learnopengl's: the floor `planeVertices` (two triangles, ±10 in x and z at y = 0, normal +y,
  texture coordinates 0…1 – learnopengl's), `wood.png` as an **sRGB** texture (`GL_SRGB`, learnopengl's
  `loadTexture(path, true)` with its concrete texture – ours is the Advanced Lighting wood; mipmaps, `GL_REPEAT`), the
  light's rectangle `areaLightVertices` (x = -8, y 0.4 … 2.4, z -1 … 1, facing +x), the four corners passed to the
  shader as `areaLight.points[0..3]` = vertices 0, 1, 4, 5 (learnopengl's), **colour BurlyWood (0.870588, 0.721569,
  0.529412)** (learnopengl's `LIGHT_COLOR`), **intensity 4.0**, **two-sided** (learnopengl calls `switchTwoSided(false)`,
  which does not switch, so its light is two-sided), roughness **0.5** in `material.albedoRoughness.w` (the colour part
  SlateGray (0.439216, 0.501961, 0.564706) is not used by the shader), `mSpecular = ToLinear(vec3(0.23))`.
  `areaLightTranslate` (learnopengl moves the light with the arrow keys) is left out: no input.
- **Camera** (learnopengl's): position **(0, 1, 0.5)**, **yaw 180, pitch 0** (front (-1, 0, 0): looking along -x at the
  light), up (0, 1, 0), fov 45, 800/600, near 0.1, far 100. Clear (0, 0, 0). Depth test on.
- **Shaders**: learnopengl's `7.area_light.fs` (IntegrateEdgeVec with its fitted acos, LTC_Evaluate with the
  horizon-clipped sphere from LTC2.w, the Minv from LTC1, `specular *= mSpecular * t2.x + (1 - mSpecular) * t2.y`,
  `result = color * intensity * (specular + mDiffuse * diffuse)`, output `ToSRGB(result)` = pow(1/2.2)), the light's
  rectangle with `light_plane.fs` (`color = vec4(lightColor, 1.0)`, no gamma). The normal matrix as a uniform
  (`mat3(model)`, model = identity).
- **Multiple lights** (the last task, learnopengl's `multiple_area_lights.cpp`): **8 lights** (learnopengl: 16, placed
  and coloured at random with a time seed – the course uses a fixed table so every run and every API shows the same
  picture, and 8 so the simulator stays quick): `struct AreaLight { glm::vec3 offset; float yRotation; glm::vec3 color;
  float intensity = 4.0f; bool twoSided = true; };`, light i: offset (0, 0, 0), `yRotation = glm::radians(45.0f * i)`,
  colours (1.0, 0.55, 0.25), (1.0, 0.85, 0.3), (0.55, 1.0, 0.35), (0.3, 1.0, 0.75), (0.3, 0.75, 1.0), (0.4, 0.45, 1.0),
  (0.8, 0.4, 1.0), (1.0, 0.4, 0.65) – each light's model matrix `translate(offset) * rotate(yRotation, (0, 1, 0))` turns
  the base rectangle (at x = -8, facing +x) onto a ring of radius 8 around the middle, every light facing the middle;
  its corners `model * vertices 0, 1, 4, 5` are set once as `areaLights[i].points[0..3]`, intensity **2.0** for all
  (learnopengl's `setFloat(str_int, 2.0f)`), two-sided. `uniform AreaLight areaLights[32]; uniform int numAreaLights;`
  (learnopengl's array of 32, 8 used). Each rectangle is drawn in its own colour. The camera moves to learnopengl's
  multi-light view: **(-0.224556, 10.4038, -18.9259), yaw 89.3999, pitch -34.3001** (looking along +z, down at the
  ring). Vulkan/D3D12: the lights in the uniform / constant buffer (std140 / HLSL packing: vec3 → vec4 – say so).

- learnopengl's keys (R / I: roughness and intensity, B: two-sided, arrows: move the light, Space: wireframe) and its
  `incrementRoughness` / `incrementLightIntensity` / `switchTwoSided` helpers are left out: the values are set once
  after the shaders are built (`setVec4("material.albedoRoughness", glm::vec4(SLATE_GRAY, ROUGHNESS))`,
  `setFloat("areaLight.intensity", LIGHT_INTENSITY)`, `setBool("areaLight.twoSided", true)`). learnopengl's GPU time
  query of the multi-light demo is left out too.

**What the camera sees (one light)**: the light's rectangle a little right of the middle, above the horizon (x
355…535, y 173…353, BurlyWood – the camera stands at z = 0.5, the light spans z -1…1), the floor below the horizon (its far edge at y ≈ 372, the camera is 1 unit above it), black above.
Named points: **light** (400,263) (the rectangle), **under** (400,380) (the floor just in front of the light),
**glossy** (400,420) (where the light's reflection lies), **near** (400,560) (the floor near the camera), **left**
(60,560), **right** (740,470), **sky** (400,100) (nothing there: black).

**Start picture**: the floor's shader writes black (no light yet), only the light's rectangle shows: light =
222,184,135, all the other points 0,0,0.

## `ltc-textures`
- **Task:** Make the two LTC lookup tables of `ltc_matrix.hpp` into 64 × 64 float textures – `LTC1` (the inverse matrices) on texture unit 0 and `LTC2` (the BRDF's magnitude, Fresnel and the horizon-clipping sphere) on unit 1 – with linear magnification and clamping at the edges, and tell the floor's shader where they are.
- **Hint:** `glTexImage2D(GL_TEXTURE_2D, 0, GL_RGBA32F, 64, 64, 0, GL_RGBA, GL_FLOAT, LTC1);` – a float internal format: the numbers are outside 0…1. `GL_NEAREST` for minification, `GL_LINEAR` for magnification (learnopengl's), `GL_CLAMP_TO_EDGE`. In the loop: `glActiveTexture(GL_TEXTURE0); glBindTexture(GL_TEXTURE_2D, mLTC.mat1);` and the same for unit 1, before the floor's texture on unit 2.
- **When done:** `main.cpp`: `#include "ltc_matrix.hpp"`, `struct LTC_matrices { unsigned int mat1; unsigned int mat2; };`,
  `loadMTexture()` / `loadLUTTexture()` (`GL_RGBA32F`, 64 × 64, `LTC1` / `LTC2`), `mLTC.mat1 = loadMTexture(); mLTC.mat2 =
  loadLUTTexture();`, `shaderLTC.setInt("LTC1", 0); shaderLTC.setInt("LTC2", 1);`, the binds on units 0 and 1 in the
  loop, their deletion. The shader does not use them yet: **no visible change**.

## `diffuse`
- **Task:** Light the floor with the light's diffuse part: in the fragment shader add learnopengl's `IntegrateEdgeVec` (the edge integral with the fitted acos) and `LTC_Evaluate` (rotate the light's corners into a frame around the normal, transform them by a matrix, normalise them, sum the four edge integrals, and take the form factor of the polygon – clipped at the horizon with the sphere value from `LTC2.w`; zero behind a one-sided light), and call it with the identity matrix – the plain cosine distribution, i.e. Lambert's diffuse light. The floor's colour is the texture times the light's colour, intensity and that integral.
- **Hint:** `uniform sampler2D LTC1; uniform sampler2D LTC2;`, `LUT_SIZE = 64.0`, `LUT_SCALE = (LUT_SIZE - 1.0) / LUT_SIZE`, `LUT_BIAS = 0.5 / LUT_SIZE` (sample at texel centres). In `LTC_Evaluate`: `T1 = normalize(V - N * dot(V, N)); T2 = cross(N, T1); Minv = Minv * transpose(mat3(T1, T2, N));`, `uv = vec2(z * 0.5 + 0.5, len) * LUT_SCALE + LUT_BIAS; float scale = texture(LTC2, uv).w;`. In `main`: `vec3 diffuse = LTC_Evaluate(N, V, P, mat3(1), areaLight.points, areaLight.twoSided); result = areaLight.color * areaLight.intensity * (mDiffuse * diffuse);`.
- **When done:** `area_light.fs`: the samplers, the three constants, `IntegrateEdgeVec`, `LTC_Evaluate`, the diffuse
  term. **The floor lights up** in the light's warm colour, brightest just in front of the light, fading towards the
  camera (wood boards visible; the output is gamma-corrected with ToSRGB): light = 222,184,135, under = 137,86,47,
  glossy = 94,59,32, near = 40,25,14, left = 38,24,13, right = 47,30,16, sky = 0,0,0.

## `specular`
- **Task:** Add the light's glossy reflection: look the inverse LTC matrix up in `LTC1` by the roughness and the view angle (`sqrt(1 - dot(N, V))`), build `Minv` from its four numbers, evaluate the polygon with it, scale that by the Fresnel and shadowing terms from `LTC2` (`mSpecular * t2.x + (1 - mSpecular) * t2.y`), and add it to the diffuse part.
- **Hint:** `vec2 uv = vec2(material.albedoRoughness.w, sqrt(1.0f - dotNV)) * LUT_SCALE + LUT_BIAS; vec4 t1 = texture(LTC1, uv); vec4 t2 = texture(LTC2, uv);`, `mat3 Minv = mat3(vec3(t1.x, 0, t1.y), vec3(0, 1, 0), vec3(t1.z, 0, t1.w));`, then `result = areaLight.color * areaLight.intensity * (specular + mDiffuse * diffuse);`.
- **When done:** `area_light.fs`: `uv`, `t1`, `t2`, `Minv`, `vec3 specular = LTC_Evaluate(N, V, P, Minv, …)`, the Fresnel
  line, the sum. **A soft, stretched reflection of the light** appears on the floor between the light and the camera
  (roughness 0.5: blurred, whitish): light = 222,184,135, under = 139,89,51, glossy = 167,141,117, near = 81,70,59, left
  = 39,25,15, right = 49,32,19, sky = 0,0,0.

## `multiple-lights`
- **Task:** learnopengl's second demo: eight area lights. Describe each light by a struct (offset, rotation about y, colour, intensity 2, two-sided), compute each one's four corners once with its model matrix (`translate(offset) * rotate(yRotation, y)` applied to the rectangle's corners) and pass them as `areaLights[i]`; in the shader loop over the lights and add up their diffuse and specular parts; draw every light's rectangle in its colour; and move the camera up and back to see the whole ring.
- **Hint:** `uniform AreaLight areaLights[32]; uniform int numAreaLights;` and `for (int i = 0; i < numAreaLights; i++) { … result += areaLights[i].color * areaLights[i].intensity * (specular + mDiffuse * diffuse); }` (`uv`, `t1`, `t2`, `Minv` stay outside the loop: they do not depend on the light). In C++: `std::string str_pos = "areaLights[" + std::to_string(i) + "].points";` and `shaderLTC.setVec3(str_pos + "[0]", p0);` …; the camera at (-0.224556, 10.4038, -18.9259) with yaw 89.3999, pitch -34.3001 (`cameraFront = (0.00865, -0.56356, 0.82605)`).
- **When done:** `area_light.fs`: `struct AreaLight` (was `Light`), `uniform AreaLight areaLights[32]; uniform int
  numAreaLights;`, the loop. `main.cpp`: `struct AreaLight { glm::vec3 offset; float yRotation; glm::vec3 color; float
  intensity = 2.0f; bool twoSided = true; };`, `const int NUM_AREA_LIGHTS = 8;` and the table (see above), the
  configuration loop (`str_pos`, `str_col`, `str_int`, `str_two`, `setBool`), `setInt("numAreaLights",
  NUM_AREA_LIGHTS)`, the rectangle loop (`model` per light, `setVec3("lightColor", areaLights[i].color)`), the new
  camera values (no `LIGHT_COLOR` / `LIGHT_INTENSITY` any more). **A ring of eight coloured lights** stands on the
  floor seen from above and behind, each lighting the boards in front of it in its colour, with glossy reflections
  between the lights and the camera. Named points: **light-2** (400,90) (the far light, (0.55, 1, 0.35)), **light-6**
  (395,360) (the near one, (0.8, 0.4, 1)), **light-0** (680,190) (on the right, (1, 0.55, 0.25)), **light-4** (118,190)
  (on the left, (0.3, 0.75, 1)), **centre** (470,260) (the floor in the middle of the ring), **front** (400,450) (the
  floor between the nearest light and the camera: its reflection), **floor-left** (60,340), **floor-right** (740,340),
  **below** (400,550) (under the floor's near edge: black), **top** (400,20): light-2 = 140,255,89, light-6 =
  204,102,255, light-0 = 255,140,64, light-4 = 76,191,255, centre = 47,30,19, front = 119,67,80, floor-left = 41,30,26,
  floor-right = 61,29,22, below = 0,0,0, top = 0,0,0. This is the solution.
