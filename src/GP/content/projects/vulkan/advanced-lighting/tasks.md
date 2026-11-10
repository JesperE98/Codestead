# Advanced Lighting (Vulkan) – Blinn-Phong (learnopengl "Advanced Lighting")

learnopengl `src/5.advanced_lighting/1.advanced_lighting` (`advanced_lighting.cpp`, `1.advanced_lighting.vs/.fs`). Files:
`main.cpp`, `shaders/advanced_lighting.vert` / `.frag` (built to `shaders/advanced_lighting.vert.spv` / `.frag.spv`),
`textures/wood.png` (the course's own floor boards).

Start: the structure of the Advanced OpenGL chapters (HelloTriangleApplication, `createPipeline(vert, frag, pipeline)`,
`loadTexture` / `createTextureSampler` / `createDescriptorSet` helpers, view/projection in the uniform buffer) with
learnopengl's scene: only the floor – `vertices` = learnopengl's `planeVertices` (±10 in x/z at y = -0.5, normals up,
texture coordinates up to 10 with `VK_SAMPLER_ADDRESS_MODE_REPEAT`; v flipped, 10 - v, so the image is upright as in the
earlier chapters), `Vertex` = position + normal + texture coordinates (three attribute descriptions), the light at
`lightPos (0, 0, 0)` (a global), the camera globals at (0, 0, 3) looking down -z (fov 45, 800/600, 0.1, 100), clear
(0.1, 0.1, 0.1). The vertex shader passes the world position (the floor has no model matrix), normal and texture
coordinates in an interface block `VS_OUT`. The fragment shader is learnopengl's: ambient `0.05 * color`, diffuse
`max(dot(lightDir, normal), 0.0) * color`, specular `vec3(0.3) * spec`.

Data:
- **Uniform buffer** (binding 0, read by both shaders, so its stage flags are `VK_SHADER_STAGE_VERTEX_BIT |
  VK_SHADER_STAGE_FRAGMENT_BIT`): `view`, `proj`, `viewPos`, `lightPos`. std140 starts every vec3 at a multiple of 16
  bytes, so the C++ struct has `float pad1;` after `glm::vec3 viewPos` and `float pad2;` after `lightPos`.
- **Push constant** (fragment stage): learnopengl's `uniform bool blinn` becomes `layout(push_constant) uniform
  PushConstants { bool blinn; } pc;` ↔ C++ `struct PushConstants { VkBool32 blinn; };` (a GLSL bool is 4 bytes). The
  value comes from the global `bool blinn = false;` – `constants.blinn = blinn;` and `vkCmdPushConstants(…,
  VK_SHADER_STAGE_FRAGMENT_BIT, …)` before the floor's `vkCmdDraw(commandBuffer, 6, 1, 0, 0)` in `recordCommandBuffer()`.
  learnopengl toggles it with the B key; here the task switches the code (no input).
- The shader keeps both models: `if (pc.blinn) { … Blinn-Phong … } else { … Phong … }`. In the start the Blinn-Phong
  branch is a TODO and `blinn` is false: **Phong only**, exponent 8.0.

Pixels measured on lavapipe, coordinates from the top left of the 800×600 window; nothing depends on time. The floor
fills the lower half (its far edge, z = -10, is at y ≈ 330); the vertical board seam at x ≈ 400 is avoided. Points: **background**
(400,150); **highlight** (380,430) (in the bright spot in front of the light); **side** (260,510) (left of the spot);
**mid** (320,470); **far-left** (100,500). Every picture equals the OpenGL chapter's (within 1 per channel).

**Start (Phong, exponent 8):** background 26,26,26, highlight 179,123,75, side 108,85,66, mid 136,104,77, far-left
66,46,28. Phong's reflection vector turns away from the camera at grazing angles (more than 90° between the view and
reflection directions), so its specular term is cut off to 0 there: a highlight with a hard edge (learnopengl's image).

## halfway
- **Task:** Add Blinn-Phong: in the `if (pc.blinn)` branch of `advanced_lighting.frag` compute the halfway vector `vec3 halfwayDir = normalize(lightDir + viewDir);` and `spec = pow(max(dot(normal, halfwayDir), 0.0), 8.0);`, and switch it on in `main.cpp`: `bool blinn = true;`.
- **Hint:** The halfway vector lies between the directions to the light and to the viewer; it is never more than 90° from the normal on the lit side, so the highlight fades out smoothly instead of being cut off. Keep the exponent 8.0 for now to compare with Phong.
- **When done:** `advanced_lighting.frag` has `normalize(lightDir + viewDir)` and `dot(normal, halfwayDir)` with 8.0;
  `main.cpp` has `bool blinn = true;` (so the push constant `blinn` is `VK_TRUE`). The highlight becomes **wider and
  brighter**, with no cut-off: highlight (380,430) 205,148,101, mid 134,101,74, side (260,510) 90,67,48, far-left
  65,45,28, background 26,26,26.

## shininess
- **Task:** Give Blinn-Phong learnopengl's exponent: `spec = pow(max(dot(normal, halfwayDir), 0.0), 32.0);`.
- **Hint:** The angle between the normal and the halfway vector is smaller than the one between the view and reflection vectors, so Blinn-Phong needs a 2–4 times higher exponent for a highlight of about the same size as Phong's.
- **When done:** the Blinn-Phong branch uses `32.0`. The highlight is **about Phong's size again** (now without the
  cut-off): highlight (380,430) 180,123,75 (= the start), mid (320,470) 104,72,45, side (260,510) 72,49,30, far-left
  65,44,27, background 26,26,26.

Simulator (checked with the app's simulator): every state matches lavapipe (0.02 % of the pixels differ by more than
24/255; the points above within 1/255), the `bool` push constant included.
