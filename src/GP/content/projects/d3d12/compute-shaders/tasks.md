# Compute Shaders – tasks (DirectX 12)

learnopengl "Guest Articles / Compute Shaders / Introduction": `src/8.guest/2022/5.computeshader_helloworld/
compute_shader_hello_world.cpp` with `computeShader.cs` and `screenQuad.vs/.fs`, in Direct3D 12 – with the compute
pipeline of Microsoft's D3D12nBodyGravity sample (a compute root signature, `CreateComputePipelineState`, a UAV,
`Dispatch`). Files: `main.cpp`, `computeShader.hlsl` (`CSMain`; an empty one in the start) and `screenQuad.hlsl`
(`VSMain` / `PSMain`: the texture over the window).

**Screenshot time: 1.0 s** (the pattern moves with the time from the `time` task on; the earlier states are still).

**Fixed choices (the same in every API – see the OpenGL tasks.md):** the texture is as large as the window, **800 ×
600** (`TEXTURE_WIDTH`, `TEXTURE_HEIGHT`; learnopengl: 1000 × 1000), four 32-bit floats per texel, linear filtering,
clamped; thread groups of **10 × 10 × 1**, **80 × 60 × 1** groups per dispatch; the pattern `value.x = mod(x + t * 100,
800) / 800`, `value.y = y / 600`, blue 0, alpha 1, with `t` the time in seconds; the start fills the texture from the
CPU with dark blue (0, 0, 0.5, 1) so the quad shows something before the compute shader exists; learnopengl's screen
quad (4 vertices, NDC ±1, a triangle strip); clear (0, 0, 0).

**Direct3D 12's choices:**
- **The texture**: `DXGI_FORMAT_R32G32B32A32_FLOAT` in a default heap; from `image-unit` on with
  `D3D12_RESOURCE_FLAG_ALLOW_UNORDERED_ACCESS` (a shader may write it). Two views in the shader-visible heap: the SRV in
  slot 0 (the quad's `Texture2D tex : register(t0)`) and, from `image-unit` on, the **UAV** in slot 1 (the compute
  shader's `RWTexture2D<float4> imgOutput : register(u0)`) – Direct3D's image unit is an unordered access view. In the
  start the texture is created in `COPY_DEST`, filled through an upload heap with `UpdateSubresources` (`std::vector<float>
  pixels`, `RowPitch = TEXTURE_WIDTH * 4 * sizeof(float)`) and turned into `PIXEL_SHADER_RESOURCE`; from
  `compute-shader` on it has no data and starts in `UNORDERED_ACCESS`.
- **The compute pipeline**: its own root signature (`m_computeRootSignature`: parameter 0 a table with the UAV at u0,
  from `time` on parameter 1 one 32-bit root constant at b0 – the time; no input-assembler flag, a compute shader has no
  vertices) and a **compute pipeline state** (`D3D12_COMPUTE_PIPELINE_STATE_DESC`: only the root signature and
  `CS = CSMain` compiled as `cs_5_0`; `CreateComputePipelineState`). The same direct command list records the compute
  work and the drawing (a direct queue runs both; the nBodyGravity sample uses a separate compute queue to overlap them –
  not needed here).
- **One frame** (`PopulateCommandList`): `SetDescriptorHeaps`, then `SetPipelineState(m_computePipelineState)`,
  `SetComputeRootSignature`, `SetComputeRootDescriptorTable(0, UAV)`, `SetComputeRoot32BitConstants(1, …)`,
  `Dispatch(TEXTURE_WIDTH / 10, TEXTURE_HEIGHT / 10, 1)` (= 80 × 60 × 1), then a **transition barrier
  UNORDERED_ACCESS → PIXEL_SHADER_RESOURCE** (OpenGL's `glMemoryBarrier(GL_SHADER_IMAGE_ACCESS_BARRIER_BIT)`: the quad
  must not read before the compute shader has written, and the texture changes its role), then the graphics pipeline
  state, root signature and SRV table and the quad; at the end of the frame the barrier back to UNORDERED_ACCESS for the
  next frame's dispatch. Compute and graphics have separate root signatures and separate `SetCompute…` / `SetGraphics…`
  calls.
- **The shader**: `[numthreads(10, 10, 1)]` (`local_size_x/y/z`), `uint3 dispatchThreadID : SV_DispatchThreadID`
  (`gl_GlobalInvocationID`), `imgOutput[texelCoord] = value;` (`imageStore`). HLSL has no `gl_NumWorkGroups`: the
  divisor `gl_NumWorkGroups.x * gl_WorkGroupSize.x` (all threads in x = the texture's width, as the dispatch covers the
  texture exactly) is the texture's size from `imgOutput.GetDimensions(imageWidth, imageHeight)`. `fmod` for `mod` (the
  same for positive numbers).
