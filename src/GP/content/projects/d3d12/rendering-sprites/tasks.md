# Rendering Sprites (Hedgerow) – tasks (DirectX 12)

learnopengl "2D Game / Rendering Sprites": `progress/3.game.cpp` and `sprite_renderer.h/.cpp`, `sprite.vs/.frag` of
`0.full_source`. Files: `main.cpp` (= `game-setup`'s solution with TODOs for the sprite renderer), `sprite.hlsl`
(`VSMain` and `PSMain` are TODOs that return a fixed position / white), `textures/ball.png` (the course's ball:
128×128 RGBA, a pale ball on a transparent background). See `../game-setup/tasks.md` for the fixed choices of the whole
game.

**The same as OpenGL** (projects/opengl/rendering-sprites/tasks.md): `textures/ball.png` loaded with alpha as
`"ball"` and drawn with learnopengl's numbers – `DrawSprite(Renderer, GetTexture("ball").ID, XMFLOAT2(200.0f, 200.0f),
XMFLOAT2(300.0f, 400.0f), 45.0f, XMFLOAT3(0.0f, 1.0f, 0.0f));`; the global `SpriteRenderer Renderer;`,
`InitRenderData(SpriteRenderer&)`, `DrawSprite(SpriteRenderer& renderer, unsigned int texture, XMFLOAT2 position,
XMFLOAT2 size = XMFLOAT2(10.0f, 10.0f), float rotate = 0.0f, XMFLOAT3 color = XMFLOAT3(1.0f, 1.0f, 1.0f))` (the texture
as its ID = its SRV's slot in the heap); learnopengl's quad (6 vertices: xy 0..1, texture coordinates, (0, 0) = the
sprite's top-left – the same numbers in Direct3D, where v = 0 is the image's top row); a positive angle turns the
sprite clockwise on screen.

**Direct3D 12's choices:**
- `struct SpriteRenderer { Shader shader; ComPtr<ID3D12Resource> quadVertexBuffer; D3D12_VERTEX_BUFFER_VIEW
  quadVertexBufferView = {}; };` – the quad in an upload-heap vertex buffer (learnopengl's VAO/VBO), released in
  `OnDestroy` with `Renderer = SpriteRenderer();` (learnopengl deletes the VAO in Game's destructor).
- The sprite's `model` and `spriteColor` are **root constants** (`struct SpriteConstants { XMFLOAT4X4 model; XMFLOAT3
  spriteColor; };`, HLSL `cbuffer SpriteConstants : register(b0)`, 19 values, root parameter 0) set in `DrawSprite`
  with `SetGraphicsRoot32BitConstants`, then the texture's table (root parameter 2:
  `CD3DX12_GPU_DESCRIPTOR_HANDLE(Graphics.SrvHeap->GetGPUDescriptorHandleForHeapStart(), texture,
  Graphics.SrvDescriptorSize)`), `IASetVertexBuffers`, `DrawInstanced(6, 1, 0, 0)`.
- The projection `XMMatrixOrthographicOffCenterRH(0, Width, Height, 0, -1, 1)` (learnopengl's `glm::ortho(0, Width,
  Height, 0, -1, 1)`; RH maps z 0 to depth 0.5 – no depth buffer anyway) goes into the constant buffer
  (`SceneConstantBuffer`, root parameter 1) in `OnUpdate` every frame, like the view and projection of the earlier
  Direct3D 12 chapters – learnopengl sets it once in `Init` as a uniform.
- The model matrix: DirectXMath multiplies row vectors, so learnopengl's `translate · translate(0.5 size) · rotate ·
  translate(-0.5 size) · scale` is written in the opposite order: `XMMatrixScaling(size) * XMMatrixTranslation(-0.5
  size) * XMMatrixRotationZ(XMConvertToRadians(rotate)) * XMMatrixTranslation(0.5 size) * XMMatrixTranslation(position)`
  (scale first, translation last – the order they happen in). Stored transposed (`XMMatrixTranspose`), used as
  `mul(mul(float4(position, 0, 1), model), projection)` in `VSMain`.

Named points as OpenGL's (from the top-left, 800×600; static picture): **centre** (350,400), **top** (350,215),
**bottom** (350,585), **left** (210,400), **right** (490,400), **upper-right** (470,280), **lower-left** (230,520),
**background** (100,100). The values below are from the simulator with its current gaps worked around (see the
report) and equal OpenGL's screenshots (draw-sprite: max difference 1; rotate: 2 edge pixels differ).

**Start picture:** black everywhere (0, 0, 0).

## sprite-shader
- **Task:** Write the sprite shaders – `VSMain` passes the texture coordinates on and transforms the position with
  `model`, then `projection`; `PSMain` multiplies the texture by `spriteColor` – load them in `Init` as `"sprite"`, and
  write the orthographic projection into the constant buffer in `OnUpdate`.
- **Hint:** `result.position = mul(mul(float4(position, 0.0f, 1.0f), model), projection);`,
  `return float4(spriteColor, 1.0f) * image.Sample(wrapSampler, input.texCoord);`, `LoadShader(L"sprite.hlsl",
  "sprite");`. In `OnUpdate`: `XMMatrixOrthographicOffCenterRH(0.0f, static_cast<float>(Hedgerow.Width),
  static_cast<float>(Hedgerow.Height), 0.0f, -1.0f, 1.0f)`, stored transposed and copied with `memcpy` to
  `m_pCbvDataBegin`.
- **Observable:** `sprite.hlsl`: `result.texCoord = texCoord;`, `result.position = mul(mul(float4(position, 0.0f,
  1.0f), model), projection);`, `return float4(spriteColor, 1.0f) * image.Sample(wrapSampler, input.texCoord);`; in
  `Init`: `LoadShader(L"sprite.hlsl", "sprite");` (a pipeline state object is created); in `OnUpdate`: the projection,
  `XMStoreFloat4x4(&constantBufferData.projection, XMMatrixTranspose(projection))`, `memcpy(m_pCbvDataBegin, …)`.
  No visible change (black).

## sprite-renderer
- **Task:** Add `SpriteRenderer` (its shader, the quad's vertex buffer and view), the root constants struct
  `SpriteConstants` and `InitRenderData`, which creates the quad (learnopengl's 6 vertices of 4 floats); a global
  `SpriteRenderer Renderer`, set up in `Init` and released in `OnDestroy`.
- **Hint:** The vertex buffer like the earlier chapters' (upload heap, `Map`, `memcpy`, `Unmap`), stride
  `4 * sizeof(float)`. In `Init`: `Renderer.shader = GetShader("sprite"); InitRenderData(Renderer);`.
- **Observable:** `struct SpriteRenderer { Shader shader; ComPtr<ID3D12Resource> quadVertexBuffer;
  D3D12_VERTEX_BUFFER_VIEW quadVertexBufferView = {}; };`, `struct SpriteConstants { XMFLOAT4X4 model; XMFLOAT3
  spriteColor; };`, `void InitRenderData(SpriteRenderer& renderer)` (learnopengl's `vertices[]`,
  `CreateCommittedResource` → `renderer.quadVertexBuffer`, the view with `StrideInBytes = 4 * sizeof(float)`),
  `SpriteRenderer Renderer;` after `Game Hedgerow;`, the two lines in `Init`, `Renderer = SpriteRenderer();` in
  `OnDestroy` after `ClearResources();`. No visible change.

## draw-sprite
- **Task:** Write `DrawSprite` – the model matrix (scale to `size`, move to `position`; the rotation follows in the
  next task), the root constants, the texture's descriptor table, the quad drawn –, load `textures/ball.png` with
  alpha as `"ball"` in `Init` and draw it in `Render` at (200, 200), size (300, 400), 45°, green.
- **Hint:** DirectXMath's order is the order things happen: `XMMatrixScaling(size.x, size.y, 1.0f)` first,
  `XMMatrixTranslation(position.x, position.y, 0.0f)` last. Then `Use(renderer.shader)`,
  `SetGraphicsRoot32BitConstants(0, sizeof(SpriteConstants) / 4, &constants, 0)`, `SetGraphicsRootDescriptorTable(2,
  textureHandle)`, `IASetVertexBuffers`, `DrawInstanced(6, 1, 0, 0)`.
- **Observable:** `void DrawSprite(SpriteRenderer& renderer, unsigned int texture, XMFLOAT2 position, XMFLOAT2 size =
  XMFLOAT2(10.0f, 10.0f), float rotate = 0.0f, XMFLOAT3 color = XMFLOAT3(1.0f, 1.0f, 1.0f))` with the scaling, a TODO
  for the rotation, the translation, `XMStoreFloat4x4(&constants.model, XMMatrixTranspose(model))`,
  `constants.spriteColor = color`, the calls above; `LoadTexture("textures/ball.png", true, "ball");` in `Init`; the
  `DrawSprite(Renderer, GetTexture("ball").ID, …)` call in `Render`. **The green ball appears, stretched to an upright
  ellipse** (not rotated yet) filling x 201..498, y 202..597: centre = (0, 230, 0), top = (0, 223, 0), bottom =
  (0, 200, 0), left = (0, 223, 0), right = (0, 200, 0), upper-right ≈ (0, 2, 0) (the edge), lower-left = (0, 0, 0),
  background (0, 0, 0). One draw.

## rotate
- **Task:** Rotate the sprite by `rotate` degrees about its centre: move the quad's centre to the origin, rotate about
  z, move it back – between the scaling and the translation.
- **Hint:** `model = model * XMMatrixTranslation(-0.5f * size.x, -0.5f * size.y, 0.0f);`,
  `model = model * XMMatrixRotationZ(XMConvertToRadians(rotate));`, `model = model * XMMatrixTranslation(0.5f * size.x,
  0.5f * size.y, 0.0f);` (learnopengl's three lines, in DirectXMath's order).
- **Observable:** those three lines in `DrawSprite` instead of the TODO. **The ellipse is turned 45° clockwise about
  (350, 400)** (x 172..527, y 222..577): centre = (0, 230, 0), upper-right = (0, 232, 0), lower-left = (0, 212, 0),
  left = (0, 232, 0), right = (0, 226, 0); top and bottom (0, 0, 0) (now outside); background (0, 0, 0).
