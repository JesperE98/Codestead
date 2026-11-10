# Gamma Correction – tasks (DirectX 12)

learnopengl.com "Gamma Correction": `src/5.advanced_lighting/2.gamma_correction`. Files: `main.cpp`,
`gamma_correction.hlsl` (`VSMain` as in Advanced Lighting; `BlinnPhong()` and `PSMain` with four lights), `wood.png`
(stored as sRGB colours, like a photo).

Scene: the floor of Advanced Lighting (±10 at y = -0.5, wood repeated 10× with the sampler's WRAP mode, v flipped),
learnopengl's four lights as globals `XMFLOAT4 lightPositions[]` = (-3, 0, 0), (-1, 0, 0), (1, 0, 0), (3, 0, 0) and
`XMFLOAT4 lightColors[]` = 0.25, 0.50, 0.75, 1.00 (grey to white), copied each frame in `OnUpdate` (a `for` loop) into the
constant buffer: `cbuffer SceneConstantBuffer : register(b0) { float4x4 view; float4x4 projection; float4
lightPositions[4]; float4 lightColors[4]; float3 viewPos; }`. **HLSL packing:** every element of a cbuffer array starts a
new 16-byte row, so an array of float3 would leave 4 bytes of padding after each element; the course uses float4 /
`XMFLOAT4` (w unused) so that the C++ struct and the HLSL layout are obviously the same (learnopengl's `vec3` arrays).
`BlinnPhong()`: diffuse + specular (Blinn-Phong, exponent 64.0) × light colour × attenuation, no ambient;
`color *= lighting`. Root signature: parameter 0 = the CBV table (b0, all shaders), parameter 1 = the SRV table (t0, the
wood). The camera globals at (0, 0, 3) looking down -z (fov 45, 800/600, 0.1, 100), clear (0.1, 0.1, 0.1), depth test on.

Start: **no gamma correction**: `LoadTexture` creates the texture (and its SRV, which copies the format) as
`DXGI_FORMAT_R8G8B8A8_UNORM` – sampling returns the image's gamma-encoded values as if they were linear –, linear
attenuation `1.0f / lightDistance`, the colour returned as it is. learnopengl switches all three with one `gamma` flag
(Space key); here each is its own task, so the flag is left out. (`distance` is an HLSL intrinsic function, so the
variable is called `lightDistance`.)

**Hardware alternative (explained, not used in the code):** Direct3D can encode to sRGB when it writes the render
target: an `_SRGB` render target view. The flip-model swap chain (`DXGI_SWAP_EFFECT_FLIP_DISCARD`) cannot be created
with an `_SRGB` format, but its `R8G8B8A8_UNORM` buffers can get an RTV with `D3D12_RENDER_TARGET_VIEW_DESC.Format =
DXGI_FORMAT_R8G8B8A8_UNORM_SRGB` (`ViewDimension = D3D12_RTV_DIMENSION_TEXTURE2D`) instead of `nullptr` in
`CreateRenderTargetView`; the PSO's `RTVFormats[0]` must then be `_SRGB` too, and the shader must not do the `pow` as
well. The course's projects use the plain UNORM view everywhere so that the colours match OpenGL's default framebuffer
(no encoding) – this chapter is where that choice matters. Doing it in the shader, as learnopengl does, keeps it under
your control (e.g. only in the last pass of a post-processing chain).

Pixels in the 800×600 client area from the top left; nothing depends on time. D3D12 cannot run here: the values are the
app's simulator (it decodes `_SRGB` textures), which follows every state of this chapter; they match the OpenGL project's
Mesa screenshots within 1–2/255. Light 2 (-1, 0, 0) lights the floor around (150,430), light 3 (1, 0, 0) around
(630,430) (lights 1 and 4 are outside the view; their light reaches the edges). **background** (400,100) = 26,26,26 in
every state.

**Start picture:** a dark floor with bright pools of light, the right ones brighter: **light2** (150,430) ≈ 158,107,65,
**light3** (630,430) ≈ 255,181,110 (saturated), **between** (450,430) ≈ 99,67,41, **edge-left** (30,470) ≈ 69,47,29,
**edge-right** (770,470) ≈ 94,64,39, **near** (450,560) ≈ 36,24,15, (350,560) ≈ 38,26,16.

## gamma-shader
- **Task:** Gamma-correct the output: at the end of `PSMain` raise the colour to the power 1.0 / 2.2 before returning it.
- **Hint:** `float gamma = 2.2f; color = pow(color, float3(1.0f / gamma, 1.0f / gamma, 1.0f / gamma));` before `return float4(color, 1.0f);`. The monitor darkens what it gets (≈ power 2.2); storing the colour to the power 1/2.2 cancels that, so the lighting maths, done in linear space, reaches the eye linearly.
- **When done:** `gamma_correction.hlsl` `PSMain`: `float gamma = 2.2f;` and `color = pow(color, float3(1.0f / gamma,
  1.0f / gamma, 1.0f / gamma));` right before the `return`. The whole floor becomes **much brighter and washed out**
  (greyish), because the wood's colours were already gamma-encoded and now get encoded twice: **light2** (150,430) ≈
  205,172,137, **light3** (630,430) ≈ 255,218,174, **between** (450,430) ≈ 166,139,111, **edge-left** (30,470) ≈
  141,118,94, **edge-right** (770,470) ≈ 162,136,109, **near** (450,560) ≈ 104,88,70; background still 26,26,26 (the clear
  colour does not go through the shader).

## srgb-texture
- **Task:** Create the wood texture as an sRGB texture, so that sampling it returns linear colours: in `LoadTexture` use the format `DXGI_FORMAT_R8G8B8A8_UNORM_SRGB`.
- **Hint:** One line: `textureDesc.Format = DXGI_FORMAT_R8G8B8A8_UNORM_SRGB;`. The pixels uploaded by `UpdateSubresources` are the same bytes; the format tells the GPU to decode them (sRGB → linear) when the shader samples. The SRV takes the texture's format (`srvDesc.Format = textureDesc.Format;`), so it is an sRGB view too. Only colour images are sRGB – specular, normal or height maps stay `UNORM`.
- **When done:** `main.cpp` `LoadTexture`: `textureDesc.Format = DXGI_FORMAT_R8G8B8A8_UNORM_SRGB;` (with a comment; the
  SRV's `srvDesc.Format = textureDesc.Format;` follows). The wood gets its **warm, saturated colours back** (decoded to
  linear, lit, encoded once): **light2** (150,430) ≈ 158,108,68, **light3** (630,430) ≈ 221,151,94, **between**
  (450,430) ≈ 128,88,55, **edge-left** (30,470) ≈ 118,81,50, **edge-right** (770,470) ≈ 133,91,57, **near** (450,560) ≈
  81,55,35, (350,560) ≈ 87,60,37. Compared with the start the dark parts are brighter and the pools less saturated: the
  light looks too wide and flat – the attenuation is still the linear 1/d.

## quadratic
- **Task:** Use the physically correct attenuation `1.0f / (lightDistance * lightDistance)` now that the lighting happens in linear space.
- **Hint:** In `BlinnPhong()`: `float attenuation = 1.0f / (lightDistance * lightDistance);`. Without gamma correction the quadratic falloff looked far too strong (the monitor's power 2.2 made it ≈ 1/d⁴·⁴), so linear attenuation was used to compensate; with correct gamma 1/d² looks right.
- **When done:** `gamma_correction.hlsl`: `float attenuation = 1.0f / (lightDistance * lightDistance);`. The light **falls
  off faster**: brighter right below the lights, darker between and in front of them: **light2** (150,430) ≈ 196,134,84,
  **light3** (630,430) ≈ 255,187,116, **between** (450,430) ≈ 120,83,52, **edge-left** (30,470) ≈ 106,72,45,
  **edge-right** (770,470) ≈ 121,83,52, **near** (450,560) ≈ 57,39,24, (350,560) ≈ 61,42,26 – learnopengl's
  gamma-corrected picture. This is the solution.
