# hello-window – DirectX 12

Follows Microsoft's D3D12HelloWindow sample. Start = `creating-a-window/solution` grown to the sample's shape:
the class now declares everything of HelloWindow (`FrameCount = 2`, `m_swapChain`, `m_renderTargets[FrameCount]`,
`m_commandAllocator`, `m_rtvHeap`, `m_pipelineState` (stays null in this chapter, as in the sample),
`m_commandList`, `m_rtvDescriptorSize`, `m_frameIndex`, `m_fenceEvent`, `m_fence`, `m_fenceValue`) and the
functions `LoadAssets`, `OnUpdate` (empty), `OnRender`, `PopulateCommandList`, `WaitForPreviousFrame` – with TODO
bodies. `OnInit` calls `LoadPipeline()` then `LoadAssets()`. The start compiles; it opens the "LearnDirectX"
window (800×600 client area) that stays open, nothing is drawn in it yet (unpainted), and closes with the window's
close button only.

Until `render` is done nothing is presented: the client area stays unpainted after every earlier task.

## swap-chain
- **Task:** At the end of `LoadPipeline`, create the swap chain (`DXGI_SWAP_CHAIN_DESC1`: `BufferCount = FrameCount`, `m_width`×`m_height`, `DXGI_FORMAT_R8G8B8A8_UNORM`, `DXGI_USAGE_RENDER_TARGET_OUTPUT`, `DXGI_SWAP_EFFECT_FLIP_DISCARD`, `SampleDesc.Count = 1`) with `factory->CreateSwapChainForHwnd(m_commandQueue.Get(), m_hwnd, ...)`, turn off Alt+Enter with `MakeWindowAssociation(m_hwnd, DXGI_MWA_NO_ALT_ENTER)`, get `IDXGISwapChain3` with `swapChain.As(&m_swapChain)` and store `m_frameIndex = m_swapChain->GetCurrentBackBufferIndex()`.
- **Hint:** The swap chain owns the two back buffers we draw into and shows them in the window in turn. It is created on the command queue (not the device) so it can flush it.
- **Observable:** `CreateSwapChainForHwnd`, `BufferCount = FrameCount` (2), `SwapEffect = DXGI_SWAP_EFFECT_FLIP_DISCARD`, `MakeWindowAssociation(..., DXGI_MWA_NO_ALT_ENTER)`, `GetCurrentBackBufferIndex()`. Window unchanged (nothing presented yet).

## render-targets
- **Task:** Create a render target view (RTV) descriptor heap with `FrameCount` descriptors (`D3D12_DESCRIPTOR_HEAP_TYPE_RTV`), store `m_rtvDescriptorSize = GetDescriptorHandleIncrementSize(D3D12_DESCRIPTOR_HEAP_TYPE_RTV)`, then for each back buffer `GetBuffer(n, ...)` + `CreateRenderTargetView` and move the handle on with `rtvHandle.Offset(1, m_rtvDescriptorSize)`.
- **Hint:** A descriptor tells the GPU how to use a resource; the RTVs say "this back buffer is a render target". Descriptors sit next to each other in the heap, `m_rtvDescriptorSize` bytes apart.
- **Observable:** `CreateDescriptorHeap` with `NumDescriptors = FrameCount` and `Type = D3D12_DESCRIPTOR_HEAP_TYPE_RTV`, `GetDescriptorHandleIncrementSize`, a loop with `GetBuffer`, `CreateRenderTargetView`, `rtvHandle.Offset(1, m_rtvDescriptorSize)`. Window unchanged.

## command-list
- **Task:** Create the command allocator at the end of `LoadPipeline` (`CreateCommandAllocator(D3D12_COMMAND_LIST_TYPE_DIRECT, ...)`), and in `LoadAssets` the command list (`CreateCommandList(0, D3D12_COMMAND_LIST_TYPE_DIRECT, m_commandAllocator.Get(), nullptr, ...)`) – then `Close()` it.
- **Hint:** The allocator holds the memory of the recorded commands; the list records into it. A new command list is open for recording; the render loop expects it closed.
- **Observable:** `CreateCommandAllocator`, `CreateCommandList` with a null initial pipeline state, `m_commandList->Close()`. Window unchanged.

