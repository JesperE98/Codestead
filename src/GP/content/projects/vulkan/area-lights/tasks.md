# Area Lights (Vulkan) – tasks

learnopengl "Guest Articles / Area Lights": `src/8.guest/2022/7.area_lights/1.area_light/area_lights.cpp` with
`7.area_light.vs/.fs` and `7.light_plane.vs/.fs`, then `2.multiple_area_lights/multiple_area_lights.cpp` with
`7.multi_area_light.fs` (the last task), and `ltc_matrix.hpp`. Files: `main.cpp`, `ltc_matrix.hpp` (next to `main.cpp`,
unchanged from `src/GP/content/textures/ltc/`), `textures/wood.png`, and in `shaders/` (each built to `<name>.spv`):
`area_light.vert/.frag` (the floor's LTC shading) and `light_plane.vert/.frag` (the light's rectangle, one colour). The
program is the course's Vulkan skeleton (camera globals, a uniform buffer at binding 0, push constants per draw, a depth
buffer, `createPipeline` called once per pipeline: `ltcPipeline` for the floor, `lightPlanePipeline` for the
rectangles).

**Screenshot time: 1.0 s** (nothing moves).

**Fixed choices (the same in every API, see `../../opengl/area-lights/tasks.md`):**
- **`ltc_matrix.hpp`**: the LTC tables `const float LTC1[]` and `LTC2[]` (64 × 64 texels × RGBA) from Heitz, Dupuy, Hill
  and Neubelt's `ltc_code` (BSD-style licence: the notice and the paper reference are at the top of the header).
