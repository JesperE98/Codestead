# Gamma Correction

As soon as we compute the final pixel colors of the scene we will have to display them on a monitor. In the old days of
digital imaging most monitors were cathode-ray tube (CRT) monitors. These monitors had the physical property that twice
the input voltage did not result in twice the amount of brightness. Doubling the input voltage resulted in a brightness
equal to an exponential relationship of roughly 2.2 known as the *gamma* of a monitor. This happens to (coincidentally)
also closely match how human beings measure brightness, as brightness is also perceived with a similar (inverse) power
relationship.

Picture two rows of grey tones from black to white. In the first, each step adds the same amount to the value we send
to the monitor: 0.0, 0.1, 0.2 … 1.0. To the human eye this row looks like an even scale: our eyes are more sensitive to
changes in dark tones than in bright ones, and the monitor's curve happens to compensate for that. In the second row,
each step adds the same amount of *physical* light – twice the value means twice the photons. That row looks wrong to
us: it seems to jump through the dark tones and to crawl through the bright ones. Still, it is the second row that is
physically correct. Because colours have always been chosen by looking at what the monitor shows, the values we work
with are in a non-linear space: if you double the value of a colour, you do not get twice the light.

The problem is that all our lighting calculations are done in linear space: doubling a light's intensity, adding the
contributions of two lights, or scaling a colour by `diff` all assume that the result is shown as it was computed. On
the monitor, however, a value of 0.5 – half as bright, as far as our maths is concerned – comes out as 0.5 to the power
2.2 ≈ 0.218 of the full brightness. Dark and medium colours come out too dark, and the more a colour depends on
lighting maths, the more wrong it looks. All the lighting of the earlier chapters was therefore physically incorrect –
and we tuned values like the attenuation constants by eye to make it look acceptable anyway.

```quiz
The fragment shader writes the value 0.5 for a pixel and the monitor has a gamma of 2.2. How bright does the pixel appear, relative to white?
- [ ] 0.5 – the monitor shows what it gets
- [ ] 0.73
- [x] About 0.218: the monitor raises the value to the power 2.2
- [ ] 0.25 – the monitor squares the value
---
0.5 to the power 2.2 ≈ 0.218. To appear at half brightness, a pixel would need the value 0.5^(1/2.2) ≈ 0.73 – that's exactly what gamma correction computes.
```

## Gamma correction

The idea of gamma correction is to apply the inverse of the monitor's gamma to the final output colour before
displaying it on the monitor. Looking back at the gamma curve, we see that the monitor darkens our colours with a
power of 2.2; if we brighten them first with the inverse power, 1/2.2, the two cancel out and the light reaches our eye
as linear as we computed it.

Let's give another example. Say we again have the dark-red colour (0.5, 0.0, 0.0). Before displaying this colour on
the monitor we first apply the gamma correction curve to the colour value. Linear colours displayed by a monitor are
roughly scaled to a power of 2.2 so the inverse requires scaling the colours by a power of 1/2.2. The gamma-corrected
dark-red colour thus becomes (0.5, 0.0, 0.0)^(1/2.2) = (0.73, 0.0, 0.0). The corrected colours are then fed to the
monitor and as a result the colour is displayed as (0.73)^2.2 = (0.5, 0.0, 0.0). You can see that by using gamma
correction, the monitor now finally displays the colours as we linearly set them in the application.

A gamma value of 2.2 is a default gamma value that roughly estimates the average gamma of most displays. The colour
space as a result of this gamma of 2.2 is called the **sRGB** colour space (not 100% exact, but close). Each monitor
has its own gamma curve, but a gamma value of 2.2 gives good results on most monitors. For this reason, games often
allow players to change the game's gamma setting as it varies slightly per monitor.

