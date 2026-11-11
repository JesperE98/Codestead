# Debugging – tasks (DirectX 12)

learnopengl.com "Debugging": `src/7.in_practice/1.debugging`. The scene is learnopengl's demo: one wood cube
(`wood.png`, learnopengl's 36 vertices – position + texture coordinates, every face counter-clockwise seen from
outside – with v flipped for Direct3D) 2.5 units in front of the camera, turning `time * 10` degrees about (1, 1, 1);
projection 45°, 800/600, near 0.1, far **10**; no view matrix; clear colour **(0.2, 0.3, 0.3)** (OpenGL's choice: on
learnopengl's black the black cube of the middle steps would not show); depth test on; back-face
culling with `FrontCounterClockwise = TRUE` (learnopengl's `glEnable(GL_CULL_FACE)`). Files: `main.cpp`,
`debugging.hlsl`, `wood.png`. Root parameter 0: root constants `ModelConstants { model }` (b0, vertex shader);
root parameter 1: the CBV table (b1, `SceneConstantBuffer { projection }`, heap slot 0); root parameter 2: the
texture's SRV table (t0, heap slot 1); static sampler s0 linear WRAP.

**The start has two mistakes** (like learnopengl's demo, which has two: `glTexImage2D(GL_FRAMEBUFFER, …)` and a
uniform set before `shader.use()`), found with the debug layer's tools and then fixed:

1. In `PopulateCommandList` the descriptor heap is never set: the `SetDescriptorHeaps` call before the two
   `SetGraphicsRootDescriptorTable` calls is missing (the comment above them still mentions the heap). Root
   parameters 1 and 2 then point into a heap the command list does not have: the projection (CBV) and the texture
   (SRV) are not there for the draw – **nothing is visible** (learnopengl's projection that never reaches the shader).
2. In `LoadTexture` the shader resource view's `srvDesc.Texture2D.MipLevels` is never set: the description is
   zero-initialised (`= {}`), so the view asks for 0 mip levels, which is invalid. `CreateShaderResourceView` returns
   nothing (void), the debug layer reports it, and the descriptor in slot 1 stays invalid: the texture reads as
   **black** (learnopengl's incomplete texture).

The debug layer itself (`D3D12GetDebugInterface` + `EnableDebugLayer` in `#if defined(_DEBUG)`) has been in every
chapter since `creating-a-window`; this chapter reads its messages. It only exists in a debug build with the Windows
"Graphics Tools" optional feature installed; its messages appear in the debugger's Output window (Visual Studio:
F5, Output → Debug) as lines like
`D3D12 ERROR: <call>: <description> [ <CATEGORY> ERROR #<id>: <ID_NAME>]`.

Compared with OpenGL: `glGetError` ↔ polling the **info queue** (`ID3D12InfoQueue`: the stored messages);
the debug callback ↔ `ID3D12InfoQueue1::RegisterMessageCallback` (+ `SetBreakOnSeverity`, which makes the debugger
stop at the guilty call); object labels (`glObjectLabel`) ↔ `SetName`; framebuffer completeness has no D3D12
counterpart (resources and views are checked by the debug layer when they are created). There is no 4.3-context
question: the debug layer works with every Direct3D 12 device. The real debug layer has more: GPU-based validation
(`ID3D12Debug1::SetEnableGPUBasedValidation`) checks resource states and descriptors while the GPU runs, and DRED
reports where a removed device crashed – mention, no task. Graphics debuggers: PIX on Windows, RenderDoc
(learnopengl's "external debugging software" section).

Task order: `info-queue`, `set-name`, `descriptor-heaps`, `debug-callback`, `fix-texture`, `shader-output`
(OpenGL: check-error, use-program, debug-output, fix-texture, shader-output – `set-name` is extra in Direct3D 12).

## Messages (what the real debug layer reports – for the simulator)

- **M1** (mistake 1), at each `SetGraphicsRootDescriptorTable` call of `PopulateCommandList` (root parameter 1 and 2:
  two per frame), severity ERROR, category EXECUTION, ID 708 (`D3D12_MESSAGE_ID_SET_DESCRIPTOR_TABLE_INVALID`):
  `CGraphicsCommandList::SetGraphicsRootDescriptorTable: The descriptor heap (0x0000020B6E3A4F10:'Unnamed ID3D12DescriptorHeap Object') containing handle 0x0000020B6E5B3000 is different from currently set descriptor heap 0x0000000000000000:'(nullptr)'.`
  (Output window: `D3D12 ERROR: … [ EXECUTION ERROR #708: SET_DESCRIPTOR_TABLE_INVALID]`.) The addresses vary; after
  `set-name` the heap's name replaces `Unnamed ID3D12DescriptorHeap Object`: `'CBV/SRV heap'`.
- **M2** (mistake 2), once, at `CreateShaderResourceView` in `LoadTexture` (during `LoadAssets`), severity ERROR,
  category STATE_CREATION, ID 31 (`D3D12_MESSAGE_ID_CREATESHADERRESOURCEVIEW_INVALIDDIMENSIONS`):
  `ID3D12Device::CreateShaderResourceView: The Dimensions of the View are invalid due to at least one of the following conditions. MostDetailedMip (value = 0) must be between 0 and MipLevels-1 of the Texture Resource, 0, inclusively. With the current MostDetailedMip, MipLevels (value = 0) must be between 1 and 1, inclusively, or -1 to default to all mips from MostDetailedMip, in order that the View fit on the Texture.`
  (Output window: `… [ STATE_CREATION ERROR #31: CREATESHADERRESOURCEVIEW_INVALIDDIMENSIONS]`.)
  (This is the debug layer's wording as Windows prints it; it could not be run here – the course runs no Windows.)

What the simulator does (src/GP/Codestead.GP.Gpu/Readers/D3D12Device.Debug.cs):
the debug layer's messages exist only when `EnableDebugLayer` is called; the program sees them only through the
calls below. Picture: with mistake 1, nothing is drawn (only the clear colour); with mistake 2 only, the cube is black (an
invalid SRV reads as 0).

## info-queue
- **Task:** Read the debug layer's messages: get the device's info queue (`m_device.As(&m_infoQueue)`), write
  `CheckDebugMessages_(infoQueue, file, line)` and the macro `CheckDebugMessages()`, and call it after `LoadTexture`
  and after `ExecuteCommandLists` in `OnRender`.
- **Hint:** Like learnopengl's `glCheckError_`: for each of the `GetNumStoredMessages()` stored messages, call
  `GetMessage(i, nullptr, &messageLength)` for its size, `malloc` that much, `GetMessage(i, message, &messageLength)`,
  print `SeverityName(message->Severity)`, `message->ID`, `message->pDescription`, the file and the line with
  `OutputDebugStringA`, `free` it; then `ClearStoredMessages()`. In a release build there is no info queue: return
  when it is `nullptr`.
- **Observable (code):** `m_device.As(&m_infoQueue)` in `LoadPipeline` inside `#if defined(_DEBUG)` after
  `D3D12CreateDevice`; the function `CheckDebugMessages_` with `GetNumStoredMessages`, `GetMessage` (twice),
  `pDescription`, `OutputDebugStringA`, `ClearStoredMessages`; `#define CheckDebugMessages() CheckDebugMessages_(m_infoQueue.Get(), __FILE__, __LINE__)`;
  `CheckDebugMessages();` after `LoadTexture("wood.png", …)` and after `ExecuteCommandLists` in `OnRender`.
- **Observable (output):** after `LoadTexture`: `ERROR #31: ID3D12Device::CreateShaderResourceView: The Dimensions of the View are invalid … | main.cpp (<line>)`
  once; after each frame's `ExecuteCommandLists`: `ERROR #708: CGraphicsCommandList::SetGraphicsRootDescriptorTable: The descriptor heap (…:'Unnamed ID3D12DescriptorHeap Object') … is different from currently set descriptor heap 0x0000000000000000:'(nullptr)'. | main.cpp (<line>)`
  twice per frame. **Picture:** only the clear colour (51, 76, 76) – unchanged from the start.

## set-name
- **Task:** Give the objects names with `SetName`: the three heaps (`L"RTV heap"`, `L"DSV heap"`, `L"CBV/SRV heap"`),
  each render target (`L"Render target 0"`, `L"Render target 1"`), the root signature, the pipeline state, the vertex
  buffer, the texture (`L"wood.png"`), the constant buffer and the depth buffer.
- **Hint:** The debug layer's messages (and PIX) name objects by these names instead of
  "Unnamed ID3D12… Object". `SetName` takes a wide string: `std::wstring name = L"Render target " + std::to_wstring(n);`.
- **Observable (code):** `m_cbvSrvHeap->SetName(L"CBV/SRV heap")`, `m_rtvHeap->SetName(L"RTV heap")`,
  `m_dsvHeap->SetName(L"DSV heap")`; `m_renderTargets[n]->SetName(name.c_str())` in the render target loop;
  `SetName` on `m_rootSignature`, `m_pipelineState`, `m_vertexBuffer`, `m_texture` (`L"wood.png"`), `m_constantBuffer`,
  `m_depthStencil` at the end of `LoadAssets` (before `Close`).
- **Observable (output):** the M1 messages now say `The descriptor heap (0x…:'CBV/SRV heap') containing handle … is different from currently set descriptor heap 0x0000000000000000:'(nullptr)'.`
  **Picture:** unchanged (clear colour only).

## descriptor-heaps
- **Task:** Fix the first mistake: set the CBV/SRV heap on the command list before the descriptor tables –
  `ID3D12DescriptorHeap* ppHeaps[] = { m_cbvSrvHeap.Get() };` and `m_commandList->SetDescriptorHeaps(_countof(ppHeaps), ppHeaps);`.
- **Hint:** A descriptor table (`SetGraphicsRootDescriptorTable`) is a GPU handle into the shader-visible heap that
  is set on the command list; message #708 says that no heap is set (`(nullptr)`).
- **Observable (code):** `SetDescriptorHeaps(_countof(ppHeaps), ppHeaps)` in `PopulateCommandList` before
  `SetGraphicsRootDescriptorTable(1, …)`.
- **Observable (output):** message #708 is gone; #31 (once, at the start) remains.
- **Picture:** the cube is drawn now, with the projection – but **black** (the texture's view is still invalid): the
  cube's outline (x 214..602, y 118..512 at t = 1 s) black (0, 0, 0) at centre (400, 300), top (400, 150), lower-right
  (560, 450); background (100, 100), left (150, 300) (51, 76, 76). (OpenGL's `use-program` looks the same.)

## debug-callback
- **Task:** Write `D3D12DebugOutput(category, severity, id, description, context)` and, in `LoadPipeline`, with the
  info queue: break on errors when a debugger is attached (`SetBreakOnSeverity` for CORRUPTION and ERROR, only
  `if (IsDebuggerPresent())`), and register the callback with `ID3D12InfoQueue1::RegisterMessageCallback`.
- **Hint:** learnopengl's `glDebugOutput`: print "Debug message (id): description", the category and the severity.
  `ID3D12InfoQueue1` exists on Windows 11 (or with the Agility SDK): get it with `m_infoQueue.As(&infoQueue1)` and only
  register if that succeeds. A break without a debugger ends the program – hence `IsDebuggerPresent()`.
- **Observable (code):** the function `D3D12DebugOutput` (`CALLBACK`, parameters `D3D12_MESSAGE_CATEGORY`,
  `D3D12_MESSAGE_SEVERITY`, `D3D12_MESSAGE_ID`, `LPCSTR`, `void*`) printing with `OutputDebugStringA`;
  `if (m_infoQueue)` with `IsDebuggerPresent()`, `SetBreakOnSeverity(D3D12_MESSAGE_SEVERITY_CORRUPTION, TRUE)`,
  `SetBreakOnSeverity(D3D12_MESSAGE_SEVERITY_ERROR, TRUE)`, `ComPtr<ID3D12InfoQueue1> infoQueue1`,
  `m_infoQueue.As(&infoQueue1)` and `infoQueue1->RegisterMessageCallback(D3D12DebugOutput, D3D12_MESSAGE_CALLBACK_FLAG_NONE, nullptr, &callbackCookie)`.
- **Observable (output):** at `CreateShaderResourceView`, right away:
  `---------------` / `Debug message (31): ID3D12Device::CreateShaderResourceView: The Dimensions of the View are invalid …` /
  `Category: State creation` / `Severity: ERROR`; with a debugger attached, the program stops at the
  `CreateShaderResourceView` line in `LoadTexture`. (The callback sees every message, also those
  `CheckDebugMessages` prints from the queue afterwards.) **Picture:** unchanged (the black cube).

## fix-texture
- **Task:** Fix the second mistake: in `LoadTexture`, give the shader resource view the texture's one mip level:
  `srvDesc.Texture2D.MipLevels = 1;`.
- **Hint:** Message #31 says MipLevels (value = 0) must be between 1 and 1. The description was zero-initialised.
- **Observable (code):** `srvDesc.Texture2D.MipLevels = 1;` after `srvDesc.ViewDimension = D3D12_SRV_DIMENSION_TEXTURE2D;`.
- **Observable (output):** no messages any more.
- **Picture (t = 1 s, cube turned 10°):** the wood cube in the middle: centre (400, 300) = (186, 127, 78), top
  (400, 150) = (179, 122, 75), lower-right (560, 450) = (166, 114, 69); background (100, 100) and left (150, 300)
  (51, 76, 76). The cube covers about x 214..602, y 118..512 (mostly its front face). Time-dependent (10°/s).
  Identical to OpenGL's fix-texture screenshot (simulator render compared: 2 pixels differ, at an edge).

## shader-output
- **Task:** Debug the shader's output: let `PSMain` return the texture coordinates as a colour,
  `return float4(input.texCoord, 0.0f, 1.0f);` (the texture line kept as a comment).
- **Hint:** learnopengl's "Debugging shader output": write the value you want to check as the colour. Direct3D's v
  runs downwards (the course flips v so images are upright), so the green grows towards the bottom of each face –
  in OpenGL it grows towards the top.
- **Observable:** `return float4(input.texCoord, 0.0f, 1.0f);` in `PSMain` of `debugging.hlsl`.
- **Picture (t = 1 s):** centre (400, 300) = (116, 114, 0), top (400, 150) = (125, 11, 0), lower-right (560, 450) =
  (222, 237, 0); the front face's corners: top-left (220, 150) ≈ (4, 1, 0), top-right (575, 125) ≈ (251, 4, 0),
  bottom-left (260, 505) ≈ (3, 249, 0), bottom-right (600, 460) ≈ (252, 248, 0); background (51, 76, 76). **Differs from
  OpenGL in the green channel** (OpenGL: top (400, 150) = (125, 244, 0), lower-right = (222, 18, 0)): Direct3D's v is
  OpenGL's 1 - v (the course flips v so the image is upright), so green = v grows downwards here. Deliberate: the task
  shows the value the shader really has.
