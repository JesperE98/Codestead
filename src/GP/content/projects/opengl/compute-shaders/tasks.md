# Compute Shaders – tasks (OpenGL)

learnopengl "Guest Articles / Compute Shaders / Introduction": `src/8.guest/2022/5.computeshader_helloworld/
compute_shader_hello_world.cpp` with `computeShader.cs`, `screenQuad.vs/.fs` and `includes/learnopengl/shader_c.h` (the
ComputeShader class). Files: `main.cpp`, `shader_m.h` (the course's Shader class), `shader_c.h` (learnopengl's
ComputeShader class: one `GL_COMPUTE_SHADER` file, compiled and linked into a program), `computeShader.cs`,
`screenQuad.vs/.fs`.

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
  sizes 1024 × 1024 × 64 and 1024 invocations; desktop GPUs give counts of 65535 or 2³¹ − 1 in x and sizes
  1024 × 1024 × 64 with 1024 (NVIDIA, AMD) or 1792 invocations. Vulkan: `VkPhysicalDeviceLimits.maxComputeWorkGroupCount
  / Size / Invocations`; D3D12: fixed by the API (D3D12_CS_THREAD_GROUP_MAX_X/Y = 1024, Z = 64, 1024 threads per group,
  65535 groups per dimension).
- The FPS print of learnopengl's loop is left out (the course's output stays quiet); `glfwSwapInterval(0)` too.

(Tasks and pixel values follow.)
