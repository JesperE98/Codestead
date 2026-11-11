# Compute Shaders (Vulkan) – tasks

learnopengl "Guest Articles / Compute Shaders / Introduction": `src/8.guest/2022/5.computeshader_helloworld/
compute_shader_hello_world.cpp` with `computeShader.cs` and `screenQuad.vs/.fs`; vulkan-tutorial's "Compute Shader"
chapter (`code/31_compute_shader.cpp`) for the Vulkan names. Files: `main.cpp` and in `shaders/`: `screen_quad.vert/.frag`
(learnopengl's `screenQuad.vs/.fs`, complete in the start) and `compute_shader.comp` (learnopengl's `computeShader.cs`;
built to `compute_shader.comp.spv` – verify.sh compiles `.comp` files like the other stages; a valid empty compute shader
with a TODO in the start). The program is the course's Vulkan skeleton without depth buffer, camera or uniform buffer:
a colour-only render pass, one graphics pipeline for the screen quad.

**Screenshot time: 1.0 s** (the pattern moves with the time from the `time` task on; the earlier states are still).

**Fixed choices (the same in every API, see `../../opengl/compute-shaders/tasks.md`):**
- **The texture is as large as the window: 800 × 600** (`TEXTURE_WIDTH`, `TEXTURE_HEIGHT`; learnopengl 1000 × 1000),
  one texel per pixel, **`VK_FORMAT_R32G32B32A32_SFLOAT`** (OpenGL's `GL_RGBA32F`), sampled with a linear,
  clamp-to-edge sampler, no mipmaps. Linear filtering and storage use of 32-bit float formats are optional in Vulkan:
  `createTexture()` checks both with `vkGetPhysicalDeviceFormatProperties` (lavapipe and desktop GPUs have them).
- **The start fills the texture from the CPU with dark blue** (OpenGL's start does too: `std::vector<float> pixels`,
  every texel (0, 0, 0.5, 1)), copied through a staging buffer like every texture so far, so the quad shows something
  before the compute shader exists; the `compute-shader` task removes the fill (learnopengl creates the texture without
  data).
- **One image, two descriptors** (task `storage-image`, OpenGL's `image-unit`): Vulkan has no image units. The image gets
  `VK_IMAGE_USAGE_STORAGE_BIT` (and `SAMPLED_BIT`), and lives in **`VK_IMAGE_LAYOUT_GENERAL`**, the layout in which a
  shader may both write it (`imageStore`) and sample it. The compute shader sees it through its own descriptor set
  (`computeDescriptorSetLayout` / `computeDescriptorSet`: binding 0, `VK_DESCRIPTOR_TYPE_STORAGE_IMAGE`, stage
  `COMPUTE`, `imageLayout = GENERAL`, no sampler) – learnopengl's `glBindImageTexture(0, texture, 0, GL_FALSE, 0,
  GL_READ_WRITE, GL_RGBA32F)`; the quad's set has the same image view as a combined image sampler at binding 0
  (learnopengl's `tex` on texture unit 0), also with `imageLayout = GENERAL`.
- **The compute pipeline** (vulkan-tutorial's `createComputePipeline`): one stage (`VK_SHADER_STAGE_COMPUTE_BIT`),
  `vkCreateComputePipelines`, its own pipeline layout (`computePipelineLayout`: the compute descriptor set layout and,
  from `time` on, a push constant range for `t`). The queue family is vulkan-tutorial's `graphicsAndComputeFamily` (a
  family with `VK_QUEUE_GRAPHICS_BIT` and `VK_QUEUE_COMPUTE_BIT`; Vulkan guarantees one exists when a GPU can draw) – in
  the start already.
- **One command buffer, a barrier between the passes**: `recordCommandBuffer()` first records the dispatch
  (`vkCmdBindPipeline(…, VK_PIPELINE_BIND_POINT_COMPUTE, computePipeline)`, `vkCmdBindDescriptorSets(…, COMPUTE, …)`,
  **`vkCmdDispatch(commandBuffer, TEXTURE_WIDTH / 10, TEXTURE_HEIGHT / 10, 1)`** = 80 × 60 × 1 groups of 10 × 10 × 1),
  then an **image memory barrier** – `srcAccessMask = VK_ACCESS_SHADER_WRITE_BIT`, `dstAccessMask =
  VK_ACCESS_SHADER_READ_BIT`, `VK_PIPELINE_STAGE_COMPUTE_SHADER_BIT` → `VK_PIPELINE_STAGE_FRAGMENT_SHADER_BIT`, layout
  GENERAL → GENERAL – (learnopengl's `glMemoryBarrier(GL_SHADER_IMAGE_ACCESS_BARRIER_BIT)`), then the render pass with
  the quad. vulkan-tutorial's compute chapter uses a second command buffer on a compute queue with a semaphore between
  the two submissions (so compute work can overlap with drawing); one command buffer with a barrier is the simpler
  equivalent of learnopengl's program.
- **The pattern** (learnopengl's with the course's width): `value.x = mod(float(texelCoord.x) + pc.t * speed, width) /
  (gl_NumWorkGroups.x * gl_WorkGroupSize.x)`, `value.y = float(texelCoord.y) / (gl_NumWorkGroups.y *
  gl_WorkGroupSize.y)`, `speed = 100`, `width = 800`.
- **The time**: `t = glfwGetTime()` read in `recordCommandBuffer()` (learnopengl's `currentFrame`), passed as a **push
  constant** (`layout(push_constant) uniform PushConstants { float t; } pc;` ↔ `struct PushConstants { float t; }`,
  `vkCmdPushConstants(…, computePipelineLayout, VK_SHADER_STAGE_COMPUTE_BIT, …)`) – learnopengl's `layout (location = 0)
  uniform float t`.
- **Row 0 at the bottom, as in OpenGL**: the compute shader writes texel row 0 (gl_GlobalInvocationID.y = 0) first, and
  OpenGL shows texture row 0 at the bottom of the window (its quad has v = 0 at the bottom). Vulkan's normalized device
  y points down, so the course's `quadVertices` put v = 0 on the vertices at y = +1 (the bottom of the window) and v = 1
  at y = -1 (the top): green 0 at the bottom, as in OpenGL. Window pixel (x, y) shows texel (x, 599 - y).
- **The limits** (task `limits`): `VkPhysicalDeviceLimits::maxComputeWorkGroupCount[3]`, `maxComputeWorkGroupSize[3]`,
  `maxComputeWorkGroupInvocations`, printed by `printComputeLimits()` with learnopengl's texts (`Vulkan limitations:`
  instead of `OpenGL Limitations:`). lavapipe prints counts 65535 × 65535 × 65535, sizes 1024 × 1024 × 1024, 1024
  invocations; desktop GPUs give counts of 65535 or 2³¹ − 1 in x and sizes 1024 × 1024 × 64 with 1024 invocations
  (the minimums Vulkan guarantees: 65535 groups, 128 × 128 × 64, 128 invocations).

**What the window shows**: the texture over the whole window. Named points (OpenGL's): **top-left** (0,0), **left**
(100,300), **centre** (400,300), **wrap-a** (699,300), **wrap-b** (700,300), **bottom-right** (799,599), **top**
(400,0), **bottom** (400,599). Every state is OpenGL's picture exactly (0 pixels differ).

**Start picture**: the CPU-filled texture: dark blue 0,0,128 everywhere.

## `limits`
- **Task:** Ask Vulkan how large a dispatch may be and print it: the most work groups per dispatch in x, y and z, the largest work group in x, y and z, and the most invocations one work group may have.
- **Hint:** They are limits of the physical device: `vkGetPhysicalDeviceProperties(physicalDevice, &properties)`, then `properties.limits.maxComputeWorkGroupCount[0..2]`, `maxComputeWorkGroupSize[0..2]` and `maxComputeWorkGroupInvocations`. Write `printComputeLimits()` with learnopengl's prints and call it after `pickPhysicalDevice()`.
- **When done:** `main.cpp`: `printComputeLimits()` and its call; the program prints `Vulkan limitations:` and the seven
  lines (`maximum number of work groups in X dimension 65535` … `Number of invocations in a single local work group that
  may be dispatched to a compute shader 1024` – lavapipe's numbers). **No visible change** (dark blue).

## `storage-image`
- **Task:** Make the texture writable from a compute shader: give the image the storage usage and keep it in the `GENERAL` layout (where a shader may write and sample it), and describe it to the compute shader with a descriptor set of its own – binding 0 a storage image – next to the quad's sampler.
- **Hint:** `VK_IMAGE_USAGE_STORAGE_BIT` in `createTexture()`'s usage (and check `VK_FORMAT_FEATURE_STORAGE_IMAGE_BIT`), the last transition `TRANSFER_DST_OPTIMAL` → `GENERAL` (a new branch in `transitionImageLayout`: dst access shader read | write, stages fragment | compute), `imageInfo.imageLayout = VK_IMAGE_LAYOUT_GENERAL` in `createDescriptorSet()`. `createComputeDescriptorSetLayout()`: one binding, `VK_DESCRIPTOR_TYPE_STORAGE_IMAGE`, `VK_SHADER_STAGE_COMPUTE_BIT`; `createComputeDescriptorSet()`: the image view, layout `GENERAL`, no sampler; the pool gets a `VK_DESCRIPTOR_TYPE_STORAGE_IMAGE` and `maxSets = 2`. Destroy the layout in `cleanup()`.
- **When done:** `main.cpp`: `computeDescriptorSetLayout`, `computeDescriptorSet`, `createComputeDescriptorSetLayout()`,
  `createComputeDescriptorSet()` and their calls, the storage usage and feature check, the `GENERAL` layout, the pool's
  two sizes. **No visible change** (dark blue).

## `compute-shader`
- **Task:** Write the compute shader – work groups of 10 × 10 × 1 invocations, the texture as `image2D imgOutput` at binding 0, and in `main` one invocation per texel that writes red = x / width and green = y / height with `imageStore` – create the compute pipeline, and every frame dispatch 80 × 60 work groups followed by a barrier before the quad reads the texture. The CPU fill is no longer needed: create the image without data (straight from `UNDEFINED` to `GENERAL`).
- **Hint:** `layout(local_size_x = 10, local_size_y = 10, local_size_z = 1) in;`, `layout(rgba32f, binding = 0) uniform image2D imgOutput;`, `ivec2 texelCoord = ivec2(gl_GlobalInvocationID.xy);`, the width is `gl_NumWorkGroups.x * gl_WorkGroupSize.x`. `createComputePipeline("shaders/compute_shader.comp.spv")`: a `VK_SHADER_STAGE_COMPUTE_BIT` stage, a pipeline layout with `computeDescriptorSetLayout`, `VkComputePipelineCreateInfo`, `vkCreateComputePipelines`. In `recordCommandBuffer()`, before `vkCmdBeginRenderPass`: bind the compute pipeline and set (`VK_PIPELINE_BIND_POINT_COMPUTE`), `vkCmdDispatch(commandBuffer, TEXTURE_WIDTH / 10, TEXTURE_HEIGHT / 10, 1);`, then a `VkImageMemoryBarrier` (shader write → shader read, layout GENERAL → GENERAL) with `vkCmdPipelineBarrier(…, VK_PIPELINE_STAGE_COMPUTE_SHADER_BIT, VK_PIPELINE_STAGE_FRAGMENT_SHADER_BIT, …)`. In `createTexture()`: no pixels, no staging buffer, usage `STORAGE | SAMPLED`, one transition `UNDEFINED` → `GENERAL` (the only branch `transitionImageLayout` needs now; `copyBufferToImage` goes).
- **When done:** `compute_shader.comp`: the local size, `imgOutput`, `value.x = float(texelCoord.x) / (gl_NumWorkGroups.x *
  gl_WorkGroupSize.x)`, `value.y` likewise, `imageStore`. `main.cpp`: `computePipelineLayout`, `computePipeline`,
  `createComputePipeline(…)` and its call, their destruction, the dispatch and the barrier, the texture without data.
  **A red-green gradient**: black at the bottom left, red to the right, green to the top: top-left = 0,255,0, left =
  32,127,0, centre = 128,127,0, wrap-a = 223,127,0, wrap-b = 223,127,0, bottom-right = 255,0,0, top = 128,255,0, bottom =
  128,0,0. Still (no time yet).

## `time`
- **Task:** Animate it: give the compute shader the time `t` as a push constant and shift the red ramp to the right by `t * speed` texels (speed 100), wrapping around at the texture's width (800) with `mod`. Push `t` every frame.
- **Hint:** `layout(push_constant) uniform PushConstants { float t; } pc;`, `value.x = mod(float(texelCoord.x) + pc.t * speed, width) / (gl_NumWorkGroups.x * gl_WorkGroupSize.x);` with `float speed = 100; float width = 800;`. C++: `struct PushConstants { float t; };`, a `VkPushConstantRange` (`VK_SHADER_STAGE_COMPUTE_BIT`) in the compute pipeline layout, and in `recordCommandBuffer()` `constants.t = static_cast<float>(glfwGetTime());` with `vkCmdPushConstants(commandBuffer, computePipelineLayout, VK_SHADER_STAGE_COMPUTE_BIT, 0, sizeof(PushConstants), &constants);` before the dispatch.
- **When done:** `compute_shader.comp`: the push constant block, `speed`, `width`, the `mod`. `main.cpp`: `struct
  PushConstants`, the push constant range, `vkCmdPushConstants`. **The red ramp moves right**, 100 texels per second,
  and wraps: at **1.0 s** red = mod(x + 100, 800) / 800: top-left = 32,255,0, left = 64,127,0, centre = 159,127,0,
  wrap-a = 255,127,0, wrap-b = 0,127,0, bottom-right = 32,0,0, top = 159,255,0, bottom = 159,0,0. This is the solution.