:::opengl
The project is learnopengl's scene: the wooden floor of the last chapter (20 × 20 units at y = -0.5, `wood.png`
repeated ten times) lit by four point lights at (-3, 0, 0), (-1, 0, 0), (1, 0, 0) and (3, 0, 0), whose colours go from
dim grey to white: 0.25, 0.50, 0.75 and 1.00. `gamma_correction.fs` computes the light of each one in a function
`BlinnPhong()` – diffuse and Blinn-Phong specular (exponent 64), times the light's colour, weakened with the distance;
no ambient – and multiplies the floor's colour with their sum. The camera is at (0, 0, 3) as before.
:::
:::vulkan
The project is learnopengl's scene: the wooden floor of the last chapter (20 × 20 units at y = -0.5,
`textures/wood.png` repeated ten times) lit by four point lights at (-3, 0, 0), (-1, 0, 0), (1, 0, 0) and (3, 0, 0),
whose colours go from dim grey to white: 0.25, 0.50, 0.75 and 1.00. `shaders/gamma_correction.frag` computes the light of
each one in a function `BlinnPhong()` – diffuse and Blinn-Phong specular (exponent 64), times the light's colour,
weakened with the distance; no ambient – and multiplies the floor's colour with their sum. The camera is at (0, 0, 3) as
before.
:::
:::d3d12
The project is learnopengl's scene: the wooden floor of the last chapter (20 × 20 units at y = -0.5, `wood.png`
repeated ten times) lit by four point lights at (-3, 0, 0), (-1, 0, 0), (1, 0, 0) and (3, 0, 0), whose colours go from
dim grey to white: 0.25, 0.50, 0.75 and 1.00. `gamma_correction.hlsl` computes the light of each one in a function
`BlinnPhong()` – diffuse and Blinn-Phong specular (exponent 64), times the light's colour, weakened with the distance;
no ambient – and `PSMain` multiplies the floor's colour with their sum. (The distance is called `lightDistance`:
`distance` is an HLSL intrinsic function.) The camera is at (0, 0, 3) as before.
:::

learnopengl switches everything this chapter changes with one `gamma` flag (the space bar). Here each step is its own
task, so you can see what each one does. Right now there is no gamma correction at all. Press **Build & run** (Ctrl+Enter):
a dark floor with four pools of light, the right ones brighter and strongly saturated – right below the third light the
red channel is already at its maximum. The `// TODO:` comments in the project mark where your code goes.

### Four lights in {{api}}

:::opengl
The lights' positions and colours are two arrays of `vec3` uniforms:

```glsl
uniform vec3 lightPositions[4];
uniform vec3 lightColors[4];
```

The program sets all four elements of each with one call:

```cpp
        glUniform3fv(glGetUniformLocation(shader.ID, "lightPositions"), 4, &lightPositions[0][0]);
        glUniform3fv(glGetUniformLocation(shader.ID, "lightColors"), 4, &lightColors[0][0]);
```

The location of an array's first element, a count of 4, and a pointer to 4 × 3 consecutive floats: `glm::vec3` holds
exactly three floats, so the C++ array `glm::vec3 lightPositions[4]` is that. Uniforms outside a block have no memory
layout you need to match – OpenGL copies the values into wherever the driver keeps them.
:::
:::vulkan
In Vulkan, the lights live in the uniform buffer, and there the layout counts. learnopengl's `uniform vec3
lightPositions[4]` can't be copied as a C++ `glm::vec3[4]`: in a std140 block every element of an array starts at a
multiple of 16 bytes, so a `vec3` array has a stride of 16 bytes, while `glm::vec3` is 12 bytes. Both sides therefore
use `vec4` (w unused, the shader reads `.xyz`):

```glsl
// std140: the elements of an array are 16 bytes apart, so the positions and colours are vec4s (only xyz is used)
layout(binding = 0) uniform UniformBufferObject {
    mat4 view;
    mat4 proj;
    vec4 lightPositions[4];
    vec4 lightColors[4];
    vec3 viewPos;
} ubo;
```

```cpp
struct UniformBufferObject {
    glm::mat4 view;
    glm::mat4 proj;
    glm::vec4 lightPositions[4];
    glm::vec4 lightColors[4];
    glm::vec3 viewPos;
    float pad1;
};
```

`updateUniformBuffer()` fills them one by one, from `ubo.lightPositions[0] = glm::vec4(-3.0f, 0.0f, 0.0f, 0.0f);` to
`ubo.lightColors[3] = glm::vec4(1.00f, 1.00f, 1.00f, 0.0f);`, and the shader calls
`BlinnPhong(…, ubo.lightPositions[i].xyz, ubo.lightColors[i].xyz)`.
:::
:::d3d12
In Direct3D 12, the lights live in the constant buffer, and there the layout counts. HLSL starts every element of a
cbuffer array on a new 16-byte row, so an array of `float3` would leave 4 bytes of padding after each element. The
course uses `float4` (w unused) on both sides, so that the C++ struct and the HLSL layout are obviously the same:

```hlsl
cbuffer SceneConstantBuffer : register(b0)
{
    float4x4 view;
    float4x4 projection;
    float4 lightPositions[4];
    float4 lightColors[4];
    float3 viewPos;
};
```

```cpp
    struct SceneConstantBuffer
    {
        XMFLOAT4X4 view;
        XMFLOAT4X4 projection;
        XMFLOAT4 lightPositions[4];
        XMFLOAT4 lightColors[4];
        XMFLOAT3 viewPos;
        float padding0;
    };
