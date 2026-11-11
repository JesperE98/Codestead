# DSA – no tasks (Vulkan)

**Screenshot time: 1.0 s** (nothing moves).

learnopengl's guest article "DSA" (Direct State Access, OpenGL 4.5) replaces OpenGL's bind-to-edit model: instead of
`glGenBuffers` + `glBindBuffer(GL_ARRAY_BUFFER, vbo)` + `glBufferData(GL_ARRAY_BUFFER, …)` – which edits *whatever is
bound* – a DSA program creates objects with `glCreateBuffers` / `glCreateVertexArrays` / `glCreateTextures` and edits
them by name: `glNamedBufferStorage(vbo, …)`, `glVertexArrayVertexBuffer(vao, 0, vbo, …)`,
`glVertexArrayAttribFormat` / `glVertexArrayAttribBinding`, `glVertexArrayElementBuffer(vao, ebo)`,
`glTextureStorage2D(tex, …)`, `glTextureSubImage2D(tex, …)`, `glBindTextureUnit(0, tex)` (see `../../opengl/dsa/`).

**Vulkan never had bind-to-edit**, so this chapter has **no tasks** for Vulkan: `edits.txt` is empty and
start/ = solution/ = the `hello-triangle` solution (the orange `(1.0, 0.5, 0.2)` rectangle – two triangles from an
index buffer – on the teal clear colour `(0.2, 0.3, 0.3)`), so the learner can build and run it while reading and
compare it with OpenGL's DSA rectangle (OpenGL's `dsa` chapter starts from the same rectangle; its last task, `texture`,
puts the container texture on it with DSA calls – Vulkan's textures chapter shows the Vulkan way).

What the chapter text contrasts, with this project's code:
- **Every object is named explicitly.** Each create call returns a handle (`vkCreateBuffer(device, &bufferInfo,
  nullptr, &vertexBuffer)`), and every later call names the object it works on: `vkGetBufferMemoryRequirements(device,
  vertexBuffer, …)`, `vkBindBufferMemory(device, vertexBuffer, vertexBufferMemory, 0)`,
  `vkMapMemory(device, vertexBufferMemory, …)`. There is no "currently bound buffer" that a call edits – that is what
  OpenGL's DSA functions (`glNamedBufferStorage(vbo, …)`) bring to OpenGL.
- **Storage and memory are separate and fixed.** `glNamedBufferStorage` makes a buffer's size immutable (unlike
  `glBufferData`, which may reallocate); Vulkan goes further: the `VkBuffer` has a fixed size, and its memory is a
  separate `VkDeviceMemory` allocation chosen by type (`findMemoryType`, `HOST_VISIBLE | HOST_COHERENT`) and bound to it
  once with `vkBindBufferMemory`. OpenGL's storage flags (`GL_DYNAMIC_STORAGE_BIT`, `GL_MAP_WRITE_BIT`) correspond to
  Vulkan's memory property flags.
- **The vertex format is separate from the buffer.** `glVertexArrayAttribFormat` / `glVertexArrayAttribBinding` /
  `glVertexArrayVertexBuffer` split "what an attribute looks like" from "which buffer feeds a binding" – exactly
  Vulkan's `VkVertexInputAttributeDescription` (location, binding, format, offset – `Vertex::getAttributeDescriptions`)
  and `VkVertexInputBindingDescription` (binding, stride – `Vertex::getBindingDescription`), baked into the pipeline,
  while the buffer itself is chosen at draw time with `vkCmdBindVertexBuffers(commandBuffer, 0, 1, vertexBuffers,
  offsets)`; `glVertexArrayElementBuffer` corresponds to `vkCmdBindIndexBuffer(commandBuffer, indexBuffer, 0,
  VK_INDEX_TYPE_UINT16)`.
- **Textures and units.** `glTextureStorage2D` + `glTextureSubImage2D` + `glBindTextureUnit` correspond to
  `vkCreateImage` (fixed size, format and mip count) + a staging copy (`vkCmdCopyBufferToImage`) + a descriptor set
  that names the image view and sampler (`vkUpdateDescriptorSets`, bound with `vkCmdBindDescriptorSets`) – seen in the
  textures chapter; this project has no texture.

Picture (lavapipe, 800×600, nothing depends on time): teal 51,76,76 around an orange 255,128,51 rectangle covering
x 200..599, y 150..449 (centre (400,300) orange, (100,100) and (100,500) teal) – the same as `hello-triangle`'s solution
and as OpenGL's `dsa` start (OpenGL's named points centre (400,300), board (300,220), frame (400,160), bolt (218,163),
diagonal (500,230) are all orange here).
