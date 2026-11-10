# PBR Lighting – tasks (OpenGL)

learnopengl "PBR / Lighting": `src/6.pbr/1.1.lighting` (`lighting.cpp`, `1.1.pbr.vs/.fs`), then `1.2.lighting_textured`
for the last task. Files: `main.cpp`, `shader_m.h`, `pbr.vs`, `pbr.fs` and the material's five maps `albedo.png`,
`normal.png`, `metallic.png`, `roughness.png`, `ao.png` (256×256 RGB: riveted steel plates with patches of rust; only
the last task uses them).

**Fixed choices for the whole PBR part (`pbr-theory`, `pbr-lighting`, `diffuse-irradiance`, `specular-ibl`), the same in
every API:**
- Window 800×600, no multisampling (learnopengl asks for 4 samples; the course leaves that out so the three APIs match).
- **Camera: (0, 0, 22) looking down -z** (yaw -90, pitch 0, fov 45, 800/600, near 0.1, far 100), fixed. learnopengl's
  camera starts at (0, 0, 3), in the middle of the grid. The camera globals of the earlier chapters (`cameraPos`,
  `cameraFront`, `cameraUp`, `fov`) instead of learnopengl's `Camera` class; view and projection are set every frame.
- Sphere: learnopengl's `renderSphere()` UV sphere, radius 1, **24 × 24 segments** (learnopengl 64 × 64; a real GPU
  draws those just as easily, the course's simulator runs on the CPU), an indexed triangle strip (25 × 25 vertices, 1200
  indices, `glDrawElements(GL_TRIANGLE_STRIP, …)`), per vertex position, normal (= position), uv (xSegment, ySegment)
  and a **tangent** (-sin(2π·xSegment), 0, cos(2π·xSegment)) at location 3 – the direction in which u grows; it is
  there from the start and used by the textured task. 11 floats per vertex. No culling.
