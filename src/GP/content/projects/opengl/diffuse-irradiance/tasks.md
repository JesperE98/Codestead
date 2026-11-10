# Diffuse Irradiance – tasks (OpenGL)

learnopengl "PBR / IBL / Diffuse irradiance": `src/6.pbr/2.1.1.ibl_irradiance_conversion` and `2.1.2.ibl_irradiance`.
Files: `main.cpp`, `shader_m.h`, `pbr.vs`, `pbr.fs` (the finished direct lighting of the previous chapter),
`environment.hdr` (the course's own 512 × 256 Radiance HDR environment, equirectangular; learnopengl uses
`newport_loft.hdr`), `cubemap.vs` (complete: `WorldPos = aPos; gl_Position = projection * view * vec4(WorldPos, 1.0);`),
`equirectangular_to_cubemap.fs`, `background.vs`, `background.fs`, `irradiance_convolution.fs` (their bodies are TODOs).

The fixed choices of the whole PBR part (camera (0, 0, 22), the 24-segment sphere, the 7 × 7 grid at z = 0, the four
lights, the IBL sizes) are at the top of `../pbr-lighting/tasks.md`. **In this chapter:**
- **Start** = `pbr-lighting` after its `tone-map` task (the 7 × 7 red spheres with uniform materials, Reinhard + gamma
  in `pbr.fs`, ambient `vec3(0.03) * albedo * ao`), with learnopengl's names (`pbrShader`), plus the helper
  `renderCube()` of the Advanced Lighting chapters (the 2 × 2 × 2 cube, 36 vertices: position, normal, texture
  coordinates – only the position is used here) and the shader files above. `loadTexture` is still there, unused.
- The environment: `stbi_set_flip_vertically_on_load(true)`, `stbi_loadf("environment.hdr", …)` → a `GL_RGB16F` 2D
  texture (`GL_RGB`, `GL_FLOAT` data), `GL_CLAMP_TO_EDGE`, `GL_LINEAR`, no mipmaps. learnopengl's
  `SampleSphericalMap`: `uv = vec2(atan(v.z, v.x), asin(v.y)) * vec2(0.1591, 0.3183) + 0.5`. With the flip the image's
  top row is v = 1 = straight up.
- The capture (once, before the render loop): one framebuffer `captureFBO` with a depth renderbuffer `captureRBO`
  (`GL_DEPTH_COMPONENT24`, 128 × 128, later resized to 32 × 32), `captureProjection = perspective(90°, 1.0, 0.1, 10.0)`
  and learnopengl's six `captureViews` (lookAt from the origin towards +x, -x, +y, -y, +z, -z with the ups (0, -1, 0),
  (0, -1, 0), (0, 0, 1), (0, 0, -1), (0, -1, 0), (0, -1, 0)); per face `glFramebufferTexture2D(GL_FRAMEBUFFER,
  GL_COLOR_ATTACHMENT0, GL_TEXTURE_CUBE_MAP_POSITIVE_X + i, <cube map>, 0)`, clear, `renderCube()` with `cubemap.vs`.
  Environment cube map `envCubemap`: six 128 × 128 `GL_RGB16F` faces (learnopengl 512 × 512), `GL_CLAMP_TO_EDGE`,
  `GL_LINEAR` (no mipmaps in this chapter). Irradiance map `irradianceMap`: six 32 × 32 `GL_RGB16F` faces, `GL_LINEAR`,
  `sampleDelta = 0.1` (learnopengl 0.025; 63 × 16 = 1008 samples per texel instead of 252 × 63). A real GPU handles
  learnopengl's sizes easily – the smaller numbers are for the course's simulator, which runs on the CPU. After the
  capture the viewport is set back to the window's size (`glfwGetFramebufferSize` + `glViewport`).
- The background: learnopengl's background shaders drawn last with `renderCube()` – `mat4 rotView = mat4(mat3(view))`,
  `gl_Position = clipPos.xyww` (depth 1.0), `glDepthFunc(GL_LEQUAL)`; `background.fs`: `textureLod(environmentMap,
  WorldPos, 0.0)`, Reinhard, gamma 2.2. After `irradiance-map` the same shader shows `irradianceMap` instead of
  `envCubemap` (only the bound texture changes); `ambient` binds `envCubemap` again.
