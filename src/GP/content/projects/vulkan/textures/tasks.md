# Textures (Vulkan) – vulkan-tutorial 24–26 (texture image, image view and sampler, combined image sampler) and 22–23 (descriptor layout, pool and sets), without a uniform buffer

Start: the indexed rectangle of "Hello Triangle" with a colour per vertex (like learnopengl's textures.cpp):
`struct Vertex { glm::vec3 pos; glm::vec3 color; }` (two attribute descriptions), vertices in the tutorial's order
top-left, top-right, bottom-right, bottom-left (`indices = {0, 1, 2, 2, 3, 0}`, `VK_FRONT_FACE_CLOCKWISE`), colours
top-left yellow, top-right red, bottom-right green, bottom-left blue; `shader.vert` passes `inColor` on as
`fragColor`, `shader.frag` writes `outColor = vec4(fragColor, 1.0);`. The images are in `textures/container.png` and
`textures/awesomeface.png` (image tabs; never edited).

The start already has empty stubs that `initVulkan()` calls in the tutorial's order: `createDescriptorSetLayout()`
(after `createRenderPass()`), `createTextureImage()`, `createTextureImageView()`, `createTextureSampler()` (after
`createCommandPool()`), `createDescriptorPool()`, `createDescriptorSets()` (after `createIndexBuffer()`), each with
`// TODO:` lines inside, plus `// TODO:` lines for the members, the helpers (`createImageView()`, `createImage()`,
`transitionImageLayout()`, `copyBufferToImage()`, `createBuffer()`, `beginSingleTimeCommands()` /
`endSingleTimeCommands()`), the `cleanup()` calls, `vkCmdBindDescriptorSets` and the stb_image include.

Every intermediate state builds warning-free (`-Wall`) and runs with zero validation messages (checked with the real
tools for all 15 states). Tasks 1–8 build the texture and its descriptors without changing the picture; from task 9
on, every task changes the picture.

Geometry for the pixel descriptions (800×600 window, y down): the rectangle covers x 200..600, y 150..450 (centre
(400, 300)); outside it the window is teal (51, 76, 76). The images are 256×256, so one texel is about 1.56 × 1.17
pixels. Colours below are measured on lavapipe (allow ±3).

Final program (solution): container and face mixed 50/50 (`mixValue` push constant, Up/Down keys change it), texture
coordinates 0..2: the face repeats 2×2 (mirrored: heart on the left), the container (clamp-to-edge sampler) fills
only the top-left quarter, its edge texels (the dark frame) are stretched over the other three quarters.

Deviations from the tutorial (on purpose):
- `VK_FORMAT_R8G8B8A8_UNORM` instead of `..._SRGB` for the textures: the course's swap chain is UNORM, so the
  texture bytes reach the screen unchanged, the same colours as the OpenGL (`GL_RGB`/`GL_RGBA`) and D3D12 versions.
- One frame in flight (the course's `drawFrame()` has one command buffer and one fence), so there is one
  `VkDescriptorSet descriptorSet` and the pool has `maxSets = 1` instead of `MAX_FRAMES_IN_FLIGHT`.
- No uniform buffer yet: the set has only combined image samplers (binding 0, later also binding 1).
- The vertex and index buffers stay host-visible (no staging, like the earlier chapters); `createBuffer()` is
  introduced for the texture's staging buffer only.
- No mipmaps (the tutorial adds them in a later chapter; learnopengl's `glGenerateMipmap` has no 1-line Vulkan
  equivalent). The rectangle is magnified (256 texels on 400×300 px), so it does not matter here.
- A second texture (`awesomeface.png`) uses its own function `createFaceTextureImage()` (a copy of
  `createTextureImage()` for the face – like learnopengl repeats the texture block for texture 2), so each
  `stbi_load` names its file: container first, face second (= bindings 0 and 1).

## load-image
- **Task:** Load `textures/container.png` with stb_image: at the top of `main.cpp` add
  `#define STB_IMAGE_IMPLEMENTATION` and `#include <stb_image.h>`; in `createTextureImage()` call
  `stbi_load("textures/container.png", &texWidth, &texHeight, &texChannels, STBI_rgb_alpha)`, throw
  `std::runtime_error("failed to load texture image!")` if it returns `nullptr`, and free the pixels with
  `stbi_image_free(pixels)`.
- **Hint:** `STBI_rgb_alpha` makes stb_image return 4 bytes per pixel even for an RGB file – the GPU format we use
  has 4 channels.
- **When done:** the picture is unchanged (the colour rectangle). Code has `stbi_load("textures/container.png", …,
  STBI_rgb_alpha)` and `stbi_image_free(pixels)`; if the file is missing the program stops with
  "failed to load texture image!".

## staging-buffer
- **Task:** Copy the pixels into a host-visible staging buffer: write the helper `createBuffer(size, usage,
  properties, buffer, bufferMemory)` (the tutorial's: create the buffer, allocate memory with `findMemoryType`, bind);
  in `createTextureImage()` compute `VkDeviceSize imageSize = texWidth * texHeight * 4;`, create `stagingBuffer` with
  `VK_BUFFER_USAGE_TRANSFER_SRC_BIT` and `HOST_VISIBLE | HOST_COHERENT` memory, map it, `memcpy` the pixels, unmap –
  before `stbi_image_free`; at the end of the function destroy the staging buffer and free its memory.
- **Hint:** The staging buffer is only a temporary source for a copy, so it is destroyed in the same function.
- **When done:** picture unchanged. Code has `createBuffer(imageSize, VK_BUFFER_USAGE_TRANSFER_SRC_BIT, …)`,
  `vkMapMemory`/`memcpy`/`vkUnmapMemory` of the staging memory, and `vkDestroyBuffer(device, stagingBuffer, …)`.

## texture-image
- **Task:** Create the image: members `VkImage textureImage; VkDeviceMemory textureImageMemory;`, the helper
  `createImage(width, height, format, tiling, usage, properties, image, imageMemory)` (2D, 1 mip level, 1 layer,
  initial layout `UNDEFINED`, 1 sample, exclusive; memory via `vkGetImageMemoryRequirements`/`findMemoryType`,
  `vkBindImageMemory`), call it in `createTextureImage()` with `VK_FORMAT_R8G8B8A8_UNORM`, `VK_IMAGE_TILING_OPTIMAL`,
  `TRANSFER_DST | SAMPLED` usage and `DEVICE_LOCAL` memory, and destroy the image and free its memory in `cleanup()`.
- **Hint:** UNORM (not SRGB) because our swap chain is UNORM: the shader then sees the file's bytes / 255.
- **When done:** picture unchanged. Code has `vkCreateImage`, `createImage(texWidth, texHeight,
  VK_FORMAT_R8G8B8A8_UNORM, …)`, `vkDestroyImage(device, textureImage, …)`.

## layout-transitions
- **Task:** Copy the staging buffer into the image: write `beginSingleTimeCommands()` / `endSingleTimeCommands()`
  (allocate a one-time command buffer from `commandPool`, submit it to `graphicsQueue`, `vkQueueWaitIdle`, free it),
  `transitionImageLayout(image, format, oldLayout, newLayout)` (an image memory barrier for the two transitions
  `UNDEFINED → TRANSFER_DST_OPTIMAL` and `TRANSFER_DST_OPTIMAL → SHADER_READ_ONLY_OPTIMAL`, else throw
  `std::invalid_argument`) and `copyBufferToImage(buffer, image, width, height)` (`vkCmdCopyBufferToImage`); in
  `createTextureImage()` transition to `TRANSFER_DST_OPTIMAL`, copy, transition to `SHADER_READ_ONLY_OPTIMAL`.
- **Hint:** An image must be in the right layout for each use; the barriers also order the copy before the shader
  reads.
- **When done:** picture unchanged, still no validation messages. Code has `vkCmdPipelineBarrier`,
  `vkCmdCopyBufferToImage` and two `transitionImageLayout(textureImage, …)` calls.

## image-view
- **Task:** Add `VkImageView textureImageView;`, the helper `createImageView(image, format)` (2D view, colour aspect,
  1 level, 1 layer), use it in `createImageViews()` for the swap chain images (replacing the long create-info there),
  set `textureImageView = createImageView(textureImage, VK_FORMAT_R8G8B8A8_UNORM);` in `createTextureImageView()`,
  and destroy the view in `cleanup()`.
- **Hint:** Shaders never read a `VkImage` directly, always through a view.
- **When done:** picture unchanged. Code has `createImageView(...)` used 2× and `vkDestroyImageView(device,
  textureImageView, …)`.

## sampler
- **Task:** Create `VkSampler textureSampler;` in `createTextureSampler()`: linear mag/min filters, address mode
  `REPEAT` for U, V and W, anisotropy on with `maxAnisotropy = properties.limits.maxSamplerAnisotropy` (from
  `vkGetPhysicalDeviceProperties`), opaque black border, normalized coordinates, compare off, mipmap mode linear;
  enable the device feature (`deviceFeatures.samplerAnisotropy = VK_TRUE;` in `createLogicalDevice()`) and require it
  in `isDeviceSuitable()` (`vkGetPhysicalDeviceFeatures` … `&& supportedFeatures.samplerAnisotropy`); destroy the
  sampler in `cleanup()`.
- **Hint:** Using anisotropy without enabling the device feature is a validation error.
- **When done:** picture unchanged. Code has `vkCreateSampler(device, &samplerInfo, nullptr, &textureSampler)`,
  `samplerAnisotropy = VK_TRUE`, `vkDestroySampler`.

## descriptor-layout
- **Task:** Describe what the shader will read: `VkDescriptorSetLayout descriptorSetLayout;`, in
  `createDescriptorSetLayout()` one `VkDescriptorSetLayoutBinding` (binding 0, 1 descriptor,
  `VK_DESCRIPTOR_TYPE_COMBINED_IMAGE_SAMPLER`, `VK_SHADER_STAGE_FRAGMENT_BIT`) in a `std::array` of 1 and
  `vkCreateDescriptorSetLayout`; the pipeline layout gets `setLayoutCount = 1; pSetLayouts = &descriptorSetLayout;`;
  destroy the layout in `cleanup()`.
- **Hint:** The layout is part of the pipeline layout, so it is created before `createGraphicsPipeline()`.
- **When done:** picture unchanged. Code has `vkCreateDescriptorSetLayout`, `setLayoutCount = 1`,
  `vkDestroyDescriptorSetLayout`.

## descriptor-set
- **Task:** Members `VkDescriptorPool descriptorPool; VkDescriptorSet descriptorSet;`; `createDescriptorPool()`: one
  pool size (`COMBINED_IMAGE_SAMPLER`, count 1), `maxSets = 1`; `createDescriptorSets()`: allocate the set with
  `descriptorSetLayout`, a `VkDescriptorImageInfo` (`SHADER_READ_ONLY_OPTIMAL`, `textureImageView`,
  `textureSampler`) and a `VkWriteDescriptorSet` for binding 0, `vkUpdateDescriptorSets`; in `recordCommandBuffer()`
  after `vkCmdBindIndexBuffer` call `vkCmdBindDescriptorSets(commandBuffer, VK_PIPELINE_BIND_POINT_GRAPHICS,
  pipelineLayout, 0, 1, &descriptorSet, 0, nullptr)`; destroy the pool in `cleanup()` (that frees the set too).
- **Hint:** We render one frame at a time, so one set is enough (the tutorial makes one per frame in flight).
- **When done:** picture unchanged (the shader does not sample yet). Code has `vkAllocateDescriptorSets`,
  `vkUpdateDescriptorSets`, `vkCmdBindDescriptorSets`, `vkDestroyDescriptorPool`.

## texture-coords
- **Task:** Give every vertex a texture coordinate: `glm::vec2 texCoord;` in `Vertex`, a third attribute
  description (location 2, `VK_FORMAT_R32G32_SFLOAT`, `offsetof(Vertex, texCoord)`), coordinates top-left `{0, 0}`,
  top-right `{1, 0}`, bottom-right `{1, 1}`, bottom-left `{0, 1}`; `shader.vert`: `layout(location = 2) in vec2
  inTexCoord;`, `layout(location = 1) out vec2 fragTexCoord;`, `fragTexCoord = inTexCoord;`; `shader.frag`:
  `layout(location = 1) in vec2 fragTexCoord;` and, to see them, `outColor = vec4(fragTexCoord, 0.0, 1.0);`.
- **Hint:** In Vulkan v = 0 is the first (top) row of the image and y points down, so (0, 0) belongs to the top-left
  corner – no flipping needed.
- **When done:** the rectangle shows the coordinates as colours (red = u, green = v): top-left corner black,
  top-right red (253, 2, 0), bottom-right yellow (253, 253, 0), bottom-left green (2, 253, 0), centre (400, 300)
  (128, 128, 0); (300, 225) = (64, 64, 0), (500, 375) = (192, 192, 0). The vertex colours are no longer visible.

## sample
- **Task:** Sample the texture: in `shader.frag` declare `layout(binding = 0) uniform sampler2D texSampler;` and write
  `outColor = texture(texSampler, fragTexCoord);`.
- **Hint:** A `sampler2D` at binding 0 is the combined image sampler of the descriptor set.
- **When done:** the crate fills the rectangle, upright: dark frame (92, 58, 28) along the edges, e.g. (210, 300) and
  (400, 160); light planks (146, 96, 52) at (300, 225) and (400, 200), (160, 106, 58) at (500, 375); the dark brace
  runs from bottom-left to top-right: (92, 58, 28) at (300, 375), (400, 300) and (500, 225). Grey nails near the four
  corners, e.g. (210, 160) ≈ (149, 134, 116).

## tint
- **Task:** Multiply the texture colour by the vertex colour: `outColor = texture(texSampler, fragTexCoord) *
  vec4(fragColor, 1.0);`.
- **Hint:** The multiplication is per channel: a red vertex keeps only the red of the crate.
- **When done:** learnopengl's "funky" crate: the crate tinted yellow at the top left, red at the top right, green at
  the bottom right, blue at the bottom left. Pixels: (300, 225) = (109, 96, 0), (500, 225) = (69, 29, 0) (brace,
  red-tinted), (500, 375) = (40, 106, 0), (300, 375) = (23, 29, 14), centre (400, 300) = (46, 58, 0); frame at
  (400, 160) = (89, 31, 0).

## texture-units
- **Task:** Add the face as a second texture at binding 1 and mix: members `faceTextureImage`,
  `faceTextureImageMemory`, `faceTextureImageView`; `createFaceTextureImage()` (like `createTextureImage()` but
  `stbi_load("textures/awesomeface.png", …)` into `faceTextureImage`), called right after `createTextureImage()`;
  `faceTextureImageView = createImageView(faceTextureImage, VK_FORMAT_R8G8B8A8_UNORM);`; a second layout binding
  `faceSamplerLayoutBinding` (binding 1, combined image sampler, fragment stage, array of 2); pool size count 2; a
  `faceImageInfo` (face view, `textureSampler`) and a second write for binding 1; destroy the face view, image and
  memory in `cleanup()`. `shader.frag`: `layout(binding = 1) uniform sampler2D faceSampler;` and
  `outColor = mix(texture(texSampler, fragTexCoord), texture(faceSampler, fragTexCoord), 0.2);` (the tint is
  dropped).
- **Hint:** In Vulkan the "texture units" are the bindings of the descriptor set; one sampler can be used with
  several images.
- **When done:** 80 % crate, 20 % face (learnopengl's textures_combined): a faint yellow smiley over the crate,
  heart on the right. Where the face is transparent the crate is darkened to 80 %: frame (74, 46, 22) at (210, 300),
  (400, 160) and the corners. Face over plank (168, 120, 50) at (300, 225), (400, 200); face over brace
  (125, 89, 30) at (400, 300), (500, 225), (300, 375); the heart is right of centre: (492, 322) ≈ (156, 81, 53),
  while (307, 322) = (168, 120, 50) (no heart).

## flip-face
- **Task:** Mirror only the face: sample it with `vec2(1.0 - fragTexCoord.x, fragTexCoord.y)`.
- **Hint:** The crate keeps `fragTexCoord`, so only the face changes.
- **When done:** same as after `texture-units` but the face looks the other way: the heart is now left of centre,
  (307, 322) ≈ (161, 83, 54), and (492, 322) ≈ (163, 118, 49) (no heart). The crate is unchanged (brace still from
  bottom-left to top-right).

## repeat
- **Task:** Texture coordinates 0..2 (top-left `{0, 0}`, top-right `{2, 0}`, bottom-right `{2, 2}`, bottom-left
  `{0, 2}`), and the container gets its own sampler that clamps: member `VkSampler clampSampler;`, created in
  `createTextureSampler()` from the same `samplerInfo` with the three address modes set to
  `VK_SAMPLER_ADDRESS_MODE_CLAMP_TO_EDGE`; `imageInfo.sampler = clampSampler;` (the face keeps the repeating
  `textureSampler`); destroy `clampSampler` in `cleanup()`.
- **Hint:** The sampler's address mode decides what happens outside 0..1 (learnopengl's exercise 2:
  `GL_CLAMP_TO_EDGE` on the container, `GL_REPEAT` on the face).
- **When done:** four mirrored faces (2×2, each 200×150 px, heart on the left of each), the crate only in the
  top-left quarter (x 200..400, y 150..300), the other three quarters are the crate's dark edge stretched:
  (74, 46, 22) where no face is, e.g. (400, 160), (400, 200), corners; (125, 89, 30) on the faces outside the
  top-left quarter, e.g. (500, 187), (500, 337), (300, 337); hearts at about (255, 237), (455, 237), (255, 387),
  (455, 387): (455, 237) ≈ (118, 52, 34).

## mix-value
- **Task:** Make the mix amount a push constant set from C++: `struct PushConstants { float mixValue; };`, member
  `float mixValue = 0.5f;`, a `VkPushConstantRange` (fragment stage, offset 0, `sizeof(PushConstants)`) in the
  pipeline layout, `vkCmdPushConstants(…, VK_SHADER_STAGE_FRAGMENT_BIT, 0, sizeof(PushConstants), &constants)` after
  binding the descriptor set; `shader.frag`: `layout(push_constant) uniform PushConstants { float mixValue; } pc;`
  and `mix(…, pc.mixValue)`. A `processInput()` called in `mainLoop()` after `glfwPollEvents()` adds 0.001 per frame
  while Up is held and subtracts 0.001 while Down is held, clamped to 0..1 (learnopengl's exercise 4).
- **Hint:** Push constants are recorded into the command buffer each frame, so the new value shows in the next frame.
- **When done:** same layout as after `repeat`, now 50/50: no-face areas (46, 29, 14) (e.g. (400, 160), (400, 200),
  corners), faces over the stretched edge (174, 136, 34) (e.g. (500, 187), (500, 337), (300, 337)), hearts
  ≈ (156, 44, 44) at (455, 237) and (455, 387). Holding Up makes the faces stronger (at 1.0: only faces, black
  where transparent), holding Down makes them fade (at 0.0: only the crate).
