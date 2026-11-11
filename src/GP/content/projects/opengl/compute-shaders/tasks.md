# Compute Shaders – tasks (OpenGL)

learnopengl "Guest Articles / Compute Shaders / Introduction": `src/8.guest/2022/5.computeshader_helloworld/
compute_shader_hello_world.cpp` with `computeShader.cs`, `screenQuad.vs/.fs` and `includes/learnopengl/shader_c.h` (the
ComputeShader class). Files: `main.cpp`, `shader_m.h` (the course's Shader class), `shader_c.h` (learnopengl's
ComputeShader class: one `GL_COMPUTE_SHADER` file, compiled and linked into a program), `computeShader.comp`
(learnopengl: `computeShader.cs`), `screenQuad.vs/.fs`.

**Screenshot time: 1.0 s** (the pattern moves with the time from the `time` task on; the earlier states are still).

**OpenGL 4.3 core** (learnopengl's; compute shaders and image load/store with `binding` layouts are core in 4.3).
Shaders `#version 430 core`. **macOS stops at OpenGL 4.1: no compute shaders there** (the chapter text says so).

**Fixed choices (the same in every API):**
- **The texture is as large as the window: 800 × 600** (`TEXTURE_WIDTH = 800, TEXTURE_HEIGHT = 600`; learnopengl:
  1000 × 1000, stretched over the window) – one texel per pixel, so texel (x, y) is window pixel (x, 599 - y) and the
  pixel values below are exact. **`GL_RGBA32F`**, `GL_CLAMP_TO_EDGE`, `GL_LINEAR` (min and mag, no mipmaps), on
  texture unit 0 for the quad (`tex`) and on **image unit 0** (`glBindImageTexture(0, texture, 0, GL_FALSE, 0,
  GL_READ_WRITE, GL_RGBA32F)`) for the compute shader. Vulkan: `VK_FORMAT_R32G32B32A32_SFLOAT` with
  `STORAGE | SAMPLED` usage, layout `GENERAL`, a `VK_DESCRIPTOR_TYPE_STORAGE_IMAGE` for the compute pipeline and a
  combined image sampler for the quad; D3D12: `DXGI_FORMAT_R32G32B32A32_FLOAT` with
  `D3D12_RESOURCE_FLAG_ALLOW_UNORDERED_ACCESS`, a UAV (`RWTexture2D<float4>`, u0) and an SRV (t0).
- **Work groups**: `layout (local_size_x = 10, local_size_y = 10, local_size_z = 1) in;` (learnopengl's), dispatched
  with `glDispatchCompute(TEXTURE_WIDTH / 10, TEXTURE_HEIGHT / 10, 1)` = 80 × 60 × 1 groups, then
  `glMemoryBarrier(GL_SHADER_IMAGE_ACCESS_BARRIER_BIT)` before the quad samples the texture. Vulkan: `vkCmdDispatch(80,
  60, 1)` and an image memory barrier compute shader write → fragment shader read; D3D12: `[numthreads(10, 10, 1)]`,
  `Dispatch(80, 60, 1)`, a UAV barrier / transition UNORDERED_ACCESS → PIXEL_SHADER_RESOURCE (and back next frame).
- **The pattern** (learnopengl's, with the course's width): `value.x = mod(float(texelCoord.x) + t * speed, width) /
  (gl_NumWorkGroups.x * gl_WorkGroupSize.x)`, `value.y = float(texelCoord.y) / (gl_NumWorkGroups.y *
  gl_WorkGroupSize.y)`, `value.z = 0`, `value.w = 1`, `speed = 100`, **`width = 800`** – red rises from left to right
  and wraps, moving right by 100 texels per second; green rises from the bottom (texel row 0) to the top. Texel row 0 is
  the bottom of the window in OpenGL (the quad's texture coordinate v = 0 at the bottom); Vulkan / D3D12 draw their
  quad so that the picture is the same (green 0 at the bottom of the window) – say how.
- **Time**: `t = glfwGetTime()` (learnopengl's `currentFrame`), set as the compute shader's uniform `t` every frame
  (learnopengl declares `layout (location = 0) uniform float t;` and sets it by name – the course keeps that).
- **The screen quad**: learnopengl's `renderQuad()` (4 vertices, NDC ±1, position + texture coordinates, a triangle
  strip), `screenQuad.fs` = the texture's colour.
- **The limits** (task `limits`): learnopengl prints `GL_MAX_COMPUTE_WORK_GROUP_COUNT` and `_SIZE` (x, y, z, with
  `glGetIntegeri_v`) and `GL_MAX_COMPUTE_WORK_GROUP_INVOCATIONS`. Mesa llvmpipe prints counts 65535 × 65535 × 65535,
  sizes 1024 × 1024 × 1024 and 1024 invocations; desktop GPUs typically give counts of 2³¹ − 1 (NVIDIA, AMD in x) or
  65535, sizes 1024 × 1024 × 64 and 1024 invocations – the OpenGL minimum is 65535 × 65535 × 65535 groups, 1024 × 1024
  × 64 and 1024. The course's simulator prints llvmpipe's numbers. Vulkan: `VkPhysicalDeviceLimits.maxComputeWorkGroupCount
  / Size / Invocations`; D3D12: fixed by the API (D3D12_CS_THREAD_GROUP_MAX_X/Y = 1024, Z = 64, 1024 threads per group,
  65535 groups per dimension).
- The FPS print of learnopengl's loop is left out (the course's output stays quiet); `glfwSwapInterval(0)` too.

- learnopengl creates the texture without data (`NULL`); **the start fills it from the CPU with dark blue**
  (`std::vector<float> pixels`, every texel (0, 0, 0.5, 1)) so the quad shows something before the compute shader
  exists; the `compute-shader` task passes `NULL` instead.
- `computeShader.comp`: learnopengl names its compute shader `computeShader.cs`; the course uses `.comp`, the usual
  extension for GLSL compute shaders (glslangValidator and editors recognise it; `.cs` is C# to most tools). The start
  has a valid empty compute shader in it (TODO), not yet loaded.

**What the window shows**: the texture over the whole window. Window pixel (x, y) shows texel (x, 599 - y): in the
gradient states red = x / 800 (shifted by the time from `time` on), green = (599 - y) / 600 (0 at the bottom row, 1 at
the top), blue = 0. Named points: **top-left** (0,0), **left** (100,300), **centre** (400,300), **wrap-a** (699,300),
**wrap-b** (700,300), **bottom-right** (799,599), **top** (400,0), **bottom** (400,599).

**Start picture**: the CPU-filled texture: dark blue 0,0,128 everywhere.

## `limits`
- **Task:** Ask OpenGL how large a dispatch may be and print it: the most work groups per dispatch in x, y and z, the largest work group in x, y and z, and the most invocations one work group may have.
- **Hint:** `glGetIntegeri_v(GL_MAX_COMPUTE_WORK_GROUP_COUNT, idx, &max_compute_work_group_count[idx]);` and `GL_MAX_COMPUTE_WORK_GROUP_SIZE` for idx 0, 1, 2 (indexed queries), `glGetIntegerv(GL_MAX_COMPUTE_WORK_GROUP_INVOCATIONS, &max_compute_work_group_invocations);`.
- **When done:** `main.cpp`: `int max_compute_work_group_count[3]; int max_compute_work_group_size[3]; int
  max_compute_work_group_invocations;`, the loop with the two `glGetIntegeri_v`, the `glGetIntegerv`, learnopengl's
  seven prints (`OpenGL Limitations:` then `maximum number of work groups in X dimension 65535` … `maximum size of a
  work group in X dimension 1024` … `Number of invocations in a single local work group that may be dispatched to a
  compute shader 1024` – llvmpipe's numbers). **No visible change** (dark blue).

## `image-unit`
- **Task:** Make the texture writable from a shader: bind its level 0 to image unit 0, for reading and writing, with the format `GL_RGBA32F`.
- **Hint:** `glBindImageTexture(0, texture, 0, GL_FALSE, 0, GL_READ_WRITE, GL_RGBA32F);` – unit, texture, level, layered, layer, access, format. An image unit is not a texture unit: the quad still samples it on texture unit 0.
- **When done:** `main.cpp`: `glBindImageTexture(0, texture, 0, GL_FALSE, 0, GL_READ_WRITE, GL_RGBA32F);` after the
  texture is created. **No visible change** (dark blue).

## `compute-shader`
- **Task:** Write the compute shader – work groups of 10 × 10 × 1 invocations, the texture as `image2D imgOutput` on binding 0, and in `main` one invocation per texel that writes red = x / width and green = y / height with `imageStore` – load it with the `ComputeShader` class, and every frame dispatch 80 × 60 work groups (one invocation per texel) followed by a memory barrier before the quad reads the texture. The CPU fill is no longer needed: create the texture without data.
- **Hint:** `layout (local_size_x = 10, local_size_y = 10, local_size_z = 1) in;`, `layout (rgba32f, binding = 0) uniform image2D imgOutput;`, `ivec2 texelCoord = ivec2(gl_GlobalInvocationID.xy);`, the width is `gl_NumWorkGroups.x * gl_WorkGroupSize.x`. In C++: `computeShader.use(); glDispatchCompute(TEXTURE_WIDTH / 10, TEXTURE_HEIGHT / 10, 1); glMemoryBarrier(GL_SHADER_IMAGE_ACCESS_BARRIER_BIT);`.
- **When done:** `computeShader.comp`: the local size 10 × 10 × 1, `imgOutput`, `value.x = float(texelCoord.x) /
  (gl_NumWorkGroups.x * gl_WorkGroupSize.x)`, `value.y` likewise, `imageStore`. `main.cpp`: `ComputeShader
  computeShader("computeShader.comp");`, `glTexImage2D(… GL_RGBA32F … NULL)`, in the loop `computeShader.use()`,
  `glDispatchCompute((unsigned int)TEXTURE_WIDTH / 10, (unsigned int)TEXTURE_HEIGHT / 10, 1)`,
  `glMemoryBarrier(GL_SHADER_IMAGE_ACCESS_BARRIER_BIT)`, `glDeleteProgram(computeShader.ID)`. **A red-green gradient**:
  black at the bottom left, red to the right, green to the top, yellow at the top right: top-left = 0,255,0, left =
  32,127,0, centre = 128,127,0, wrap-a = 223,127,0, wrap-b = 223,127,0, bottom-right = 255,0,0, top = 128,255,0,
  bottom = 128,0,0. Still (no time yet).

## `time`
- **Task:** Animate it: give the compute shader the time as a uniform `t` (location 0) and shift the red ramp to the right by `t * speed` texels (speed 100), wrapping around at the texture's width (800) with `mod`. Set `t` every frame from C++.
- **Hint:** `layout (location = 0) uniform float t;`, `value.x = mod(float(texelCoord.x) + t * speed, width) / (gl_NumWorkGroups.x * gl_WorkGroupSize.x);` with `float speed = 100; float width = 800;`. C++: `computeShader.setFloat("t", currentFrame);` after `computeShader.use()`.
- **When done:** `computeShader.comp`: `layout (location = 0) uniform float t;`, `speed`, `width`, the `mod`.
  `main.cpp`: `computeShader.setFloat("t", currentFrame);`. **The red ramp moves right**, 100 texels per second, and
  wraps: at **1.0 s** red = mod(x + 100, 800) / 800, so the brightest red is at x = 699 and it starts again from 0 at
  x = 700: top-left = 32,255,0, left = 64,127,0, centre = 159,127,0, wrap-a = 255,127,0, wrap-b = 0,127,0, bottom-right
  = 32,0,0, top = 159,255,0, bottom = 159,0,0. This is the solution.