- The grid: 7 × 7 spheres at ((col - 3) · 2.5, (row - 3) · 2.5, **0**) (learnopengl's IBL demos put them at z = -2: the
  course keeps z = 0 in all chapters); `metallic = row / 7` (bottom row 0, top row 0.857), `roughness = clamp(col / 7,
  0.05, 1.0)` (left column 0.05, right column 0.857), albedo (0.5, 0.0, 0.0), ao 1.0. `normalMatrix =
  transpose(inverse(mat3(model)))` is set per sphere as a `mat3` uniform (learnopengl's way).
- Four lights at (-10, 10, 10), (10, 10, 10), (-10, -10, 10), (10, -10, 10), colour (300, 300, 300), set every frame as
  `lightPositions[i]` / `lightColors[i]`. learnopengl also draws a small sphere at each light; with this camera they
  are outside the view, so the course does not draw them.
- Clear colour (0.1, 0.1, 0.1) (in the IBL chapters the background covers it). Depth test on.
- **The textured spheres** (last task of `pbr-lighting` and of `specular-ibl`): a **3 × 3 grid** of large spheres:
  `nrRows = 3`, `nrColumns = 3`, `spacing = 6.0`, each `translate((col - 1) · 6, (row - 1) · 6, 0) · rotate(90° about
  +y) · scale(2.4)`. The rotation turns the middle of the textures (u = 0.5: the cross of the plate grooves with four
  rivets around it) towards the camera. The same four lights (learnopengl's 1.2 demo keeps the 7 × 7 grid and uses one
  light of 150 at (0, 0, 10)). The five maps are loaded linear (`GL_RGB`, mipmaps, `GL_REPEAT`,
  `GL_LINEAR_MIPMAP_LINEAR`, flipped on load: the earlier chapters' `loadTexture`); the albedo is converted in the
  shader with `pow(…, vec3(2.2))` (learnopengl's way); metallic, roughness and ao are read from the red channel; the
  normal comes from the normal map through a TBN matrix built in the fragment shader from the interpolated vertex
  normal and tangent: `T = normalize(T - dot(T, N) * N)`, `B = cross(N, T)`, `N_world = normalize(mat3(T, B, N) *
  (texel * 2 - 1))`. The uv of the sphere has v = 0 at the top (y = +1), so with the flipped images the textures appear
  turned by 180° (not mirrored) – `B = cross(N, T)` points where v grows, which is the normal map's +y.
- IBL numbers (the simulator runs on the CPU): environment cube map 128² per face (learnopengl 512²), irradiance map
  32² with `sampleDelta = 0.1` (0.025), pre-filter map 64² with 5 mip levels and `SAMPLE_COUNT = 128u` (128², 1024),
  BRDF LUT 128² with `SAMPLE_COUNT = 128u` (512², 1024); `resolution = 128.0` in prefilter.fs.
- What the window shows in the intermediate IBL tasks: after `irradiance-map` the **background is the irradiance map**
  (the background shader unchanged: `textureLod(environmentMap, WorldPos, 0.0)`, Reinhard, gamma); after
  `prefilter-map` the **background is the pre-filter map at mip level 1.2** (`textureLod(environmentMap, WorldPos, 1.2)`);
  after `brdf-lut` the **LUT texture covers the whole window**: a screen quad that samples the 128² texture
  (bilinear, clamp to edge) and writes `vec4(lut.r, lut.g, 0.0, 1.0)` as is (no tone mapping, no gamma) – NdotV grows
  from left (0) to right (1), roughness from the bottom (0) to the top (1). After `specular` the background is the
  environment map again.

**This chapter.** Start: learnopengl's pbr.vs and the skeleton of pbr.fs – the inputs, the uniforms, `N`, `V`, `Lo =
vec3(0.0)`, the ambient term `vec3(0.03) * albedo * ao` and `FragColor = vec4(color, 1.0)`. TODOs: the three BRDF
functions, the light loop, the tone mapping. `main.cpp` is complete for the first five tasks (it already sets
`metallic`, `roughness`, the lights and `camPos`; uniforms the shader does not use yet are ignored).

Pixels measured with Mesa (llvmpipe), coordinates from the top left of the 800×600 window; nothing depends on time.
The spheres' centres are at x = 153, 235, 318, 400, 482, 565, 647 (col 0..6) and y = 547, 465, 382, 300, 218, 135, 53
(row 0..6, row 0 at the bottom); each is about 66 pixels wide (the centre one covers x 367..432, y 267..332; a corner
one about 68). 174,592 pixels belong to spheres in every state of the 7 × 7 grid. Named points:
**background** (20,20) and **gap** (359,259) (between four spheres) = 26,26,26 in every state of the 7 × 7 grid;
sphere centres **c00** (153,547) (bottom left: non-metal, smooth), **c03** (400,547), **c06** (647,547) (bottom right:
non-metal, rough), **c33** (400,300), **c60** (153,53) (top left: metal, smooth), **c63** (400,53), **c66** (647,53)
(top right: metal, rough); highlight points (where one light's reflection sits in the finished shader): **h00**
(162,537) on sphere (row 0, col 0), **h02** (326,535), **h33** (411,288), **h60** (165,47), **h62** (331,46); edge points
**e33** (400,270) (top of the centre sphere) and **e66** (647,26).

**Start picture:** nearly black spheres on the grey clear colour: every sphere pixel = 4,0,0 (the ambient term
(0.015, 0, 0) written without gamma correction), background = 26,26,26.

## `lambert`
- **Task:** Write the light loop in `pbr.fs`: for each of the four lights compute the light direction `L`, the radiance that arrives (`lightColors[i]` times the attenuation `1.0 / (distance * distance)`) and `NdotL`, and add the diffuse (Lambert) reflection `albedo / PI * radiance * NdotL` to `Lo`.
- **Hint:** `for(int i = 0; i < 4; ++i) { vec3 L = normalize(lightPositions[i] - WorldPos); float distance = length(lightPositions[i] - WorldPos); float attenuation = 1.0 / (distance * distance); vec3 radiance = lightColors[i] * attenuation; float NdotL = max(dot(N, L), 0.0); Lo += (albedo / PI) * radiance * NdotL; }` – dividing by π is the Lambertian BRDF; the lights' 300 is so large because the squared distance (about 300) eats it.
- **When done:** `pbr.fs`: the `for(int i = 0; i < 4; ++i)` loop with `L`, `distance`, `attenuation = 1.0 / (distance * distance)`, `radiance = lightColors[i] * attenuation`, `NdotL = max(dot(N, L), 0.0)` and `Lo += (albedo / PI) * radiance * NdotL;`. The spheres are **matt red**, all 49 alike (metallic and roughness are not used yet), brighter towards the grid's corners (closer to a light), only the red channel: c00 = 138,0,0, c03 = 108,0,0, c06 = 140,0,0, c33 = 97,0,0, c60 = 137,0,0, c63 = 108,0,0, c66 = 138,0,0, h33 = 86,0,0, h02 = 88,0,0, h62 = 95,0,0, e33 = 71,0,0, e66 = 129,0,0; background = 26,26,26. No pixel is saturated.

## `ndf`
- **Task:** Add the normal distribution function `DistributionGGX(N, H, roughness)` (Trowbridge-Reitz GGX) and use it: compute the halfway vector `H` in the loop and, for now, add the NDF alone as the specular term: `vec3 specular = vec3(NDF);`, `Lo += (albedo / PI + specular) * radiance * NdotL;`.
- **Hint:** learnopengl's function: `float a = roughness*roughness; float a2 = a*a; float NdotH = max(dot(N, H), 0.0); float NdotH2 = NdotH*NdotH; float denom = (NdotH2 * (a2 - 1.0) + 1.0); denom = PI * denom * denom; return a2 / denom;` (the roughness is squared first: that looks more natural). `vec3 H = normalize(V + L);`.
- **When done:** `pbr.fs`: `float DistributionGGX(vec3 N, vec3 H, float roughness)` as learnopengl writes it; in the loop `vec3 H = normalize(V + L);`, `float NDF = DistributionGGX(N, H, roughness);`, `vec3 specular = vec3(NDF);` and `Lo += (albedo / PI + specular) * radiance * NdotL;`. **Glaring white highlights that grow with the roughness**, the same in every row: in the left column (roughness 0.05) four tiny white dots per sphere (h00 = 255,255,255, h60 = 255,255,255; the sphere's centre stays c00 = 138,0,0, c60 = 137,0,0), in the middle four fat white blobs (h33 = 255,255,255, h02 = 255,255,255, h62 = 255,255,255, between them c33 = 192,95,95, c03 = 240,131,131, c63 = 240,132,132, e33 = 86,15,15), on the right the whole sphere is white (c06 = 255,255,255, c66 = 255,255,255, e66 = 255,255,255). 39,270 pixels are pure white (57,188 have red = 255). Background = 26,26,26. Nothing limits the NDF yet, so the spheres reflect far more light than arrives.

## `geometry`
- **Task:** Add the geometry function – `GeometrySchlickGGX(NdotV, roughness)` with `k = (roughness + 1)² / 8` and `GeometrySmith(N, V, L, roughness)` – and make the specular term `NDF * G / (4 * NdotV * NdotL + 0.0001)`.
- **Hint:** `float r = (roughness + 1.0); float k = (r*r) / 8.0; return NdotV / (NdotV * (1.0 - k) + k);` and `GeometrySmith` multiplies the value for `max(dot(N, V), 0.0)` with the one for `max(dot(N, L), 0.0)`. In the loop: `float G = GeometrySmith(N, V, L, roughness); vec3 numerator = vec3(NDF * G); float denominator = 4.0 * max(dot(N, V), 0.0) * max(dot(N, L), 0.0) + 0.0001; vec3 specular = numerator / denominator;` – the 0.0001 prevents a division by zero.
- **When done:** `pbr.fs`: `float GeometrySchlickGGX(float NdotV, float roughness)` (`k = (r*r) / 8.0`) and `float GeometrySmith(vec3 N, vec3 V, vec3 L, float roughness)`; in the loop `float G = GeometrySmith(N, V, L, roughness);`, `vec3 numerator = vec3(NDF * G);`, `float denominator = 4.0 * max(dot(N, V), 0.0) * max(dot(N, L), 0.0) + 0.0001;`, `vec3 specular = numerator / denominator;`. The highlights are **smaller and dimmer on the rough spheres**, which are pink now instead of white: c06 = 255,120,120 (was 255,255,255), c66 = 255,118,118, e66 = 222,93,93, c03 = 156,47,47, c33 = 133,36,36, c63 = 155,48,48, e33 = 79,8,8; the highlights of the smooth and middle spheres are still white: h00, h60, h33, h02, h62 = 255,255,255; c00 = 138,0,0, c60 = 137,0,0. 4,740 pixels are pure white (12,620 have red = 255). Background = 26,26,26. Still every sphere reflects like a perfect mirror in the highlight (no Fresnel factor), and rows look the same.

## `fresnel`
- **Task:** Add `fresnelSchlick(cosTheta, F0)` and finish the reflectance equation: `F0 = mix(vec3(0.04), albedo, metallic)`, the Cook-Torrance specular term `NDF * G * F / (4 * NdotV * NdotL + 0.0001)`, `kS = F`, `kD = (1 - kS) * (1 - metallic)` and `Lo += (kD * albedo / PI + specular) * radiance * NdotL`.
- **Hint:** `return F0 + (1.0 - F0) * pow(clamp(1.0 - cosTheta, 0.0, 1.0), 5.0);`. Before the loop: `vec3 F0 = vec3(0.04); F0 = mix(F0, albedo, metallic);`. In the loop: `vec3 F = fresnelSchlick(clamp(dot(H, V), 0.0, 1.0), F0);`, `vec3 numerator = NDF * G * F;`, then `vec3 kS = F; vec3 kD = vec3(1.0) - kS; kD *= 1.0 - metallic;`. The specular term is not multiplied by `kS` again: `F` is already in it.
- **When done:** `pbr.fs`: `vec3 fresnelSchlick(float cosTheta, vec3 F0)`; `vec3 F0 = vec3(0.04);` + `F0 = mix(F0, albedo, metallic);` before the loop; in the loop `vec3 F = fresnelSchlick(clamp(dot(H, V), 0.0, 1.0), F0);`, `vec3 numerator = NDF * G * F;`, `vec3 kS = F;`, `vec3 kD = vec3(1.0) - kS;`, `kD *= 1.0 - metallic;`, `Lo += (kD * albedo / PI + specular) * radiance * NdotL;` – learnopengl's finished reflectance equation. **The rows differ now**: the bottom row (non-metal) keeps its red diffuse colour with small white highlights (c00 = 133,0,0, c03 = 106,2,2, c06 = 139,5,5, h00 = 255,255,255, h02 = 154,70,70), towards the top (metal) the diffuse light disappears and the highlights take the albedo's red: c33 = 53,1,1, h33 = 208,16,16, c60 = 15,0,0, c63 = 33,0,0, c66 = 66,1,1, h60 = 255,12,12, h62 = 255,22,22, e33 = 35,0,0, e66 = 54,1,1. Only 54 pixels are pure white (950 have red = 255). Background = 26,26,26. The picture is dark and harsh: the colours are linear and clipped at 1.0.

## `tone-map`
- **Task:** At the end of `pbr.fs` tone map the colour with the Reinhard operator `color / (color + vec3(1.0))` and gamma correct it with `pow(color, vec3(1.0/2.2))` before writing it.
- **Hint:** The lighting is computed with linear, unbounded (HDR) values; the window stores gamma-encoded values between 0 and 1. Tone mapping first, then gamma – learnopengl's last lines: `color = color / (color + vec3(1.0)); color = pow(color, vec3(1.0/2.2));`.
- **When done:** `pbr.fs`: `color = color / (color + vec3(1.0));` then `color = pow(color, vec3(1.0/2.2));` before `FragColor = vec4(color, 1.0);`. learnopengl's picture: **brighter, softer spheres**, the highlights no longer clipped: c00 = 157,1,1, c03 = 146,27,27, c06 = 159,41,41, c33 = 115,19,19, c60 = 68,0,0, c63 = 95,11,11, c66 = 124,17,17, h00 = 243,243,243, h02 = 164,127,127, h33 = 177,71,71, h60 = 228,62,62, h62 = 239,81,81, e33 = 98,9,9, e66 = 116,15,15; background = 26,26,26 (the clear colour is not tone mapped). Bottom row: red plastic-like spheres from shiny (left) to matt (right); top row: dark red metal, the highlights wide and dim on the right. One pixel is pure white.

## `textured`
- **Task:** Take the material from the five maps instead of the uniforms: load `albedo.png`, `normal.png`, `metallic.png`, `roughness.png`, `ao.png`, bind them to texture units 0–4 (samplers `albedoMap`, `normalMap`, `metallicMap`, `roughnessMap`, `aoMap`), and in `pbr.fs` read albedo (converted to linear with `pow(…, vec3(2.2))`), metallic, roughness and ao from them and the normal from the normal map with a TBN matrix built from the vertex normal and tangent. Draw a 3 × 3 grid of large spheres (spacing 6.0, scale 2.4, turned 90° about the y axis) so the material can be seen.
- **Hint:** `main.cpp`: five `shader.setInt(…)` calls instead of the `albedo` / `ao` uniforms, five `loadTexture(…)` calls, `glActiveTexture(GL_TEXTURE0 + n)` + `glBindTexture(GL_TEXTURE_2D, …)` before the loop; in the loop no `metallic` / `roughness` uniforms, and after the translation `model = glm::rotate(model, glm::radians(90.0f), glm::vec3(0.0f, 1.0f, 0.0f)); model = glm::scale(model, glm::vec3(2.4f));`. `pbr.vs`: `layout (location = 3) in vec3 aTangent;`, `out vec3 Tangent;`, `Tangent = mat3(model) * aTangent;`. `pbr.fs`: `vec3 getNormalFromMap() { vec3 tangentNormal = texture(normalMap, TexCoords).xyz * 2.0 - 1.0; vec3 N = normalize(Normal); vec3 T = normalize(Tangent); T = normalize(T - dot(T, N) * N); vec3 B = cross(N, T); mat3 TBN = mat3(T, B, N); return normalize(TBN * tangentNormal); }` and at the top of `main`: `vec3 albedo = pow(texture(albedoMap, TexCoords).rgb, vec3(2.2)); float metallic = texture(metallicMap, TexCoords).r; float roughness = texture(roughnessMap, TexCoords).r; float ao = texture(aoMap, TexCoords).r; vec3 N = getNormalFromMap();`.
- **When done:** `main.cpp`: `shader.setInt("albedoMap", 0);` … `shader.setInt("aoMap", 4);` (no `setVec3("albedo", …)`, `setFloat("ao", …)`, `setFloat("metallic", …)`, `setFloat("roughness", …)` any more); `unsigned int albedoMap = loadTexture("albedo.png");` and the same for `normalMap`, `metallicMap`, `roughnessMap`, `aoMap`; `nrRows = 3`, `nrColumns = 3`, `spacing = 6.0`; the five `glActiveTexture` / `glBindTexture` pairs before the loop; `glm::rotate(model, glm::radians(90.0f), glm::vec3(0.0f, 1.0f, 0.0f))` and `glm::scale(model, glm::vec3(2.4f))` after the translation; `glDeleteTextures` for the five textures at the end. `pbr.vs`: `aTangent` at location 3, `out vec3 Tangent;`, `Tangent = mat3(model) * aTangent;`. `pbr.fs`: the five `uniform sampler2D` instead of the four material uniforms, `in vec3 Tangent;`, `getNormalFromMap()` and the five lines at the top of `main` (the rest of the shader is unchanged: its `albedo`, `metallic`, `roughness`, `ao` are now local variables).
  **Picture:** nine large spheres (about 158 pixels wide; centres at x = 202, 400, 598 and y = 102, 300, 498; the centre one covers x 321..478, y 221..378) of **riveted steel with rust**: a dark groove cross through the middle of each sphere, four dome-shaped rivets around it, grey shiny steel with the four lights' soft white highlights, and matt orange-brown rust patches (mostly on the right and in the lower part of each sphere) without highlights. On the centre sphere: **steel-l** (370,270) = 230,230,232 and **steel-r** (430,270) = 222,222,224 (the two upper highlights on steel), **steel-low** (377,327) = 198,199,202, **rust** (450,330) = 114,67,42, **groove** (400,262) = 95,96,98 (the vertical groove), **rivet** (369,281) = 208,209,211 (the lit top of the upper left rivet; right below it the rivet's shaded side is dark, about 90). Other spheres: **top-steel** (372,70) = 201,200,202, **left-steel** (172,270) = 197,198,201, **bottom-rust** (255,540) = 108,62,38, **right-rust** (650,330) = 118,81,60. Background (20,20) = 26,26,26 and between the spheres (300,200) = 26,26,26. 185,996 pixels are not the clear colour; none is saturated.
  **The rivets look raised**: with one light only (a test with the upper right light alone, colour 900) each rivet's highlight sits on the side facing that light and the grooves' far walls catch the light, so the normal map's directions arrive in world space the right way round.
  This is the solution.

## Notes
- **Vertex tangents instead of screen-space derivatives.** learnopengl's `getNormalFromMap()` builds the tangent from
  `dFdx` / `dFdy` of the world position and the texture coordinates "to keep things simple". The course uses the
  Normal Mapping chapter's way: a tangent per vertex (`renderSphere` computes it: the derivative of the position by u,
  normalised), interpolated, made perpendicular to the normal again (Gram-Schmidt) and completed with `B = cross(N, T)`.
  The result is smoother (no faceting from per-triangle derivatives) and works the same in every API. The function keeps
  learnopengl's name.
- learnopengl converts the albedo with `pow(…, vec3(2.2))` in the shader; loading it as an sRGB texture (`GL_SRGB`, the
  Gamma Correction chapter) would do the same conversion in the sampler. Metallic, roughness, ao and the normal map are
  data, not colours: they must stay linear.
- learnopengl's `Shader` object is called `shader` in this chapter and `pbrShader` in the IBL chapters; the course
  follows that.
- The texture objects are called `albedoMap`, `normalMap`, `metallicMap`, `roughnessMap`, `aoMap` (learnopengl's 1.2
  demo: `albedo`, `normal`, `metallic`, `roughness`, `ao`), like the samplers – the same names as in `specular-ibl`,
  where a plain `roughness` would hide behind the pre-filter loop's local variable of that name.
- The numbers that are smaller than learnopengl's (24 segments instead of 64) are for the course's simulator, which
  runs on the CPU; a real GPU handles learnopengl's values easily.