- **The same picture as OpenGL's**: the compute shader writes texel (x, y) with y counting the texture's rows from row 0
  (Direct3D's first row, its "top"). The quad keeps learnopengl's texture coordinates – v = 1 at the top of the window,
  v = 0 at the bottom – so row 0 lands at the **bottom** of the window, as in OpenGL (where v = 0 is row 0 too): window
  pixel (x, y) shows texel (x, 599 - y) in both APIs, green 0 at the bottom. (Direct3D's usual flipped v for images is not
  wanted here: this texture is not an image file, and the shader decides what row 0 is.)
- **Time**: `std::chrono` in `PopulateCommandList` (`static auto startTime`; the course's earlier Direct3D 12 chapters
  measure time the same way; the simulator gives frame n the time n / 60), passed as `TimeConstants { float t; }`.
- **The limits** (task `limits`): Direct3D 12 fixes them for every device, as constants in `d3d12.h`:
  `D3D12_CS_DISPATCH_MAX_THREAD_GROUPS_PER_DIMENSION` = 65535 (x, y and z), `D3D12_CS_THREAD_GROUP_MAX_X` = 1024,
  `_MAX_Y` = 1024, `_MAX_Z` = 64, `D3D12_CS_THREAD_GROUP_MAX_THREADS_PER_GROUP` = 1024 – OpenGL asks the driver (at
  least these numbers; see the OpenGL tasks.md for what real GPUs report). A Windows program has no console: the text
  goes to the debugger's output window (`OutputDebugStringA`).

**What the window shows**: the texture over the whole window; window pixel (x, y) shows texel (x, 599 - y). Named points
(OpenGL's): **top-left** (0,0), **left** (100,300), **centre** (400,300), **wrap-a** (699,300), **wrap-b** (700,300),
**bottom-right** (799,599), **top** (400,0), **bottom** (400,599).

**Start picture**: the CPU-filled texture: dark blue 0,0,128 everywhere.

## `limits`
- **Task:** Write the limits of compute work to the debugger's output: the most thread groups per dispatch in x, y and z, the largest thread group in x, y and z, and the most threads one thread group may have – in Direct3D 12 they are constants, the same on every device.
- **Hint:** `snprintf` into a `char text[512]` with `D3D12_CS_DISPATCH_MAX_THREAD_GROUPS_PER_DIMENSION`, `D3D12_CS_THREAD_GROUP_MAX_X`, `_MAX_Y`, `_MAX_Z` and `D3D12_CS_THREAD_GROUP_MAX_THREADS_PER_GROUP`, then `OutputDebugStringA(text);` – in `LoadPipeline` after the device is created.
- **When done:** `main.cpp`: the `// query limitations` block with the five constants and `OutputDebugStringA` (`Direct3D
  12 limitations:` …, 65535, 1024, 1024, 64, 1024). **No visible change** (dark blue).

## `image-unit`
- **Task:** Make the texture writable from a shader: create it with `D3D12_RESOURCE_FLAG_ALLOW_UNORDERED_ACCESS`, give the heap a second slot and create an unordered access view (UAV) of the texture's level 0 in it – Direct3D's image unit.
- **Hint:** `CD3DX12_RESOURCE_DESC::Tex2D(DXGI_FORMAT_R32G32B32A32_FLOAT, TEXTURE_WIDTH, TEXTURE_HEIGHT, 1, 1, 1, 0, D3D12_RESOURCE_FLAG_ALLOW_UNORDERED_ACCESS)`, `srvUavHeapDesc.NumDescriptors = 2;`, a `D3D12_UNORDERED_ACCESS_VIEW_DESC` with `DXGI_FORMAT_R32G32B32A32_FLOAT`, `D3D12_UAV_DIMENSION_TEXTURE2D`, `Texture2D.MipSlice = 0`, and `CreateUnorderedAccessView(m_texture.Get(), nullptr, &uavDesc, uavHandle)` with the handle of slot 1.
- **When done:** `main.cpp`: `NumDescriptors = 2`, the texture with `D3D12_RESOURCE_FLAG_ALLOW_UNORDERED_ACCESS`, the UAV
  in heap slot 1. **No visible change** (dark blue).

## `compute-shader`
- **Task:** Write the compute shader – thread groups of 10 × 10 × 1 threads, the texture as `RWTexture2D<float4> imgOutput` at u0, and in `CSMain` one thread per texel that writes red = x / width and green = y / height – build its root signature and compute pipeline state, and every frame dispatch 80 × 60 thread groups followed by a transition barrier before the quad reads the texture (and the barrier back at the end of the frame). The CPU fill is no longer needed: create the texture without data, in the `UNORDERED_ACCESS` state.
- **Hint:** HLSL: `[numthreads(10, 10, 1)] void CSMain(uint3 dispatchThreadID : SV_DispatchThreadID)`, `int2 texelCoord = int2(dispatchThreadID.xy);`, `imgOutput.GetDimensions(imageWidth, imageHeight);`, `value.x = float(texelCoord.x) / imageWidth;`, `imgOutput[texelCoord] = value;`. C++: a root signature with `ranges[0].Init(D3D12_DESCRIPTOR_RANGE_TYPE_UAV, 1, 0)`, `D3DCompileFromFile(L"computeShader.hlsl", nullptr, nullptr, "CSMain", "cs_5_0", …)`, `D3D12_COMPUTE_PIPELINE_STATE_DESC` + `CreateComputePipelineState`; in `PopulateCommandList` `SetPipelineState(m_computePipelineState.Get())`, `SetComputeRootSignature`, `SetComputeRootDescriptorTable(0, …slot 1…)`, `Dispatch(TEXTURE_WIDTH / 10, TEXTURE_HEIGHT / 10, 1)`, `CD3DX12_RESOURCE_BARRIER::Transition(m_texture.Get(), D3D12_RESOURCE_STATE_UNORDERED_ACCESS, D3D12_RESOURCE_STATE_PIXEL_SHADER_RESOURCE)`, then `SetPipelineState(m_pipelineState.Get())` for the quad.
- **When done:** `computeShader.hlsl`: `RWTexture2D<float4> imgOutput : register(u0);`, `[numthreads(10, 10, 1)]`,
  `SV_DispatchThreadID`, `GetDimensions`, `value.x` / `value.y`, the store. `main.cpp`: `m_computeRootSignature`,
  `m_computePipelineState`, the compute root signature and pipeline state, the texture created in
  `D3D12_RESOURCE_STATE_UNORDERED_ACCESS` without the upload (no `pixels`, no `textureUploadHeap`), in
  `PopulateCommandList` the dispatch, the barrier to `PIXEL_SHADER_RESOURCE`, `SetPipelineState(m_pipelineState.Get())`
  and the barrier back to `UNORDERED_ACCESS` at the end. **A red-green gradient**: black at the bottom left, red to the
  right, green to the top, yellow at the top right: top-left = 0,255,0, left = 32,127,0, centre = 128,127,0, wrap-a =
  223,127,0, wrap-b = 223,127,0, bottom-right = 255,0,0, top = 128,255,0, bottom = 128,0,0. Still (no time yet).

## `time`
- **Task:** Animate it: give the compute shader the time as a root constant `t` (register b0) and shift the red ramp to the right by `t * speed` texels (speed 100), wrapping around at the texture's width (800) with `fmod`. Set `t` every frame from C++.
- **Hint:** HLSL: `cbuffer TimeConstants : register(b0) { float t; };`, `value.x = fmod(float(texelCoord.x) + t * speed, width) / imageWidth;` with `float speed = 100.0f; float width = 800.0f;`. C++: `struct TimeConstants { float t; };`, the compute root signature's second parameter `rootParameters[1].InitAsConstants(sizeof(TimeConstants) / 4, 0);`, the time from `std::chrono` (`static auto startTime`) and `SetComputeRoot32BitConstants(1, sizeof(TimeConstants) / 4, &timeConstants, 0);` before the dispatch.
- **When done:** `computeShader.hlsl`: `cbuffer TimeConstants`, `speed`, `width`, the `fmod`. `main.cpp`: `struct
  TimeConstants`, `rootParameters[2]` with the root constant, the frame time (`currentFrame`), `timeConstants.t =
  currentFrame;` and `SetComputeRoot32BitConstants`. **The red ramp moves right**, 100 texels per second, and wraps: at
  **1.0 s** red = mod(x + 100, 800) / 800, so the brightest red is at x = 699 and it starts again from 0 at x = 700:
  top-left = 32,255,0, left = 64,127,0, centre = 159,127,0, wrap-a = 255,127,0, wrap-b = 0,127,0, bottom-right = 32,0,0,
  top = 159,255,0, bottom = 159,0,0. This is the solution.

*Simulator:* no state of this project shows the right picture yet. The start (and `limits`, `image-unit`) shows black
instead of dark blue: the `std::vector<float>` filled in a loop over 480,000 texels and uploaded with
`UpdateSubresources` into the R32G32B32A32_FLOAT texture does not arrive (only the bottom row has a few odd pixels).
From `compute-shader` on everything is black: the simulator has no compute stage – `CreateComputePipelineState`,
`SetComputeRootSignature` / `SetComputeRootDescriptorTable` / `SetComputeRoot32BitConstants`, `Dispatch`, `RWTexture2D`
stores and the UAV are not followed (see the D3D12 writer's report).