```

The globals `XMFLOAT4 lightPositions[]` and `lightColors[]` are copied into it in `OnUpdate` with a `for` loop, and the
shader calls `BlinnPhong(…, lightPositions[i].xyz, lightColors[i].rgb)`.
:::

:::opengl
```quiz
What does `glUniform3fv(glGetUniformLocation(shader.ID, "lightPositions"), 4, &lightPositions[0][0])` do?
- [x] It sets all four elements of the uniform array `lightPositions[4]` from 12 consecutive floats – the C++ array of four `glm::vec3`
- [ ] It sets the uniform `lightPositions` to the fourth element of the C++ array
- [ ] It sets the first element four times
- [ ] It sets one `vec3` and pads it to 4 floats
---
The `v` functions take a count: for an array uniform, the location of element 0 and a count of 4 set elements 0 to 3. `glm::vec3` holds exactly three floats, so `&lightPositions[0][0]` points at 12 consecutive floats.
```
:::
:::vulkan
```quiz
Why do the uniform block and the C++ struct use `vec4 lightPositions[4]` instead of learnopengl's `vec3` array?
- [ ] GLSL has no arrays of `vec3`
- [ ] The w component holds the light's intensity
- [ ] Vulkan uniform buffers can only hold `vec4` and `mat4`
- [x] In std140 every array element starts at a multiple of 16 bytes; a C++ `glm::vec3[4]` is packed in 12-byte steps, so it wouldn't match – with `vec4` both sides use 16
---
A `vec3` array in a std140 block has a stride of 16 bytes. Writing `glm::vec3` elements would put the second light at byte 12 instead of 16. `vec4`s make the layouts identical; the shader only reads `.xyz`.
```
:::
:::d3d12
```quiz
Why are the lights `XMFLOAT4` / `float4` arrays in the constant buffer, not `float3` like learnopengl's `vec3`?
- [ ] HLSL has no arrays of `float3`
- [ ] The w component holds the light's intensity
- [x] Every element of a cbuffer array starts on a new 16-byte row; with `float4` the C++ struct and the HLSL layout are obviously the same
- [ ] Constant buffers must be a multiple of 256 bytes
---
A `float3` array element would be followed by 4 bytes of padding in HLSL but not in a C++ `XMFLOAT3` array. The 256-byte rule is about the size of the whole constant buffer view, not its members.
```
:::

There are two ways to apply gamma correction to your scene: by letting {{api}} do it in hardware when the colour is
written, or by doing it yourself in the fragment shader.

:::opengl
The first way is probably the easiest, but also gives you less control. By enabling `GL_FRAMEBUFFER_SRGB` you tell
OpenGL that each subsequent drawing command should first gamma correct colours (from linear to the sRGB colour space)
before storing them in colour buffer(s). The sRGB colour space roughly corresponds to a gamma of 2.2 and is a standard
for most devices. After enabling `GL_FRAMEBUFFER_SRGB`, OpenGL automatically performs gamma correction after each
fragment shader run to all subsequent framebuffers, including the default framebuffer:

```cpp
glEnable(GL_FRAMEBUFFER_SRGB);
```

From now on your rendered images will be gamma corrected and as this is done by the hardware it is completely free.
Something you should keep in mind with this approach (and the other approach) is that gamma correction (also)
transforms the colours from linear space to non-linear space, so it is very important you only do gamma correction at
the last and final step. If you gamma-correct your colours before the final output, all subsequent operations on those
colours will operate on incorrect values. For instance, if you use multiple framebuffers you probably want
intermediate results passed in between framebuffers to remain in linear space and only have the last framebuffer apply
gamma correction before being sent to the monitor.
:::
:::vulkan
The first way is probably the easiest, but also gives you less control. In Vulkan the hardware encodes when an
attachment has an `_SRGB` format: every colour written to it is converted from linear to sRGB (roughly the power 1/2.2).
vulkan-tutorial's `chooseSwapSurfaceFormat()` picks `VK_FORMAT_B8G8R8A8_SRGB` with
`VK_COLOR_SPACE_SRGB_NONLINEAR_KHR` – so in vulkan-tutorial every picture is gamma corrected for free, without the
author saying much about it. The course's projects choose `VK_FORMAT_B8G8R8A8_UNORM` instead:

```cpp
    VkSurfaceFormatKHR chooseSwapSurfaceFormat(const std::vector<VkSurfaceFormatKHR>& availableFormats) {
        // A UNORM format shows the colours we write unchanged (like OpenGL's default framebuffer): the fragment shader
        // does the gamma correction itself. (An _SRGB format, like vulkan-tutorial's VK_FORMAT_B8G8R8A8_SRGB, would
        // encode every colour written to it with the sRGB curve - the hardware's gamma correction.)
        for (const auto& availableFormat : availableFormats) {
            if (availableFormat.format == VK_FORMAT_B8G8R8A8_UNORM && availableFormat.colorSpace == VK_COLOR_SPACE_SRGB_NONLINEAR_KHR) {
                return availableFormat;
            }
        }

        return availableFormats[0];
    }