- The ambient term (`ambient`): learnopengl's chapter text: `kS = fresnelSchlickRoughness(max(dot(N, V), 0.0), F0,
  roughness)`, `kD = (1.0 - kS) * (1.0 - metallic)`, `ambient = kD * texture(irradianceMap, N).rgb * albedo * ao`
  (learnopengl's 2.1.2 source file still calls `fresnelSchlick` there; the text introduces `fresnelSchlickRoughness`,
  which the course uses). `irradianceMap` is texture unit 0 of `pbrShader`.

**What the camera sees of the environment.** The camera looks down -z, which is the middle of the image's left half
(u = 0.25): pale blue-grey sky above, dark green hills on the horizon (higher on the left of the window: a solid band
from y ≈ 250 to 295 at x < 110; lower and hazier on the right), grey-brown ground below y ≈ 305. The sun (direction
(0.455, 0.682, 0.573): up, to the right, **behind** the camera) and the three coloured lamps are outside the view; they
light the spheres from the front. The 128² faces are magnified about ten times, so the background is soft.

Pixels measured with Mesa (llvmpipe), coordinates from the top left of the 800×600 window; nothing depends on time.
The spheres' positions and the sphere points are the previous chapter's: **c00** (153,547), **c03** (400,547), **c06**
(647,547), **c33** (400,300), **c60** (153,53), **c63** (400,53), **c66** (647,53), **h33** (411,288), **h62** (331,46).
Background points: **sky** (60,60), **sky-top** (400,10), **sky-right** (740,180), **hills** (60,270), **hills-high**
(60,255) (hill on the left, sky at the same height on the right: **sky-low-right** (740,255)), **hills-right**
(740,270), **ground** (60,500), **ground-bottom** (400,594), **gap-sky** (359,95) and **gap-ground** (359,506) (between
four spheres).

**Start picture:** the previous chapter's tone-mapped spheres on the clear colour: every background point = 26,26,26;
c00 = 157,1,1, c03 = 146,27,27, c06 = 159,41,41, c33 = 115,19,19, c60 = 68,0,0, c63 = 95,11,11, c66 = 124,17,17, h33 =
177,71,71, h62 = 239,81,81.

## `environment-map`
- **Task:** Load `environment.hdr` with `stbi_loadf` into a floating-point 2D texture, render it once – before the render loop – into the six faces of a 128 × 128 floating-point cube map (`envCubemap`) with the capture framebuffer, the 90° capture projection and the six capture views, and draw that cube map as the background behind the spheres.
- **Hint:** The order in `main`: `glDepthFunc(GL_LEQUAL);`, the two shaders (`cubemap.vs` + `equirectangular_to_cubemap.fs`, `background.vs` + `background.fs`), `captureFBO` + `captureRBO` (`glRenderbufferStorage(GL_RENDERBUFFER, GL_DEPTH_COMPONENT24, 128, 128)`), `stbi_set_flip_vertically_on_load(true); float *data = stbi_loadf("environment.hdr", &width, &height, &nrComponents, 0);` and `glTexImage2D(GL_TEXTURE_2D, 0, GL_RGB16F, width, height, 0, GL_RGB, GL_FLOAT, data);`, the cube map (six `glTexImage2D(GL_TEXTURE_CUBE_MAP_POSITIVE_X + i, 0, GL_RGB16F, 128, 128, 0, GL_RGB, GL_FLOAT, nullptr)`), `captureProjection` and `captureViews[]`, then `glViewport(0, 0, 128, 128)` and for each face `setMat4("view", captureViews[i])`, `glFramebufferTexture2D(GL_FRAMEBUFFER, GL_COLOR_ATTACHMENT0, GL_TEXTURE_CUBE_MAP_POSITIVE_X + i, envCubemap, 0)`, `glClear`, `renderCube()`. Afterwards set the viewport back to the window's size. `equirectangular_to_cubemap.fs`: `vec2 uv = vec2(atan(v.z, v.x), asin(v.y)); uv *= invAtan; uv += 0.5;` with `invAtan = vec2(0.1591, 0.3183)`. `background.vs`: `mat4 rotView = mat4(mat3(view)); vec4 clipPos = projection * rotView * vec4(WorldPos, 1.0); gl_Position = clipPos.xyww;`. `background.fs`: `textureLod(environmentMap, WorldPos, 0.0).rgb`, then `envColor / (envColor + vec3(1.0))` and `pow(envColor, vec3(1.0/2.2))`. In the loop, after the spheres: `backgroundShader.use()`, its `projection` and `view`, `glBindTexture(GL_TEXTURE_CUBE_MAP, envCubemap)`, `renderCube()`.
- **When done:** `main.cpp`: `glDepthFunc(GL_LEQUAL);`; `Shader equirectangularToCubemapShader("cubemap.vs", "equirectangular_to_cubemap.fs");`, `Shader backgroundShader("background.vs", "background.fs");`, `backgroundShader.setInt("environmentMap", 0);`; learnopengl's blocks `// pbr: setup framebuffer` (`captureFBO`, `captureRBO`, `GL_DEPTH_COMPONENT24`, 128, 128), `// pbr: load the HDR environment map` (`stbi_loadf("environment.hdr", …)`, `hdrTexture`, `GL_RGB16F`, `GL_FLOAT`, `GL_CLAMP_TO_EDGE`, `GL_LINEAR`), `// pbr: setup cubemap to render to and attach to framebuffer` (`envCubemap`, the `for` loop over `GL_TEXTURE_CUBE_MAP_POSITIVE_X + i` with `GL_RGB16F, 128, 128`), `captureProjection = glm::perspective(glm::radians(90.0f), 1.0f, 0.1f, 10.0f)`, the six `glm::lookAt` `captureViews`, the conversion loop (`glViewport(0, 0, 128, 128)`, `glBindFramebuffer(GL_FRAMEBUFFER, captureFBO)`, `glFramebufferTexture2D(…, GL_TEXTURE_CUBE_MAP_POSITIVE_X + i, envCubemap, 0)`, `glClear`, `renderCube()`), `glfwGetFramebufferSize` + `glViewport(0, 0, scrWidth, scrHeight)` before the render loop; in the loop the `// render skybox` block (`backgroundShader`, `projection`, `view`, `glBindTexture(GL_TEXTURE_CUBE_MAP, envCubemap)`, `renderCube()`) after the spheres; cleanup (`glDeleteTextures` for `hdrTexture` and `envCubemap`, `glDeleteRenderbuffers`, `glDeleteFramebuffers`). `equirectangular_to_cubemap.fs`: `invAtan`, `SampleSphericalMap`, `texture(equirectangularMap, uv)`. `background.vs`: `rotView`, `clipPos.xyww`. `background.fs`: `textureLod(environmentMap, WorldPos, 0.0)`, Reinhard, gamma.
  **Picture: the sky behind the spheres** (the spheres themselves are unchanged – the ambient term is still the constant): sky = 169,178,195, sky-top = 161,173,193, sky-right = 190,193,201, hills = 64,89,64, hills-high = 64,89,64 while sky-low-right = 158,164,166 (the hills are higher on the left), hills-right = 117,127,119, ground = 107,100,90, ground-bottom = 104,97,87, gap-sky = 170,179,195, gap-ground = 107,100,89; c00 = 157,1,1, c33 = 115,19,19, c66 = 124,17,17, h33 = 177,71,71 as before. The sky is the right way up (bright blue-grey at the top, ground at the bottom). 305,408 pixels change (all of the background).

