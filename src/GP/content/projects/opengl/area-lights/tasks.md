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

(Tasks and pixel values follow.)
