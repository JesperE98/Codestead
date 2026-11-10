# Debugging – tasks (Vulkan)

learnopengl "Debugging": `src/7.in_practice/1.debugging`. Files: `main.cpp`, `shaders/debugging.vert` and
`shaders/debugging.frag` (built to `debugging.vert.spv` / `debugging.frag.spv`), `textures/wood.png` (the course's
own texture).

**Fixed choices (as the OpenGL chapter, so the pictures match):** learnopengl's debugging scene – one cube (the
OpenGL chapter's 36 vertices, position + texcoords, every face counter-clockwise seen from outside) with `wood.png`,
model = translate(0, 0, -2.5) · rotate(time × 10° about (1, 1, 1)) as a push constant, projection perspective(45°,
800/600, 0.1, **10.0**) in the uniform buffer (`GLM_FORCE_DEPTH_ZERO_TO_ONE`, `proj[1][1] *= -1` as always), no view
matrix, depth test on, back-face culling (`VK_CULL_MODE_BACK_BIT`, `VK_FRONT_FACE_COUNTER_CLOCKWISE`: with the y flip
in the projection a face that is counter-clockwise seen from outside stays counter-clockwise on screen), **clear
(0.2, 0.3, 0.3)** (learnopengl clears to black; the OpenGL chapter changes it so a black cube shows). `wood.png` is
loaded with `stbi_set_flip_vertically_on_load(true)` like the OpenGL chapter (so v = 0 is the image's bottom row and
the texture coordinates are OpenGL's; the earlier Vulkan chapters flipped v in the vertex data instead), REPEAT.
Time: `glfwGetTime()` in `recordCommandBuffer()`.

**The mistake (Vulkan's own):** learnopengl's demo hides two OpenGL mistakes (a wrong texture target and uniforms set
with no program in use). Vulkan has no error flag to poll: every call either returns a `VkResult` (checked by the
tutorial's `!= VK_SUCCESS … throw`) or is simply not checked at all – wrong usage is undefined behaviour, and only the
**validation layer** (enabled since the first chapter) tells you. The start's mistake: **`Vertex::getAttributeDescriptions()`
describes only location 0 (the position)** – the texture coordinates' description (location 1) is missing, although
the vertex shader reads `layout(location = 1) in vec2 inTexCoord`. The pipeline is created anyway, the shader's
texture coordinates read as (0, 0) for every vertex, and the cube shows one flat colour: the texel at (0, 0) (a dark
seam of the wood, 68,46,28). The OpenGL analogue is a vertex attribute that is never enabled.

Tasks: make the messages readable (severity filter), name the objects, fix the mistake the message names, then debug
the shader's output as learnopengl does. The solution ends with the texture-coordinate view (like OpenGL's).

**Time:** the pixels below are at **t = 1 s** (the cube turned 10°), measured on lavapipe with the fixed-time shim
(`VERIFY_FIXEDTIME=1 verify.sh …`); without it verify.sh's screenshot is at ≈ 3 s (30°). At 10° the cube covers about
x 214..602, y 118..512, mostly its front face. Named points (as OpenGL's): **centre** (400,300), **top** (400,150),
**lower-right** (560,450) on the cube's front face; **background** (100,100) and **left** (150,300).

**verify.sh:** the start and the states before `fix-attribute` FAIL its validation check on purpose (the mistake is
what the layer reports); `fix-attribute` and `shader-output` (= solution) pass.

**Start picture:** the cube in one flat brown: centre = top = lower-right = 68,46,28; background and left 51,76,76.
**The program prints** (the tutorial's `debugCallback` prints every message with "validation layer: "; lavapipe,
Vulkan SDK layers 1.3.275 – the handle values differ from run to run):
```
validation layer: Searching for ICD drivers named libvulkan_lvp.so
validation layer: Loading layer library libVkLayer_khronos_validation.so
validation layer: Loading layer library libVkLayer_MESA_device_select.so
validation layer: Copying old device 0 into new device 0        (5 times)
validation layer: Validation Error: [ VUID-VkGraphicsPipelineCreateInfo-Input-07904 ] Object 0: handle = 0xf000000000f, type = VK_OBJECT_TYPE_SHADER_MODULE; | MessageID = 0xcc9c32be | vkCreateGraphicsPipelines(): pCreateInfos[0].pVertexInputState->pVertexAttributeDescriptions does not have a Location 1 but vertex shader has an input variable at that Location. The Vulkan spec states: If the pipeline is being created with vertex input state and pVertexInputState is not dynamic, then all variables with the Input storage class decorated with Location in the Vertex Execution Model OpEntryPoint must contain a location in VkVertexInputAttributeDescription::location (https://www.khronos.org/registry/vulkan/specs/1.3-extensions/html/vkspec.html#VUID-VkGraphicsPipelineCreateInfo-Input-07904)
```
The first lines are the loader's and the layer's verbose/info messages (the messenger asks for VERBOSE |
WARNING | ERROR); the error comes once, from `vkCreateGraphicsPipelines` in `createPipeline()`.

## message-severity
- **Task:** Make `debugCallback` print only the messages of warning severity or higher, so the error is not lost among the informational messages.
- **Hint:** The severities are bits ordered by importance (VERBOSE < INFO < WARNING < ERROR), so vulkan-tutorial compares them: `if (messageSeverity >= VK_DEBUG_UTILS_MESSAGE_SEVERITY_WARNING_BIT_EXT) { … }`.
- **When done:** in `debugCallback` the `std::cerr << "validation layer: " << pCallbackData->pMessage << std::endl;`
  is inside `if (messageSeverity >= VK_DEBUG_UTILS_MESSAGE_SEVERITY_WARNING_BIT_EXT)`. **No visible change** (flat
  cube, 68,46,28). **The program prints only the error** (the `VUID-VkGraphicsPipelineCreateInfo-Input-07904` line
  above, once); the "Searching for ICD", "Loading layer library" and "Copying old device" lines are gone.

## object-names
- **Task:** Name the shader modules and the texture image with `vkSetDebugUtilsObjectNameEXT`, so the validation layer's messages say which object they mean.
- **Hint:** It is an extension function: look it up with `vkGetInstanceProcAddr(instance, "vkSetDebugUtilsObjectNameEXT")` in a proxy `SetDebugUtilsObjectNameEXT(instance, device, &nameInfo)` like `CreateDebugUtilsMessengerEXT`. A helper `setObjectName(VkObjectType objectType, uint64_t objectHandle, const char* name)` fills `VkDebugUtilsObjectNameInfoEXT` (`objectType`, `objectHandle`, `pObjectName`). Name the two modules in `createPipeline()` after their files (`vertShaderFile.c_str()`), the image in `loadTexture()` after `path`.
- **When done:** the free function `VkResult SetDebugUtilsObjectNameEXT(VkInstance instance, VkDevice device, const
  VkDebugUtilsObjectNameInfoEXT* pNameInfo)` (`PFN_vkSetDebugUtilsObjectNameEXT` from `vkGetInstanceProcAddr`); the
  member `void setObjectName(VkObjectType objectType, uint64_t objectHandle, const char* name)` (returns at once
  without validation layers; `VK_STRUCTURE_TYPE_DEBUG_UTILS_OBJECT_NAME_INFO_EXT`); in `createPipeline()`
  `setObjectName(VK_OBJECT_TYPE_SHADER_MODULE, (uint64_t) vertShaderModule, vertShaderFile.c_str());` and the same for
  `fragShaderModule`; in `loadTexture()` `setObjectName(VK_OBJECT_TYPE_IMAGE, (uint64_t) image, path);`. **No visible
  change.** **The message now names the shader:** `… Object 0: handle = 0xf000000000f, name =
  shaders/debugging.vert.spv, type = VK_OBJECT_TYPE_SHADER_MODULE; | MessageID = 0xcc9c32be | vkCreateGraphicsPipelines():
  pCreateInfos[0].pVertexInputState->pVertexAttributeDescriptions does not have a Location 1 but vertex shader has an
  input variable at that Location. …` (the rest as above). Debuggers such as RenderDoc show the same names.

## fix-attribute
- **Task:** Fix what the message says: describe the vertex shader's input at location 1 – the texture coordinates – in `Vertex::getAttributeDescriptions()`.
- **Hint:** The array needs 2 elements; the second: `binding = 0`, `location = 1`, `format = VK_FORMAT_R32G32_SFLOAT` (a vec2), `offset = offsetof(Vertex, texCoord)`.
- **When done:** `static std::array<VkVertexInputAttributeDescription, 2> getAttributeDescriptions()` with
  `attributeDescriptions[1]` = binding 0, location 1, `VK_FORMAT_R32G32_SFLOAT`, `offsetof(Vertex, texCoord)`.
  **The wooden cube appears** (boards running up the front face): centre = 186,127,78, top = 179,122,75,
  lower-right = 166,114,69; background 51,76,76 – equal to OpenGL's `fix-texture` (607 pixels differ by 3–6 levels:
  OpenGL samples with mipmaps, Vulkan without). **Nothing is printed** (verify.sh passes).

## shader-output
- **Task:** Debug the shader's output: write the texture coordinates as the fragment colour instead of the texture (u as red, v as green) – keep the texture line as a comment.
- **Hint:** In `shaders/debugging.frag`: `outColor = vec4(fragTexCoord, 0.0, 1.0);`. (Had you done this before the fix, the cube would have been black – (0, 0) everywhere – which points at the texture coordinates.)
- **When done:** `debugging.frag` writes `outColor = vec4(fragTexCoord, 0.0, 1.0);` with `// outColor =
  texture(texSampler, fragTexCoord);` below it. **The cube shows a red–green gradient**: black at the face's
  bottom-left (uv 0,0), red at the bottom-right, green at the top-left, yellow at the top-right: centre = 116,141,0,
  top = 125,244,0, lower-right = 222,18,0; background 51,76,76 – identical to OpenGL's (no pixel differs by more than 1).
  Nothing printed. This is the solution.

## Explained in the text, not tasks
- `VkResult`: what OpenGL's `glGetError` is for returns directly from each Vulkan call (`VK_SUCCESS`, `VK_ERROR_…`);
  the tutorial checks the ones that can fail at run time. Misuse that the driver does not detect is not reported at
  all without the validation layer.
- `pCallbackData->pMessageIdName` / `messageIdNumber` (the VUID and its number), `pObjects` (the objects with their
  names), the `messageType` bits (GENERAL / VALIDATION / PERFORMANCE), and that returning `VK_TRUE` would abort the
  call (only for layer testing). Labels for command buffer regions (`vkCmdBeginDebugUtilsLabelEXT`) for RenderDoc.
- Turning the layer off in release builds (`NDEBUG` → `enableValidationLayers = false`, already in the code).

## What the simulator must report (for the lead)
The simulator draws every state correctly already (flat 68,46,28 cube when location 1 is not described – it reads
the missing input as 0 like lavapipe; the wood; the gradient). It does not yet print the layer's messages. Needed, as
lines of the program's output (stderr), exactly as `debugCallback` prints them:
1. **The validation error**, once, when `vkCreateGraphicsPipelines` is reached with a vertex shader input whose
   `location` is not in the `VkVertexInputAttributeDescription`s of the pipeline (`Vertex::getAttributeDescriptions()`
   returns only location 0; the shader `shaders/debugging.vert` declares `layout(location = 1) in vec2 inTexCoord`):
   `validation layer: Validation Error: [ VUID-VkGraphicsPipelineCreateInfo-Input-07904 ] Object 0: handle = <hex>,
   type = VK_OBJECT_TYPE_SHADER_MODULE; | MessageID = 0xcc9c32be | vkCreateGraphicsPipelines():
   pCreateInfos[0].pVertexInputState->pVertexAttributeDescriptions does not have a Location 1 but vertex shader has an
   input variable at that Location. The Vulkan spec states: …` (full text above). Severity ERROR, type VALIDATION.
2. **The informational lines** (severity VERBOSE/INFO, type GENERAL) before it while `debugCallback` prints every
   message: `validation layer: Searching for ICD drivers named <driver>`, `Loading layer library
   libVkLayer_khronos_validation.so`, … – a simulated driver may print its own one or two lines; what matters is that
   they **disappear** once the callback has `if (messageSeverity >= VK_DEBUG_UTILS_MESSAGE_SEVERITY_WARNING_BIT_EXT)`
   (the callback's code decides: the simulator passes each message's severity and prints what the callback prints).
3. **Object names:** after `SetDebugUtilsObjectNameEXT` / `vkSetDebugUtilsObjectNameEXT` was called for an object
   (here `VK_OBJECT_TYPE_SHADER_MODULE` with `pObjectName` = the file name string `vertShaderFile.c_str()` =
   "shaders/debugging.vert.spv", reached through `setObjectName` from `createPipeline`), messages about that object
   show `Object 0: handle = <hex>, name = shaders/debugging.vert.spv, type = VK_OBJECT_TYPE_SHADER_MODULE;`.
4. No message at all once the second attribute description exists.
