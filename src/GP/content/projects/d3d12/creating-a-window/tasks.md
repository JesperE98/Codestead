# creating-a-window – DirectX 12

Start: `main.cpp` with the includes, `ThrowIfFailed`, the class `D3D12App` (members `m_device`,
`m_commandQueue`), and a complete Win32 part: `wWinMain` registers the window class (`RegisterClassExW`), computes
the window size for an 800×600 client area (`AdjustWindowRect`), creates the window titled `L"LearnDirectX"`
(`CreateWindowW`), shows it and runs the message loop `while (msg.message != WM_QUIT)` with `PeekMessage`.
`WindowProc` handles `WM_DESTROY` (`PostQuitMessage`). `LoadPipeline()` and the body of `GetHardwareAdapter()`
are TODOs. So the start already opens a window that stays open until it is closed; nothing is drawn in it (the
client area is never painted: no background brush, no swap chain) – this stays so for the whole chapter.

Note on the order: `factory` comes before `debug-layer` so that every step compiles without warnings
(`debug-layer` adds the `dxgiFactoryFlags` variable and passes it to the factory). The debug layer only exists in
debug builds (`#if defined(_DEBUG)`).

## factory
- **Task:** Create the DXGI factory: `ComPtr<IDXGIFactory4> factory;` and `CreateDXGIFactory2(0, IID_PPV_ARGS(&factory))`, wrapped in `ThrowIfFailed`.
- **Hint:** DXGI is the part of Windows that knows the GPUs (adapters) and makes swap chains. `IID_PPV_ARGS` passes the interface ID and the pointer to fill in.
- **Observable:** `CreateDXGIFactory2(0, IID_PPV_ARGS(&factory))` in `LoadPipeline`. The window looks the same.

## debug-layer
- **Task:** In debug builds, enable the D3D12 debug layer before anything else: `D3D12GetDebugInterface` + `EnableDebugLayer()`, and create the factory with `DXGI_CREATE_FACTORY_DEBUG`.
- **Hint:** Put it between `#if defined(_DEBUG)` and `#endif`. Collect the factory flags in `UINT dxgiFactoryFlags = 0;` and pass them to `CreateDXGIFactory2` instead of `0`.
- **Observable:** `UINT dxgiFactoryFlags = 0;`, an `#if defined(_DEBUG)` block with `D3D12GetDebugInterface(IID_PPV_ARGS(&debugController))`, `debugController->EnableDebugLayer()` and `dxgiFactoryFlags |= DXGI_CREATE_FACTORY_DEBUG`; the call is now `CreateDXGIFactory2(dxgiFactoryFlags, IID_PPV_ARGS(&factory))`. The window looks the same (in a debug build the debug layer now reports API misuse in the debugger's output).

## device
- **Task:** Fill in `GetHardwareAdapter` (go through the adapters with `EnumAdapters1`, skip software adapters, keep the first one for which `D3D12CreateDevice(adapter.Get(), D3D_FEATURE_LEVEL_11_0, __uuidof(ID3D12Device), nullptr)` succeeds) and create the device in `LoadPipeline` with `D3D12CreateDevice(hardwareAdapter.Get(), D3D_FEATURE_LEVEL_11_0, IID_PPV_ARGS(&m_device))`.
- **Hint:** Passing `nullptr` as the last argument only tests whether the adapter supports Direct3D 12. Software adapters have `DXGI_ADAPTER_FLAG_SOFTWARE` in `desc.Flags`. Return the adapter with `*ppAdapter = adapter.Detach();`.
- **Observable:** `EnumAdapters1`, `GetDesc1`, the `DXGI_ADAPTER_FLAG_SOFTWARE` test and `adapter.Detach()` in `GetHardwareAdapter`; `GetHardwareAdapter(factory.Get(), &hardwareAdapter)` and `D3D12CreateDevice(..., D3D_FEATURE_LEVEL_11_0, IID_PPV_ARGS(&m_device))` in `LoadPipeline`. The window looks the same.

## command-queue
- **Task:** Describe and create the command queue: a `D3D12_COMMAND_QUEUE_DESC` with `Type = D3D12_COMMAND_LIST_TYPE_DIRECT`, then `m_device->CreateCommandQueue(&queueDesc, IID_PPV_ARGS(&m_commandQueue))`.
- **Hint:** The CPU records commands into command lists and hands them to the GPU through a queue. A DIRECT queue takes every kind of command (drawing, compute, copies).
- **Observable:** `queueDesc.Type = D3D12_COMMAND_LIST_TYPE_DIRECT` and `CreateCommandQueue(&queueDesc, IID_PPV_ARGS(&m_commandQueue))`. The window looks the same; the program is complete for this chapter (solution).
