# Geometry Shader (Vulkan) – a shader stage between the vertex and the fragment shader (learnopengl "Geometry Shader")

learnopengl `9.1.geometry_shader_houses`, `9.2.geometry_shader_exploding`, `9.3.geometry_shader_normals`. Files:
`main.cpp`, the shaders (GLSL 450, built to `shaders/<name>.<stage>.spv`, a geometry shader `shaders/<name>.geom` to
`shaders/<name>.geom.spv`): `geometry_shader.vert/.geom/.frag` (the houses), `explode.vert/.geom/.frag` (9.2),
`default.vert/.frag` and `normal_visualization.vert/.geom/.frag` (9.3), and the read-only model in `models/`
(`planet.obj`, `planet.mtl`, `planet_diffuse.png`, `planet_specular.png`, `rings.png`, `rings_specular.png`, as in the
Model chapter).

**Start:** learnopengl 9.1's scene – no camera, no matrices: clear colour (0.1, 0.1, 0.1), learnopengl's four points
(`struct PointVertex { glm::vec2 pos; glm::vec3 color; }`, `const std::vector<PointVertex> points`, their own vertex
buffer `pointsVertexBuffer`) drawn by `graphicsPipeline` (`VK_PRIMITIVE_TOPOLOGY_POINT_LIST`) with
`vkCmdDraw(commandBuffer, static_cast<uint32_t>(points.size()), 1, 0, 0)`. The vertex shader writes
`gl_PointSize = 1.0` (Vulkan draws a point list only when the last shader before the rasterizer sets the size).
The points are in Vulkan's normalized device coordinates, where **y points down**: learnopengl's (-0.5, 0.5) top-left
is (-0.5, -0.5) here – the same picture.

The start already contains the **Model chapter's code** (tinyobjloader `loadModel()`, the model's `vertexBuffer` /
`indexBuffer`, the two diffuse maps `planetDiffuseMap` / `ringsDiffuseMap`, the sampler, the uniform buffer with
`view` / `proj`, the descriptor set: UBO binding 0, textures bindings 1 and 2, the model matrix as a push constant);
it is created in `initVulkan()` but not used until the `planet` task (like the OpenGL start includes `model.h`).
`updateUniformBuffer()` writes an empty `UniformBufferObject` (TODO for the `planet` task). Changes against the
Model chapter: `createPipeline(vertFile, fragFile, topology, bindingDescription, attributeDescriptions, pipeline)` –
the topology and the vertex input are parameters (points and the model differ in both); `getAttributeDescriptions()`
returns a `std::vector`; `createVertexBuffer(data, size, buffer, memory)` takes any vertex data; no specular maps,
no lighting, no mouse/keyboard camera.

Shader files that are TODOs still compile (every `.geom` is built like the other shaders): `geometry_shader.geom` and
`normal_visualization.geom` have their `layout(...) in/out` lines and an empty `main`; `explode.geom` passes every
triangle through unchanged. `explode.*`, `default.*`, `normal_visualization.vert/.frag` are complete and unused until
their task. Every state between tasks compiles and runs with zero validation messages.

Pixels measured on lavapipe (800×600, from the top left). Background = 26,26,26. Up to `planet` and in `normals` the
pictures are pixel for pixel the OpenGL chapter's (lavapipe vs Mesa GL: < 0.3 % of the pixels differ, only along
edges and lines).

**Start picture:** four single pixels on the background: **red** 255,0,0 at (199,149), **green** 0,255,0 at (599,149),
**yellow** 255,255,0 at (199,449), **blue** 0,0,255 at (599,449) – NDC (±0.5, ±0.5) lies on pixel corners (Mesa GL:
one row lower, y = 150 / 450; check a 3×3 neighbourhood). Every other pixel 26,26,26.