```

With UNORM, the colours we write reach the window unchanged, like in OpenGL's default framebuffer – that's why the
colours of all the earlier chapters matter here: they match OpenGL's, pixel for pixel. And it's why this chapter does
the correction in the shader, learnopengl's way. Whichever way you choose, keep in mind that gamma correction
transforms the colours from linear space to non-linear space, so it must happen exactly once, at the last and final
step. If you use several passes (offscreen images for post-processing, say), the intermediate results should remain in
linear space, and only the last pass should encode.
:::
:::d3d12
The first way is probably the easiest, but also gives you less control. In Direct3D the hardware encodes when the render
target view has an `_SRGB` format: every colour written through it is converted from linear to sRGB (roughly the power
1/2.2). The flip-model swap chain (`DXGI_SWAP_EFFECT_FLIP_DISCARD`) can't be created with an `_SRGB` format, but its
`DXGI_FORMAT_R8G8B8A8_UNORM` buffers may get an sRGB view: a `D3D12_RENDER_TARGET_VIEW_DESC` with
`Format = DXGI_FORMAT_R8G8B8A8_UNORM_SRGB` and `ViewDimension = D3D12_RTV_DIMENSION_TEXTURE2D`, passed to
`CreateRenderTargetView` instead of `nullptr`. The pipeline state's `RTVFormats[0]` must then be the `_SRGB` format too.

The course's projects use the plain UNORM view everywhere, so the colours we write reach the window unchanged, like in
OpenGL's default framebuffer – and this chapter does the correction in the shader, learnopengl's way. Whichever way you
choose, keep in mind that gamma correction transforms the colours from linear space to non-linear space, so it must
happen exactly once, at the last and final step. If you use several passes (render targets for post-processing, say),
the intermediate results should remain in linear space, and only the last pass should encode.
:::

The second approach requires a bit more work, but also gives us complete control over the gamma operations. We apply
gamma correction at the end of each relevant fragment shader run, so the final colours end up gamma corrected before
being sent out to the monitor.

:::opengl
```quiz
You enable `GL_FRAMEBUFFER_SRGB` and keep the shader's `pow(color, vec3(1.0/2.2))`. What happens?
- [ ] Nothing: OpenGL notices the shader's correction and skips its own
- [ ] The two cancel out, and the picture shows linear colours
- [x] The colours are gamma corrected twice and look too bright and washed out – use one of the two, not both
- [ ] The program fails to link
---
`GL_FRAMEBUFFER_SRGB` encodes every colour written to an sRGB-capable framebuffer. A shader that already encodes would have its output encoded a second time.
```
:::
:::vulkan
```quiz
vulkan-tutorial creates its swap chain with `VK_FORMAT_B8G8R8A8_SRGB`. What would happen if the course did that and kept the shader's `pow(color, vec3(1.0 / 2.2))`?
- [ ] Nothing: the driver skips the shader's correction
- [ ] The two cancel out, and the window shows linear colours
- [ ] The swap chain can't be created with an `_SRGB` format
- [x] The colours would be gamma corrected twice – once in the shader, once by the hardware when they are written – and look washed out
---
An `_SRGB` attachment encodes every colour written to it. That's why the course uses `VK_FORMAT_B8G8R8A8_UNORM`: its colours reach the window unchanged, as in OpenGL, and the shader does the correction once.
```
:::
:::d3d12
```quiz
How could a Direct3D 12 app let the hardware do the gamma correction, given a flip-model swap chain with `DXGI_FORMAT_R8G8B8A8_UNORM` buffers?
- [ ] Create the swap chain with `DXGI_FORMAT_R8G8B8A8_UNORM_SRGB`
- [x] Create the back buffers' render target views with `DXGI_FORMAT_R8G8B8A8_UNORM_SRGB` (and the same format in the PSO's `RTVFormats[0]`), and drop the `pow` from the shader
- [ ] Set `D3D12_FILTER_SRGB` on the static sampler
- [ ] Call `ResolveSubresource` with an `_SRGB` format
---
Flip-model swap chains don't take `_SRGB` formats, but an sRGB view of their UNORM buffers is allowed: every colour written through it is encoded. The shader must not encode as well, or the picture is corrected twice.
```
:::

:::opengl
Now do the first task, **gamma-shader**. At the end of `gamma_correction.fs`, raise the colour to the power 1/2.2:

```glsl
    color *= lighting;
    // gamma correction: the monitor raises the colour to the power 2.2, so store it to the power 1.0 / 2.2
    color = pow(color, vec3(1.0/2.2));
    FragColor = vec4(color, 1.0);