## fence
- **Task:** In `LoadAssets`, create the fence (`CreateFence(0, D3D12_FENCE_FLAG_NONE, ...)`, `m_fenceValue = 1`) and an event (`CreateEvent`). Fill in `WaitForPreviousFrame` (Signal the fence value on the queue, increment it, wait on the event with `SetEventOnCompletion` + `WaitForSingleObject` if the GPU has not reached it, then update `m_frameIndex`) and `OnDestroy` (`WaitForPreviousFrame()`, `CloseHandle(m_fenceEvent)`).
- **Hint:** The GPU runs behind the CPU. A fence is a counter the GPU sets when it gets to the `Signal` in the queue; waiting for it means the GPU has finished everything before.
- **Observable:** `CreateFence`, `CreateEvent`, `m_commandQueue->Signal(m_fence.Get(), fence)`, `GetCompletedValue`, `SetEventOnCompletion`, `WaitForSingleObject`, `CloseHandle(m_fenceEvent)` in `OnDestroy`. Window unchanged.

## clear
- **Task:** Fill in `PopulateCommandList`: reset the allocator and the list, transition the current back buffer from `D3D12_RESOURCE_STATE_PRESENT` to `D3D12_RESOURCE_STATE_RENDER_TARGET`, clear its RTV with `const float clearColor[] = { 0.2f, 0.3f, 0.3f, 1.0f };`, transition it back to `PRESENT`, `Close()`.
- **Hint:** Build each barrier in a local `CD3DX12_RESOURCE_BARRIER barrier = CD3DX12_RESOURCE_BARRIER::Transition(...)` and pass `&barrier` (taking the address of a temporary only compiles in MSVC). The RTV of back buffer `m_frameIndex` is `CD3DX12_CPU_DESCRIPTOR_HANDLE rtvHandle(m_rtvHeap->GetCPUDescriptorHandleForHeapStart(), m_frameIndex, m_rtvDescriptorSize)`.
- **Observable:** `m_commandAllocator->Reset()`, `m_commandList->Reset(...)`, two `ResourceBarrier` transitions (PRESENT→RENDER_TARGET, RENDER_TARGET→PRESENT), `ClearRenderTargetView(rtvHandle, clearColor, 0, nullptr)` with `{ 0.2f, 0.3f, 0.3f, 1.0f }`, `Close()`. Window still unchanged: `PopulateCommandList` is not called yet.

## render
- **Task:** Fill in `OnRender` (`PopulateCommandList()`, `ExecuteCommandLists`, `m_swapChain->Present(1, 0)`, `WaitForPreviousFrame()`) and call it from the main loop: when `PeekMessage` finds no message, `app.OnUpdate(); app.OnRender();` (an `else` branch).
- **Hint:** `Present(1, 0)` waits for the next vertical blank (vsync). Waiting for the GPU after every frame is simple, not fast – the samples do the same.
- **Observable:** `ExecuteCommandLists`, `Present(1, 0)`, the `else { app.OnUpdate(); app.OnRender(); }` branch in the loop. The client area is now cleared to `(0.2, 0.3, 0.3, 1.0)` (RGB 51, 77, 77) every frame – dark teal.

## input
- **Task:** Close the window when Escape is pressed: in `WindowProc`, handle `WM_KEYDOWN` and call `DestroyWindow(hWnd)` when `wParam == VK_ESCAPE`.
- **Hint:** Destroying the window sends `WM_DESTROY`, which posts `WM_QUIT`; the loop ends and `OnDestroy` waits for the GPU.
- **Observable:** `case WM_KEYDOWN:` with `if (wParam == VK_ESCAPE) DestroyWindow(hWnd);`. Pressing Escape closes the window (exit code 0). Same picture. Result = D3D12HelloWindow (with learnopengl's clear colour) + Escape.