## `pass-through`
- **Task:** Add a geometry shader that passes each point through unchanged: turn on the device's `geometryShader` feature, give `createPipeline()` a third shader file `geomShaderFile` ("" = none) that becomes a `VK_SHADER_STAGE_GEOMETRY_BIT` stage, write `geometry_shader.geom` and use it for the points.
- **Hint:** In `createLogicalDevice()`: `deviceFeatures.geometryShader = VK_TRUE;` (and check `supportedFeatures.geometryShader` in `isDeviceSuitable()`). The stages become a `std::vector<VkPipelineShaderStageCreateInfo>`; if `!geomShaderFile.empty()`, read the file, create the module and `push_back` its stage; `pipelineInfo.stageCount = static_cast<uint32_t>(shaderStages.size())`; destroy the module afterwards. The colour now goes vertex shader → geometry shader → fragment shader: the vertex shader writes an interface block `layout(location = 0) out VS_OUT { vec3 color; } vs_out;`, the geometry shader reads it as an array (one per input vertex) `gs_in[]` and writes `layout(location = 0) out vec3 fragColor;` for the fragment shader. A point needs one output vertex: `gl_Position = gl_in[0].gl_Position; EmitVertex(); EndPrimitive();`.
- **When done:** `main.cpp`: `deviceFeatures.geometryShader = VK_TRUE;`; `isDeviceSuitable` returns `… && supportedFeatures.geometryShader`;
  `void createPipeline(const std::string& vertShaderFile, const std::string& fragShaderFile, const std::string& geomShaderFile, VkPrimitiveTopology topology, …)`;
  `std::vector<VkPipelineShaderStageCreateInfo> shaderStages`, `if (!geomShaderFile.empty()) { … readFile(geomShaderFile) …
  geomShaderStageInfo.stage = VK_SHADER_STAGE_GEOMETRY_BIT; … shaderStages.push_back(geomShaderStageInfo); }`,
  `pipelineInfo.stageCount = static_cast<uint32_t>(shaderStages.size()); pipelineInfo.pStages = shaderStages.data();`,
  `vkDestroyShaderModule(device, geomShaderModule, nullptr)` (if created); the call
  `createPipeline("shaders/geometry_shader.vert.spv", "shaders/geometry_shader.frag.spv", "shaders/geometry_shader.geom.spv", VK_PRIMITIVE_TOPOLOGY_POINT_LIST, …, graphicsPipeline)`.
  `geometry_shader.geom`: `layout(points) in;`, `layout(points, max_vertices = 1) out;`,
  `layout(location = 0) in VS_OUT { vec3 color; } gs_in[];`, `layout(location = 0) out vec3 fragColor;`, main:
  `fragColor = gs_in[0].color; gl_Position = gl_in[0].gl_Position; EmitVertex(); EndPrimitive();`.
  `geometry_shader.vert`: `layout(location = 0) out VS_OUT { vec3 color; } vs_out;` and `vs_out.color = inColor;`
  instead of `fragColor`. (The geometry shader does not write `gl_PointSize`: without the optional
  `shaderTessellationAndGeometryPointSize` feature its points are always 1 pixel.)
  **No visible change** (the same four 1-px points, same colours and places).