```
:::
:::vulkan
Now do the first task, **gamma-shader**. At the end of `shaders/gamma_correction.frag`, raise the colour to the power
1/2.2:

```glsl
    color *= lighting;
    // gamma correction: the monitor darkens colours by the power 2.2, so brighten them by the inverse power first
    color = pow(color, vec3(1.0 / 2.2));
    outColor = vec4(color, 1.0);
```
:::
:::d3d12
Now do the first task, **gamma-shader**. At the end of `PSMain` in `gamma_correction.hlsl`, raise the colour to the
power 1/2.2:

```hlsl
    color *= lighting;
    // Gamma correction: the monitor shows a value v as about v to the power 2.2, so the
    // linear colour is raised to the power 1 / 2.2 first.
    float gamma = 2.2f;
    color = pow(color, float3(1.0f / gamma, 1.0f / gamma, 1.0f / gamma));
    return float4(color, 1.0f);
```
:::

If you have multiple fragment shaders for different objects, you have to make sure each of them does the gamma
correction; an easier approach would be to introduce a post-processing stage in your render loop and apply gamma
correction on the post-processed quad as a final step, which you only need to do once.

Press **Build & run**. The result is surprising: the whole floor becomes **much brighter and washed out** – greyish,
as if covered in fog. The background stays the same dark grey: the clear colour is not drawn by the shader, so it isn't
corrected. One line of code – but it was not the whole story.

## sRGB textures

Because monitors display colours with gamma applied, whenever you draw, edit, or paint a picture on your computer you
are picking colours based on what you see on the monitor. This effectively means all the pictures you create or edit
are not in linear space, but in sRGB space: doubling a dark-red colour on your screen based on perceived brightness
does not equal double the red component.

As a result, texture artists create all their textures in sRGB space, so if we use those textures as they are in our
rendering application we have to take this into account. Before we applied gamma correction, this was not an issue,
because the textures looked good in sRGB space and, without gamma correction, we also worked in sRGB space, so the
textures were displayed exactly as they are. That was fine. However, now that we're displaying everything in linear
space, the texture colours will be off: they are gamma corrected twice – once by the artist (the file's colours are
already encoded) and once by our shader. That's the washed-out floor.

```quiz
Why does the floor look washed out after the **gamma-shader** task?
- [ ] Because the lights are too bright for gamma correction
- [ ] Because the clear colour is now gamma corrected too
- [x] The wood texture's colours are already sRGB-encoded; the shader treats them as linear and encodes them a second time
- [ ] Because `pow` with an exponent below 1 makes every colour white
---
The image was made on a monitor, so its values are gamma-encoded. Read as if linear, lit, and encoded again, they end up corrected twice: too bright and with too little contrast and saturation.
```

To fix this issue, we have to re-correct (or de-gamma) these sRGB textures to linear space before doing any
calculations on their colour values. We could do this manually in the shader – `pow(texture(…).rgb, vec3(2.2))` – for
each texture that's in sRGB space, but that's a lot of work and easy to forget. Instead, {{api}} gives us texture
formats that do it for us: an **sRGB format** tells the GPU that the stored values are sRGB-encoded, and every time the
shader samples the texture, it gets the colour converted to linear space.

:::opengl
OpenGL has the internal formats `GL_SRGB` and `GL_SRGB_ALPHA`. Whenever we create a texture with one of them, OpenGL
automatically corrects the colours to linear space as soon as we use them. The data we upload stays the same bytes in
the format `GL_RGB` / `GL_RGBA`; only the internal format changes. learnopengl's `loadTexture` gets a parameter for it.

Now do the task **srgb-texture**. Change the prototype at the top of `main.cpp` and the definition:

```cpp
unsigned int loadTexture(const char *path, bool gammaCorrection);
```

and in `loadTexture` choose the internal format and the data format separately:

```cpp
        // an sRGB internal format: OpenGL converts the texels to linear colours when the shader samples them
        GLenum internalFormat = GL_RGB;
        GLenum dataFormat = GL_RGB;
        if (nrComponents == 1)
        {
            internalFormat = dataFormat = GL_RED;
        }
        else if (nrComponents == 3)
        {
            internalFormat = gammaCorrection ? GL_SRGB : GL_RGB;
            dataFormat = GL_RGB;
        }
        else if (nrComponents == 4)
        {
            internalFormat = gammaCorrection ? GL_SRGB_ALPHA : GL_RGBA;
            dataFormat = GL_RGBA;
        }

        glBindTexture(GL_TEXTURE_2D, textureID);
        glTexImage2D(GL_TEXTURE_2D, 0, internalFormat, width, height, 0, dataFormat, GL_UNSIGNED_BYTE, data);
