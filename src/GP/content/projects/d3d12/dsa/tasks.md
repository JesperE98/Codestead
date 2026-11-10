# DSA – no tasks (DirectX 12)

learnopengl's guest article "DSA" (Direct State Access) is about OpenGL 4.5's way of editing objects without binding
them first: `glCreateBuffers` + `glNamedBufferStorage` instead of `glGenBuffers` + `glBindBuffer` + `glBufferData`,
`glCreateVertexArrays` + `glVertexArrayVertexBuffer` / `glVertexArrayAttribFormat` / `glVertexArrayAttribBinding` /
`glVertexArrayElementBuffer`, `glCreateTextures` + `glTextureStorage2D` / `glTextureSubImage2D` + `glBindTextureUnit`.

Direct3D 12 never had "bind to edit": every call names the object it works on. So this chapter has **no tasks**:
`edits.txt` is empty and start/ = solution/ = the `hello-triangle` solution (the orange rectangle drawn with an index
buffer), so the learner can build and run the program the text compares with OpenGL's DSA code.

What the chapter text contrasts (all of it is in this project's `main.cpp`):
- **Objects are always named explicitly.** A buffer is an `ID3D12Resource` created with
  `m_device->CreateCommittedResource(...)`; it is filled through the resource itself (`m_vertexBuffer->Map(...)`,
  `memcpy`, `m_vertexBuffer->Unmap(...)`) – like `glNamedBufferStorage` / `glNamedBufferSubData`, never through a
  "currently bound buffer".
- **Memory.** `CreateCommittedResource` creates the resource and its memory (a heap of a type – `UPLOAD` here,
  `DEFAULT` for GPU-only memory) in one call, with a fixed size like OpenGL's immutable `glNamedBufferStorage`.
  (`CreatePlacedResource` puts several resources into one `ID3D12Heap` – the explicit way, like Vulkan's
  `vkBindBufferMemory`.)
- **Vertex input** is not an object at all: the input layout (`D3D12_INPUT_ELEMENT_DESC`: semantic, format, input
  slot, byte offset – what `glVertexArrayAttribFormat` / `glVertexArrayAttribBinding` describe) is baked into the
  pipeline state object, and the buffers are bound per draw with views (`IASetVertexBuffers(0, 1,
  &m_vertexBufferView)` with stride and size – `glVertexArrayVertexBuffer`; `IASetIndexBuffer(&m_indexBufferView)` –
  `glVertexArrayElementBuffer`).
- **Textures and binding points.** Shaders read resources through descriptors (shader resource views in a descriptor
  heap, bound with root parameters / descriptor tables) – the counterpart of `glBindTextureUnit(unit, texture)`; the
  textures chapter's code shows it.

Picture (800×600, nothing depends on time): the same as `hello-triangle`'s solution – an orange rectangle
`(1.0, 0.5, 0.2)` = 255,128,51 covering (200, 150)–(600, 450) on the clear colour `(0.2, 0.3, 0.3)` = 51,77,77;
(400, 300), (250, 200), (550, 200) orange; (100, 500) clear colour.

*Simulator:* it follows this project (the hello-triangle solution) and shows this picture.