- **The LTC textures** (`loadMTexture` / `loadLUTTexture`, learnopengl's names): `createFloatTexture(table, …)` copies a
  table through a staging buffer into a 64 × 64 **`VK_FORMAT_R32G32B32A32_SFLOAT`** image (16 bytes per texel; the
  numbers are outside 0…1, so no 8-bit format will do); row 0 of the table is the image's row 0 (v = 0) – the tables are
  not images, no flip. One sampler for both (`ltcSampler`): **`minFilter = NEAREST`, `magFilter = LINEAR`**,
  clamp-to-edge (learnopengl's). Linear filtering of 32-bit float images is optional in Vulkan: `createLTCSampler()`
  checks `VK_FORMAT_FEATURE_SAMPLED_IMAGE_FILTER_LINEAR_BIT` (lavapipe and desktop GPUs have it;
  `VK_FORMAT_R16G16B16A16_SFLOAT` would always be filterable, at half the precision).
- **Descriptor set** (one, bound once): binding 0 the uniform buffer (vertex + fragment), **binding 1 `LTC1`, binding 2
  `LTC2`, binding 3 the wood** – learnopengl's texture units 0, 1, 2. learnopengl's `struct Material { sampler2D diffuse;
  vec4 albedoRoughness; }` cannot be a uniform in Vulkan (no samplers in uniform blocks): `material.albedoRoughness` is in
  the uniform block, the texture is `diffuseMap` at binding 3.
- **The wood** is an **sRGB texture** (`VK_FORMAT_R8G8B8A8_SRGB`, learnopengl's `loadTexture(path, true)`), repeat,
  linear, anisotropic, no mipmaps (OpenGL uses mipmaps: single pixels of the boards differ by up to 17). The floor's
  texture coordinates are learnopengl's with **v flipped** (`1 - v`): OpenGL flips the image on load
  (`stbi_set_flip_vertically_on_load(true)`), Vulkan does not (v = 0 is the image's top row) – the boards lie the same
  way in both.
- **Uniform block** (std140): `view`, `proj`, `viewPosition` (+ 4 bytes of padding), `Material material` (`vec4
  albedoRoughness` = (SlateGray, 0.5): the colour is unused, w is the roughness), then learnopengl's light struct:
  `struct Light { float intensity; vec3 color; vec4 points[4]; bool twoSided; }` – std140 puts `color` at offset 16 and
  every array element 16 bytes apart, so the corners are `vec4` in the shader (`.xyz` used) and `glm::vec4` in C++; C++
  pads `intensity` with 3 floats and `color` with 1, a GLSL `bool` is a 4-byte `VkBool32`, the struct is 112 bytes. One
  light (`Light areaLight;`) until the last task, then `Light areaLights[32]; int numAreaLights;` (learnopengl's array of
  32, 8 used). The values are written every frame in `updateUniformBuffer()` (learnopengl sets them once: Vulkan's
  uniform buffer is rewritten each frame anyway).
- **Push constants** (vertex + fragment): `struct PushConstants { glm::mat4 model; glm::vec3 lightColor; }` – the model
  matrix of every draw and the rectangle's colour for `light_plane.frag`. learnopengl's `normalMatrix` uniform is
  `mat3(model)`: the vertex shader computes `mat3(pc.model) * aNormal` itself (the floor's model is the identity).
- **Scene (one light)**, learnopengl's: the floor (vertices 0..5 of `vertices`, ±10 at y = 0) and the light's rectangle
  (vertices 6..11, x = -8, y 0.4…2.4, z -1…1, facing +x) in one vertex buffer; the corners passed to the shader are
  vertices 6, 7, 10, 11 (learnopengl's 0, 1, 4, 5); colour **BurlyWood (0.870588, 0.721569, 0.529412)**, intensity
  **4.0**, two-sided; `mSpecular = ToLinear(vec3(0.23))`; output `ToSRGB(result)`. Camera (0, 1, 0.5), yaw 180, pitch 0
  (looking along -x), fov 45, 800/600, near 0.1, far 100, `proj[1][1] *= -1`; clear (0, 0, 0); depth test on; no culling.
- **Multiple lights** (the last task): learnopengl's `struct AreaLight { glm::vec3 offset; float yRotation; glm::vec3
  color; float intensity = 2.0f; bool twoSided = true; };` (the C++ table; the shader's struct keeps the name `Light`, so
  the two do not clash) with OpenGL's eight lights (offset 0, yRotation 45° · i, the course's colours); each light's
  corners = `translate(offset) * rotate(yRotation, y)` × the rectangle's corners, computed in `updateUniformBuffer()`;
  `recordCommandBuffer()` draws the eight rectangles with their model matrices and colours (push constants). Camera
  (-0.224556, 10.4038, -18.9259), yaw 89.3999, pitch -34.3001.

**What the camera sees (one light)** (lavapipe, 800×600): the light's rectangle a little right of the middle, the floor
below the horizon, black above. Named points (OpenGL's): **light** (400,263), **under** (400,380), **glossy**
(400,420), **near** (400,560), **left** (60,560), **right** (740,470), **sky** (400,100). For eight lights see the
last task. Every state is OpenGL's picture within 2 at the named points (single board pixels up to 17: the wood's
mipmaps).

**Start picture**: the floor's shader writes black (no light yet), only the light's rectangle shows: light =
222,184,135, all the other points 0,0,0.

## `ltc-textures`
- **Task:** Make the two LTC lookup tables of `ltc_matrix.hpp` into 64 × 64 float textures – `LTC1` (the inverse matrices) and `LTC2` (the BRDF's magnitude, Fresnel and the horizon-clipping sphere) – with a sampler that magnifies linearly and clamps at the edges, and put them into the descriptor set at bindings 1 and 2.
- **Hint:** `#include "ltc_matrix.hpp"`. `createFloatTexture(const float* table, VkImage&, VkDeviceMemory&, VkImageView&)`: a staging buffer of `64 * 64 * 4 * sizeof(float)` bytes, `memcpy(data, table, …)`, `createImage(64, 64, VK_FORMAT_R32G32B32A32_SFLOAT, …)`, the two layout transitions around `copyBufferToImage`, a view. `loadMTexture()` = `createFloatTexture(LTC1, ltc1Image, …)`, `loadLUTTexture()` with `LTC2`. `createLTCSampler()`: `magFilter = VK_FILTER_LINEAR`, `minFilter = VK_FILTER_NEAREST`, `VK_SAMPLER_ADDRESS_MODE_CLAMP_TO_EDGE`. Two more layout bindings (1, 2), three combined image samplers in the pool, two more descriptor writes; destroy everything in `cleanup()`.
- **When done:** `main.cpp`: `#include "ltc_matrix.hpp"`, `ltc1Image` / `ltc2Image` (memory, views), `ltcSampler`,
  `createFloatTexture`, `loadMTexture`, `loadLUTTexture`, `createLTCSampler` and their calls, bindings 1 and 2 in the
  layout, pool and set, their destruction. The shader does not use them yet: **no visible change**.

## `diffuse`
- **Task:** Light the floor with the light's diffuse part: in the fragment shader add learnopengl's `IntegrateEdgeVec` (the edge integral with the fitted acos) and `LTC_Evaluate` (rotate the light's corners into a frame around the normal, transform them by a matrix, normalise them, sum the four edge integrals, and take the form factor of the polygon – clipped at the horizon with the sphere value from `LTC2.w`; zero behind a one-sided light), and call it with the identity matrix – the plain cosine distribution, i.e. Lambert's diffuse light. The floor's colour is the texture times the light's colour, intensity and that integral.
- **Hint:** `layout(binding = 1) uniform sampler2D LTC1;`, `layout(binding = 2) uniform sampler2D LTC2;`, `LUT_SIZE = 64.0`, `LUT_SCALE = (LUT_SIZE - 1.0)/LUT_SIZE`, `LUT_BIAS = 0.5/LUT_SIZE` (sample at texel centres). In `LTC_Evaluate`: `T1 = normalize(V - N * dot(V, N)); T2 = cross(N, T1); Minv = Minv * transpose(mat3(T1, T2, N));`, `uv = vec2(z*0.5f + 0.5f, len) * LUT_SCALE + LUT_BIAS; float scale = texture(LTC2, uv).w;`. In `main`: copy the corners into a `vec3 points[4]` (`ubo.areaLight.points[k].xyz`), `vec3 diffuse = LTC_Evaluate(N, V, P, mat3(1), points, ubo.areaLight.twoSided); result = ubo.areaLight.color * ubo.areaLight.intensity * (mDiffuse * diffuse);`.
- **When done:** `area_light.frag`: the two samplers, the three constants, `IntegrateEdgeVec`, `LTC_Evaluate`, the
  diffuse term. **The floor lights up** in the light's warm colour, brightest just in front of the light: light =
  222,184,135, under = 139,87,48 (OpenGL 137,86,47), glossy = 94,59,32, near = 40,25,14, left = 38,24,13, right =
  47,30,16, sky = 0,0,0.

## `specular`
- **Task:** Add the light's glossy reflection: look the inverse LTC matrix up in `LTC1` by the roughness and the view angle (`sqrt(1 - dot(N, V))`), build `Minv` from its four numbers, evaluate the polygon with it, scale that by the Fresnel and shadowing terms from `LTC2` (`mSpecular * t2.x + (1 - mSpecular) * t2.y`), and add it to the diffuse part.
- **Hint:** `vec2 uv = vec2(ubo.material.albedoRoughness.w, sqrt(1.0f - dotNV)); uv = uv*LUT_SCALE + LUT_BIAS; vec4 t1 = texture(LTC1, uv); vec4 t2 = texture(LTC2, uv);`, `mat3 Minv = mat3(vec3(t1.x, 0, t1.y), vec3(0, 1, 0), vec3(t1.z, 0, t1.w));`, then `result = ubo.areaLight.color * ubo.areaLight.intensity * (specular + mDiffuse * diffuse);`.
- **When done:** `area_light.frag`: `uv`, `t1`, `t2`, `Minv`, `vec3 specular = LTC_Evaluate(N, V, P, Minv, …)`, the
  Fresnel line, the sum. **A soft, stretched reflection of the light** on the floor between the light and the camera:
  light = 222,184,135, under = 140,90,51 (OpenGL 139,89,51), glossy = 167,141,117, near = 81,70,59, left = 39,25,15,
  right = 49,32,19, sky = 0,0,0.

## `multiple-lights`
- **Task:** learnopengl's second demo: eight area lights. Describe each light by a struct (offset, rotation about y, colour, intensity 2, two-sided) in a table; the uniform block holds an array of lights and their number; every frame compute each light's four corners with its model matrix (`translate(offset) * rotate(yRotation, y)` applied to the rectangle's corners); in the shader loop over the lights and add up their diffuse and specular parts; draw every light's rectangle in its colour; and move the camera up and back to see the whole ring.
- **Hint:** Shader: `Light areaLights[32]; int numAreaLights;` in the block and `for (int i = 0; i < ubo.numAreaLights; i++) { … result += ubo.areaLights[i].color * ubo.areaLights[i].intensity * (specular + mDiffuse * diffuse); }` (`uv`, `t1`, `t2`, `Minv` stay outside the loop). C++: `struct AreaLight`, `const int NUM_AREA_LIGHTS = 8;`, `AreaLight areaLights[NUM_AREA_LIGHTS] = { { glm::vec3(0.0f), glm::radians(0.0f), glm::vec3(1.0f, 0.55f, 0.25f) }, … };`; in `updateUniformBuffer()` `ubo.areaLights[i].points[k] = model * glm::vec4(vertices[6 / 7 / 10 / 11].pos, 1.0f);`, colour, intensity, twoSided, and `ubo.numAreaLights = NUM_AREA_LIGHTS;`; in `recordCommandBuffer()` a loop with `constants.model = model; constants.lightColor = areaLights[i].color;` and `vkCmdDraw(commandBuffer, 6, 1, 6, 0)`; the camera at (-0.224556, 10.4038, -18.9259) with `cameraFront = (0.00865, -0.56356, 0.82605)` (yaw 89.3999, pitch -34.3001).
- **When done:** `area_light.frag`: `Light areaLights[32]; int numAreaLights;`, the loop. `main.cpp`: `struct AreaLight`,
  `NUM_AREA_LIGHTS = 8` and the table, `areaLights[32]` + `numAreaLights` in `UniformBufferObject`, the loops in
  `updateUniformBuffer()` and `recordCommandBuffer()`, the new camera values (no `LIGHT_COLOR` / `LIGHT_INTENSITY` any
  more). **A ring of eight coloured lights** on the floor seen from above and behind. Named points (OpenGL's): light-2
  (400,90) = 140,255,89, light-6 (395,360) = 204,102,255, light-0 (680,190) = 255,140,64, light-4 (118,190) =
  76,191,255, centre (470,260) = 47,30,19, front (400,450) = 119,67,80, floor-left (60,340) = 41,30,26, floor-right
  (740,340) = 61,29,22, below (400,550) = 0,0,0, top (400,20) = 0,0,0 – OpenGL's values exactly. This is the solution.