## `houses`
- **Task:** Turn each point into a house: the geometry shader outputs a triangle strip of 5 vertices per point (learnopengl's `build_house`): bottom-left, bottom-right, top-left, top-right (±0.2 around the point) and the roof's top. Vulkan's y points down: "bottom" is +0.2 and the roof's top is (0.0, -0.4).
- **Hint:** `layout(triangle_strip, max_vertices = 5) out;` A strip of 5 vertices makes 3 triangles: two for the walls, one for the roof. Set `fragColor = gs_in[0].color;` once, then `gl_Position = position + vec4(-0.2, 0.2, 0.0, 0.0); EmitVertex();` … and `EndPrimitive();` at the end. Call `build_house(gl_in[0].gl_Position);` from `main`. The pipeline culls nothing, so the strip's winding does not matter.
- **When done:** `geometry_shader.geom`: `layout(triangle_strip, max_vertices = 5) out;`, a function
  `void build_house(vec4 position)` with the five `gl_Position = position + vec4(…); EmitVertex();` (offsets
  (-0.2, 0.2), (0.2, 0.2), (-0.2, -0.2), (0.2, -0.2), (0.0, -0.4)) and `EndPrimitive();`, `main` calls
  `build_house(gl_in[0].gl_Position);`. **Four houses** in the points' colours: each a 160×120 px wall with a 60 px
  roof on top (all four: x 120..679, y 30..509). Red walls x 120..279, y 90..209, roof tip (200,30); green x 520..679,
  y 90..209; yellow x 120..279, y 390..509; blue x 520..679, y 390..509. (200,150) = 255,0,0, (200,60) = 255,0,0 (roof),
  (600,150) = 0,255,0, (600,60) = 0,255,0, (200,450) = 255,255,0, (200,360) = 255,255,0, (600,450) = 0,0,255,
  (600,360) = 0,0,255; background (400,300), (400,150), (281,150) = 26,26,26.

## `roof-white`
- **Task:** Put snow on the roofs: give the last vertex of the strip (the roof's top) the colour white.
- **Hint:** The fragment shader's input is interpolated between the vertices; `fragColor` is a per-vertex output, so set `fragColor = vec3(1.0, 1.0, 1.0);` just before the fifth `EmitVertex()`.
- **When done:** `geometry_shader.geom`: `fragColor = vec3(1.0, 1.0, 1.0);` between the fifth `gl_Position = …` and its
  `EmitVertex();`. The roofs fade from the house colour at the eaves to **white at the tip**; the walls are unchanged.
  (200,150) = 255,0,0 (wall), (200,60) = 255,125,125, (200,35) = 255,232,232; (600,60) = 125,255,125;
  (200,360) = 255,255,125; (600,360) = 125,125,255, (600,335) = 232,232,255; walls (600,150) = 0,255,0,
  (200,450) = 255,255,0, (600,450) = 0,0,255; background unchanged.

## `planet`
- **Task:** Switch to the Model chapter's scene: camera globals at (0, 0, 3) looking down -z, the view and projection in `updateUniformBuffer()`, a pipeline for the model with the `explode` shaders (`VK_PRIMITIVE_TOPOLOGY_TRIANGLE_LIST`, the `Vertex` input) – whose geometry shader so far passes every triangle through unchanged – and in `recordCommandBuffer()` the model drawn with learnopengl's model matrix (tilted 25° about x, scaled 0.5) instead of the points. Remove the points.
- **Hint:** `createPipeline("shaders/explode.vert.spv", "shaders/explode.frag.spv", "shaders/explode.geom.spv", VK_PRIMITIVE_TOPOLOGY_TRIANGLE_LIST, Vertex::getBindingDescription(), Vertex::getAttributeDescriptions(), graphicsPipeline);` In `updateUniformBuffer()`: `glm::lookAt(cameraPos, cameraPos + cameraFront, cameraUp)`, `glm::perspective(glm::radians(45.0f), …, 0.1f, 100.0f)` and `ubo.proj[1][1] *= -1;`. Draw like the Model chapter: bind `vertexBuffer`, `indexBuffer` (`VK_INDEX_TYPE_UINT32`) and `descriptorSet`, push the model matrix, `vkCmdDrawIndexed(…, indices.size(), 1, 0, 0, 0)`. `explode.vert` hands the texture coordinate and the material index on in `VS_OUT`; `explode.geom` takes `layout(triangles) in;` and emits the three vertices again.
- **When done:** `main.cpp`: globals `cameraPos (0, 0, 3)`, `cameraFront (0, 0, -1)`, `cameraUp (0, 1, 0)` after
  `HEIGHT`; `struct PointVertex`, `points`, `pointsVertexBuffer`/`Memory` (member, creation, cleanup) removed; the pipeline
  call above; `updateUniformBuffer()` sets `ubo.view`, `ubo.proj` (45°, aspect of `swapChainExtent`, 0.1, 100) and
  `ubo.proj[1][1] *= -1`; `recordCommandBuffer()` binds the model's buffers and `descriptorSet`, pushes
  `PushConstants constants{}; constants.model = model;` (`translate (0,0,0)`, `rotate(glm::radians(25.0f), (1,0,0))`,
  `scale(0.5f)`) and calls `vkCmdDrawIndexed(commandBuffer, static_cast<uint32_t>(indices.size()), 1, 0, 0, 0)`.
  **The textured planet with its ring** (unlit, on the 0.1 background), as the OpenGL chapter: model x ≈ 147..652,
  y ≈ 178..445. Centre (400,300) = 105,140,60 (land), pole (400,186) = 235,240,245, sea (380,215) = 28,70,150,
  lake (437,220) = 28,70,150, ring-front (400,420) = 180,154,120, ring-left (175,330) = 77,66,51, ring-right (625,330)
  = 80,69,54, gap (250,310), (100,100) and (400,520) = 26,26,26.

## `explode`
- **Task:** Explode the planet: in `explode.geom` move every triangle along its face normal by `(sin(time) + 1) / 2 * 2.0` (learnopengl's `explode` and `GetNormal`); the time comes from the uniform buffer: a new member `float time` set from `glfwGetTime()` in `updateUniformBuffer()`, and the uniform buffer's binding now also serves the geometry stage.
- **Hint:** `GetNormal()`: `vec3 a = vec3(gl_in[0].gl_Position) - vec3(gl_in[1].gl_Position); vec3 b = vec3(gl_in[2].gl_Position) - vec3(gl_in[1].gl_Position);` – learnopengl returns `normalize(cross(a, b))`, but Vulkan's projection flips y (`proj[1][1] *= -1`), which mirrors clip space and turns that vector around: here `normalize(cross(b, a))` points out of the model (with `cross(a, b)` the pieces fly inwards and the planet shrinks to a small blot). `explode(position, normal)` returns `position + vec4(normal * ((sin(ubo.time) + 1.0) / 2.0) * magnitude, 0.0)` with `magnitude = 2.0`. In `main`: `vec3 normal = GetNormal();` and `gl_Position = explode(gl_in[i].gl_Position, normal);`. In C++: `float time;` after `proj` in `UniformBufferObject` (the shader's block gets the same member), `ubo.time = static_cast<float>(glfwGetTime());`, `uboLayoutBinding.stageFlags = VK_SHADER_STAGE_VERTEX_BIT | VK_SHADER_STAGE_GEOMETRY_BIT;`.
- **When done:** `explode.geom`: `layout(binding = 0) uniform UniformBufferObject { mat4 view; mat4 proj; float time; } ubo;`,
  `vec4 explode(vec4 position, vec3 normal)` (`float magnitude = 2.0;`, `vec3 direction = normal * ((sin(ubo.time) + 1.0) / 2.0) * magnitude;`),
  `vec3 GetNormal()` returning `normalize(cross(b, a))`, `main` uses `vec3 normal = GetNormal();` and
  `explode(gl_in[0..2].gl_Position, normal)`. `main.cpp`: `float time;` in `UniformBufferObject`, `ubo.time =
  static_cast<float>(glfwGetTime());`, the binding's stage flags with `VK_SHADER_STAGE_GEOMETRY_BIT`. **Animated:** the
  planet's triangles fly apart and back with a period of 2π s (apart the most at t = π/2, whole again at
  t = 3π/2 ≈ 4.7 s), in clip space like learnopengl. At **t = 1 s** (measured with the time fixed at 1.0): the pieces
  fill almost the whole window (bounding box x 27..772, y 0..599) as a large sphere of separate small quads with dark
  gaps; ≈ 71,200 pixels are not background (OpenGL ≈ 73,400 – Vulkan's clip-space z, 0..1 instead of -1..1, gives the
  normals a slightly different direction; 0.85 % of the pixels differ from the OpenGL picture); centre (400,300),
  pole (400,186), sea (380,215), ring-front (400,420) = 26,26,26 (gaps); (250,310) = 91,134,57 (a land piece); in the
  strip x < 140 ≈ 3,300 pixels are not background, in the rows y < 170 ≈ 13,100; in the square x 350..449, y 250..349
  ≈ 4,900 of 10,000 are pieces.

## `normals`
- **Task:** learnopengl 9.3: draw the planet normally (`default.vert/.frag`, no geometry shader), then draw it a second time with a second pipeline `normalPipeline` (`normal_visualization.vert/.geom/.frag`) whose geometry shader emits, for each vertex of each triangle, a yellow line of length 0.2 along the vertex normal.
- **Hint:** The vertex shader works in view space (`gl_Position = ubo.view * pc.model * vec4(inPosition, 1.0)`, the normal with `mat3(transpose(inverse(ubo.view * pc.model)))`); the geometry shader takes `layout(triangles) in;`, outputs `layout(line_strip, max_vertices = 6) out;`, declares the uniform buffer (it reads `ubo.proj`) and for each vertex `i` emits `ubo.proj * gl_in[i].gl_Position` and `ubo.proj * (gl_in[i].gl_Position + vec4(gs_in[i].normal, 0.0) * MAGNITUDE)`, then `EndPrimitive()`. The second draw keeps the vertex/index buffers, the descriptor set and the push constants bound for the first one: only `vkCmdBindPipeline(…, normalPipeline)` and `vkCmdDrawIndexed` again. The time is no longer needed.
- **When done:** `normal_visualization.geom`: `layout(triangles) in;`, `layout(line_strip, max_vertices = 6) out;`, the
  `UniformBufferObject` block (`view`, `proj`), `layout(location = 0) in VS_OUT { vec3 normal; } gs_in[];`,
  `const float MAGNITUDE = 0.2;`, `void GenerateLine(int index)` (two `EmitVertex()` and `EndPrimitive()`), `main` calls
  `GenerateLine(0)`, `(1)`, `(2)`. `main.cpp`: member `VkPipeline normalPipeline;` (destroyed in `cleanup()`);
  `createPipeline("shaders/default.vert.spv", "shaders/default.frag.spv", "", VK_PRIMITIVE_TOPOLOGY_TRIANGLE_LIST, …, graphicsPipeline)`
  and `createPipeline("shaders/normal_visualization.vert.spv", "shaders/normal_visualization.frag.spv", "shaders/normal_visualization.geom.spv", VK_PRIMITIVE_TOPOLOGY_TRIANGLE_LIST, …, normalPipeline)`;
  `float time` and `ubo.time = …` removed (the stage flags keep the geometry bit: this geometry shader reads `proj`); in
  `recordCommandBuffer()` after the first `vkCmdDrawIndexed`: `vkCmdBindPipeline(commandBuffer,
  VK_PIPELINE_BIND_POINT_GRAPHICS, normalPipeline);` and `vkCmdDrawIndexed(commandBuffer,
  static_cast<uint32_t>(indices.size()), 1, 0, 0, 0);`. (`normal_visualization.vert` normalizes the transformed
  normal: the model is scaled by 0.5.) Picture: the unexploded planet of `planet` with **yellow (255,255,0) hairs**
  standing out of the sphere and up from the ring (≈ 13,000 yellow pixels, OpenGL ≈ 12,300; bounding box x 139..660,
  y 126..472). Above the planet, x 300..499, y 120..176 (only background before) ≈ 2,360 yellow pixels, e.g.
  (399,126) = 255,255,0. The planet's own pixels where no line passes are unchanged: centre (400,300) = 105,140,60,
  pole (400,186) = 235,240,245, ring-front (400,420) = 180,154,120; background (100,100), (400,520) = 26,26,26.
  Static. Final state.

All the model shaders declare every attribute of a `Vertex` (locations 0–3), also those they do not read: the
validation layer warns about vertex input a vertex shader does not take.
