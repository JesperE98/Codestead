# API symbols

Every function, type and constant of each API, taken from the real headers. The simulated build uses them to
report a misspelt name the way a compiler would ("'glClearColour' was not declared in this scope; did you mean
'glClearColor'?"). Regenerate them when an API gets new names:

- `opengl.txt`: `GL/glcorearb.h` (Khronos), `GLFW/glfw3.h`, and GLAD's loader functions.
- `vulkan.txt`: `vulkan/vulkan_core.h` without vendor-specific extensions (NV, AMD, INTEL …), and `GLFW/glfw3.h`.
- `d3d12.txt`: `d3d12.h` and the `d3dx12*.h` helpers from microsoft/DirectX-Headers, MinGW-w64's `dxgi*.h` and
  `d3dcompiler.h`, and DirectXMath (without the video API).
- `d3d12-methods.txt`: the methods of the D3D12 and DXGI interfaces, the d3dx12 helpers and `ComPtr`, checked
  after `->`.

See the commands in the commit that added this folder, or regenerate with grep over the headers using the
patterns in `Codestead.GP.Gpu/Build/BuildChecker.cs`.