## `irradiance-map`
- **Task:** Create the irradiance map: a 32 × 32 floating-point cube map (`irradianceMap`) into which the environment cube map is convoluted with `irradiance_convolution.fs` – for every direction the cosine-weighted average of the environment over the hemisphere around it (`sampleDelta = 0.1`). For now show the irradiance map as the background.
- **Hint:** After the environment's capture: the new cube map like `envCubemap` but 32 × 32, resize the depth renderbuffer (`glBindRenderbuffer` + `glRenderbufferStorage(GL_RENDERBUFFER, GL_DEPTH_COMPONENT24, 32, 32)`), `irradianceShader` (`cubemap.vs` + `irradiance_convolution.fs`) with `environmentMap` = unit 0 and `envCubemap` bound, `glViewport(0, 0, 32, 32)` and the same six-face loop with `irradianceMap`. The shader: `vec3 up = vec3(0.0, 1.0, 0.0); vec3 right = normalize(cross(up, N)); up = normalize(cross(N, right));`, then two loops `for(float phi = 0.0; phi < 2.0 * PI; phi += sampleDelta)` and `for(float theta = 0.0; theta < 0.5 * PI; theta += sampleDelta)`: `tangentSample = vec3(sin(theta) * cos(phi), sin(theta) * sin(phi), cos(theta))`, `sampleVec = tangentSample.x * right + tangentSample.y * up + tangentSample.z * N`, `irradiance += texture(environmentMap, sampleVec).rgb * cos(theta) * sin(theta); nrSamples++;` and finally `irradiance = PI * irradiance * (1.0 / float(nrSamples));`. In the render loop bind `irradianceMap` instead of `envCubemap` for the background.
- **When done:** `main.cpp`: `Shader irradianceShader("cubemap.vs", "irradiance_convolution.fs");`; learnopengl's blocks `// pbr: create an irradiance cubemap, and re-scale capture FBO to irradiance scale.` (`irradianceMap`, six faces `GL_RGB16F, 32, 32`, `GL_LINEAR`, `glRenderbufferStorage(GL_RENDERBUFFER, GL_DEPTH_COMPONENT24, 32, 32)`) and `// pbr: solve diffuse integral by convolution to create an irradiance (cube)map.` (`irradianceShader.setInt("environmentMap", 0)`, `setMat4("projection", captureProjection)`, `glBindTexture(GL_TEXTURE_CUBE_MAP, envCubemap)`, `glViewport(0, 0, 32, 32)`, the loop with `glFramebufferTexture2D(…, GL_TEXTURE_CUBE_MAP_POSITIVE_X + i, irradianceMap, 0)` and `renderCube()`); the background binds `irradianceMap`; `glDeleteTextures(1, &irradianceMap);`. `irradiance_convolution.fs`: `up` / `right`, `sampleDelta = 0.1`, the two loops, `PI * irradiance * (1.0 / float(nrSamples))`.
  **Picture: the background is a very soft blur** – the irradiance changes slowly with the direction, the hills and the horizon are gone: a pale grey-violet everywhere, slightly bluer at the top and warmer at the bottom: sky = 162,163,176, sky-top = 164,164,180, sky-right = 163,159,175, hills = 161,158,168, hills-high and sky-low-right within 3 of 161,158,170, hills-right = 161,156,172, ground = 157,150,157, ground-bottom = 158,146,155, gap-sky = 163,163,177, gap-ground = 160,150,160. It is bright even below the horizon because every direction's hemisphere reaches part of the sky or the sun. The spheres are unchanged (c00 = 157,1,1, c33 = 115,19,19, c66 = 124,17,17).