```

Then load the wood as sRGB:

```cpp
    unsigned int floorTexture = loadTexture("wood.png", true); // the image's colours are sRGB (gamma-encoded)
```
:::
:::vulkan
Vulkan has `_SRGB` variants of the 8-bit formats: `VK_FORMAT_R8G8B8A8_SRGB` is `VK_FORMAT_R8G8B8A8_UNORM` whose colour
channels are decoded from sRGB to linear when sampled (alpha stays linear). The bytes we copy into the image through
the staging buffer stay the same; only the format of the image and its view changes. The project's `loadTexture` and
`createTextureImage` already take the format as a parameter – the counterpart of learnopengl's
`loadTexture(path, gammaCorrection)`:

```cpp
    // learnopengl's loadTexture: an image file -> a texture image (device local, ready for sampling) and its view.
    // The format says how the shaders read the bytes: _UNORM as they are, _SRGB decoded from sRGB to linear colours.
    void loadTexture(const char* path, VkFormat format, VkImage& image, VkDeviceMemory& imageMemory, VkImageView& imageView) {
```

The format goes into `createImage`, the layout transitions and `createImageView`. Now do the task **srgb-texture**. In
`initVulkan()`, load the wood as sRGB:

```cpp
        // SRGB: the image's colours are gamma-encoded (sRGB), the sampler decodes them to linear colours
        loadTexture("textures/wood.png", VK_FORMAT_R8G8B8A8_SRGB, floorTextureImage, floorTextureImageMemory, floorTextureImageView);
```
:::
:::d3d12
DXGI has `_SRGB` variants of the 8-bit formats: `DXGI_FORMAT_R8G8B8A8_UNORM_SRGB` is `DXGI_FORMAT_R8G8B8A8_UNORM` whose
colour channels are decoded from sRGB to linear when sampled (alpha stays linear). The bytes `UpdateSubresources` copies
into the texture stay the same; only the format changes. The shader resource view takes the texture's format
(`srvDesc.Format = textureDesc.Format;`), so it becomes an sRGB view too.

Now do the task **srgb-texture**. In `LoadTexture`, create the texture with the sRGB format:

```cpp
    // The image's colours are sRGB-encoded (gamma-corrected), like any photo or painted
    // image: an _SRGB format makes sampling decode them to linear colours.
    textureDesc.Format = DXGI_FORMAT_R8G8B8A8_UNORM_SRGB;
```
:::

Press **Build & run**: the wood gets its **warm, saturated colours back** – decoded to linear, lit in linear space,
encoded once. Compared with the start the dark parts of the floor are brighter and the pools of light less saturated.
It looks better, but the light now seems too wide and flat. We'll fix that in a moment.

You should be careful when specifying your textures in sRGB space as not all textures will actually be in sRGB space.
Textures used for colouring objects (like diffuse textures) are almost always in sRGB space. Textures used for
retrieving lighting parameters (like specular maps and normal maps) are almost always in linear space, so if you were
to configure these as sRGB textures the lighting will look odd. Be careful in which textures you specify as sRGB.

```quiz
Which of these textures should be created with an sRGB format?
- [x] The diffuse (colour) texture an artist painted or photographed
- [ ] The specular map of the lighting chapters
- [ ] A normal map that stores directions
- [ ] A shadow map that stores depths
---
Only images of colours, made by looking at a monitor, are sRGB-encoded. Specular, normal, height and depth maps store data for the maths; decoding them would change their values and break the lighting.
```

## Attenuation

Something else that's different with gamma correction is lighting attenuation. In the real physical world, lighting
attenuates closely inversely proportional to the squared distance from a light source. In normal English it simply
means that the light strength is reduced over the distance to the light source squared, like below:

:::opengl
```glsl
float attenuation = 1.0 / (distance * distance);
```
:::
:::vulkan
```glsl
float attenuation = 1.0 / (distance * distance);
```
:::
:::d3d12
```hlsl
float attenuation = 1.0f / (lightDistance * lightDistance);
```
:::

However, when using this equation the attenuation effect is usually way too strong, giving lights a small radius that
doesn't look physically right. For that reason other attenuation functions were used (like we discussed in the *Light
casters* chapter) that give much more control, or the linear equivalent is used:

:::opengl
```glsl
float attenuation = 1.0 / distance;
```
:::
:::vulkan
```glsl
float attenuation = 1.0 / distance;
```
:::
:::d3d12
```hlsl
float attenuation = 1.0f / lightDistance;    // linear
```
:::

The linear equivalent gives more plausible results compared to its quadratic variant without gamma correction, but
when we enable gamma correction the linear attenuation looks too weak and the physically correct quadratic attenuation
suddenly gives the better results – that's the too wide, flat light of the last task.

The cause of this difference is that light attenuation functions change brightness, and as we weren't visualizing our
final output in linear space, we chose the attenuation functions that looked best on our monitor, but weren't
physically correct. Think of the squared attenuation function: if we were to use this function without gamma
correction, the attenuation function effectively becomes (1.0 / distance²)^2.2 when displayed on a monitor. This
creates a much larger attenuation from what we originally anticipated. This also explains why the linear equivalent
makes much more sense without gamma correction, as this effectively becomes (1.0 / distance)^2.2 = 1.0 / distance^2.2
which resembles its physical equivalent a lot more.

```quiz
Why did linear attenuation `1 / d` look right before gamma correction, and why is `1 / d²` right now?
- [ ] Because `1 / d²` can't be computed in a shader without gamma correction
- [ ] Because sRGB textures are darker, so the light needs to reach further
- [x] Without correction the monitor raises everything to the power 2.2, so `1 / d` was seen as about `1 / d^2.2` – close to physical – while `1 / d²` became `1 / d^4.4`; with correction the monitor shows what we compute, so the physical `1 / d²` is right
- [ ] Because the quadratic term only matters for more than four lights
---
Attenuation changes brightness, and the monitor's curve bends brightness. Once the output is gamma corrected, what we compute is what reaches the eye, and the physically correct inverse square law looks right.
```

:::opengl
Now do the last task, **quadratic**. In `BlinnPhong()` of `gamma_correction.fs`:

```glsl
    float attenuation = 1.0 / (distance * distance); // physically correct, now that the lighting is done in linear space
```
:::
:::vulkan
Now do the last task, **quadratic**. In `BlinnPhong()` of `shaders/gamma_correction.frag`:

```glsl
    float attenuation = 1.0 / (distance * distance); // physically right, now that the lighting happens in linear space
```
:::
:::d3d12
Now do the last task, **quadratic**. In `BlinnPhong()` of `gamma_correction.hlsl`:

```hlsl
    float attenuation = 1.0f / (lightDistance * lightDistance);    // quadratic: physically right, in linear space
```
:::

Press **Build & run**: the light **falls off faster** – brighter right below the lights, darker between and in front of
them. This is learnopengl's gamma-corrected picture. Compare it with the start: there the right light's pool was a
saturated orange blot and the four lights' greys (0.25 to 1.00) looked more different than they are; now the
brightness follows the light colours and the distance the way physics says it should.

In general, gamma correction allows us to work and visualize our renders in linear space. Because linear space makes
sense in the physical world, most physical equations now actually give good results (like real light attenuation). The
more advanced your lighting becomes, the easier it is to get good looking (and realistic) results with gamma
correction. That is also why it's advised to only really tweak your lighting parameters as soon as you have gamma
correction in place: tuning them without it, as we did in the earlier chapters, bakes the monitor's curve into the
values.

## Additional resources

:::opengl
- [Gamma Correction](https://learnopengl.com/Advanced-Lighting/Gamma-Correction): learnopengl's chapter this chapter
  follows, with the pictures of the two grey scales and of the attenuation.
- [gamma_correction.cpp](https://github.com/JoeyDeVries/LearnOpenGL/blob/master/src/5.advanced_lighting/2.gamma_correction/gamma_correction.cpp):
  learnopengl's program, with the `gamma` flag on the space bar.
- [glTexImage2D](https://registry.khronos.org/OpenGL-Refpages/gl4/html/glTexImage2D.xhtml): the reference page,
  including the `GL_SRGB` internal formats.
:::
:::vulkan
- [Gamma Correction](https://learnopengl.com/Advanced-Lighting/Gamma-Correction): learnopengl's chapter this chapter
  follows, with the pictures of the two grey scales and of the attenuation.
- [Swap chain](https://vulkan-tutorial.com/Drawing_a_triangle/Presentation/Swap_chain): vulkan-tutorial's
  `chooseSwapSurfaceFormat()` with its `VK_FORMAT_B8G8R8A8_SRGB` choice.
- [Formats](https://docs.vulkan.org/spec/latest/chapters/formats.html): the Vulkan specification's chapter on formats,
  including what the `_SRGB` formats do.
:::
:::d3d12
- [Gamma Correction](https://learnopengl.com/Advanced-Lighting/Gamma-Correction): learnopengl's chapter this chapter
  follows, with the pictures of the two grey scales and of the attenuation.
- [Converting data for the color space](https://learn.microsoft.com/en-us/windows/win32/direct3ddxgi/converting-data-color-space):
  how `_SRGB` formats and sRGB render target views on UNORM back buffers convert colours.
- [Packing rules for constant variables](https://learn.microsoft.com/en-us/windows/win32/direct3dhlsl/dx-graphics-hlsl-packing-rules):
  why the lights' arrays are `float4`s.
:::