## `ambient`
- **Task:** Use the irradiance map as the ambient light in `pbr.fs`: sample it with the normal, multiply by the albedo, and weight it with `kD` – one minus the Fresnel reflectance from `fresnelSchlickRoughness`, times `1.0 - metallic`. Show the environment map as the background again.
- **Hint:** `uniform samplerCube irradianceMap;` (unit 0: `pbrShader.setInt("irradianceMap", 0);` once, and `glActiveTexture(GL_TEXTURE0); glBindTexture(GL_TEXTURE_CUBE_MAP, irradianceMap);` before the spheres are drawn). `vec3 fresnelSchlickRoughness(float cosTheta, vec3 F0, float roughness) { return F0 + (max(vec3(1.0 - roughness), F0) - F0) * pow(clamp(1.0 - cosTheta, 0.0, 1.0), 5.0); }`. The ambient term: `vec3 kS = fresnelSchlickRoughness(max(dot(N, V), 0.0), F0, roughness); vec3 kD = 1.0 - kS; kD *= 1.0 - metallic; vec3 irradiance = texture(irradianceMap, N).rgb; vec3 diffuse = irradiance * albedo; vec3 ambient = (kD * diffuse) * ao;`.
- **When done:** `main.cpp`: `pbrShader.setInt("irradianceMap", 0);`; in the loop `glActiveTexture(GL_TEXTURE0); glBindTexture(GL_TEXTURE_CUBE_MAP, irradianceMap);` before the spheres; the background binds `envCubemap` again. `pbr.fs`: `uniform samplerCube irradianceMap;`, `fresnelSchlickRoughness`, and the ambient lines above instead of `vec3(0.03) * albedo * ao`.
  **Picture:** the environment behind the spheres as after `environment-map` (sky = 169,178,195, hills = 64,89,64, ground = 107,100,90, gap-sky = 170,179,195, gap-ground = 107,100,89 …), and **the non-metal spheres are lit by the sky**: the bottom rows are clearly brighter and evenly lit, no dark rims: c00 = 193,1,1 (was 157,1,1), c03 = 187,27,27 (146,27,27), c06 = 188,41,41 (159,41,41), c33 = 146,19,19 (115,19,19), h33 = 190,71,71 (177,71,71); the metal rows hardly change, because metals have no diffuse reflection: c60 = 76,0,0 (68,0,0), c63 = 99,11,11 (95,11,11), c66 = 125,17,17 (124,17,17), h62 = 239,81,81. Only the red channel grows (the albedo is (0.5, 0, 0)). 137,258 sphere pixels change. This is the solution.

## Notes
- The conversion and the convolution run **once, in the setup**, before the render loop; the render loop only samples
  the two cube maps.
- `stbi_loadf` returns three floats per pixel (linear radiance, values far above 1.0: the sun is about 60); an 8-bit
  texture would clip them, hence `GL_RGB16F` everywhere on the way.
- OpenGL's cube map faces are addressed with the image origin at the top left, which is why learnopengl's capture views
  use the up vector (0, -1, 0) for the side faces: the pictures are rendered "upside down" into the faces so that
  sampling the cube map with a direction gives the right texel.
