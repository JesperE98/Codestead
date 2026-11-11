# Cascaded Shadow Mapping

In the *Shadow Mapping* chapter a single depth map, rendered from the light, gave a small scene its shadows. The light's
orthographic projection was a box of 20 × 20 units around the scene, and the 1024 × 1024 shadow map spread its texels
over that box. That works as long as the scene is small. Take a landscape seen from a person's eyes instead: the view
reaches hundreds of units into the distance, and the shadow map would have to cover all of it. Spread 1024 texels over
500 units and each texel covers half a unit of ground – right in front of the camera, where half a unit fills a large
part of the screen, the shadows turn into coarse, jagged blocks.

The problem has a name: *perspective aliasing*. A perspective camera shows nearby things large and distant things
small, but a shadow map spreads its texels evenly. Near the camera there are too few texels per pixel, far away far too
many. *Cascaded shadow mapping* (CSM) answers with several shadow maps: split the camera's view frustum along its depth
into a few slices – *cascades* – and give each slice a shadow map of its own that covers only that slice, tightly. The
near slices are short, so their shadow maps are sharp; the far slices are long, but far away a texel covers fewer
pixels, so the coarser maps are good enough there.

This chapter follows learnopengl's guest article *Cascaded Shadow Mapping*. It builds on the *Shadow Mapping* chapter –
the depth map, the light-space transform, the bias and PCF – and on the *Point Shadows* chapter, whose geometry shader
rendered all faces of a cube map in one pass; here the same trick renders all cascades in one pass. Like those
chapters it works the same way in every API, and it shows where {{api}} puts each piece.

## The project

The scene is learnopengl's: a wooden floor 50 × 50 units at y = -2 and ten wooden cubes floating above it, lit by a
directional light like the sun, `lightDir = normalize(20, 50, 20)` (the direction towards the light). learnopengl
places its cubes with a random generator, so its scene changes every run; the course lists ten fixed placements –
position, rotation about the axis (1, 0, 1) and scale – so the pictures can be compared. The camera stands at (0, 3, 17),
looking down 15° along -z, with learnopengl's near and far planes of **0.1 and 500**: the view reaches far beyond the
floor's far edge 25 units away. The lighting is the *Shadow Mapping* chapter's Blinn-Phong with an ambient of `0.3 *
lightColor` (learnopengl's CSM shader multiplies the ambient by the wood colour twice – the course keeps the earlier
chapter's version).

:::opengl
The program asks for an OpenGL **4.1** core context, learnopengl's choice for this demo, and all shaders start with
`#version 410 core`. The depth pass's geometry shader runs once per cascade with `layout (triangles, invocations = 5)
in;` – *geometry shader instancing*, core since OpenGL 4.0. 4.1 is also the highest version macOS offers, so this
chapter runs there too. `shader_m.h` is the course's `Shader` class with the optional geometry shader, as in *Point
Shadows*.
:::
:::vulkan
The project is built on the Vulkan *Shadow Mapping* project: its depth-only render pass (`depthMapRenderPass`), the
`createPipeline` helper – here with an optional geometry shader file, as in *Point Shadows* –, `renderScene()` and the
debug quad that shows the shadow map. The scene's per-frame data lives in a uniform buffer at binding 0, the wood texture
at binding 1.
:::
:::d3d12
The project is built on the Direct3D 12 *Shadow Mapping* project: `RenderScene()` draws the floor and the cubes and is
called by both passes, `m_depthPipelineState` renders depth only (no pixel shader, no render target), and
`m_debugQuadPipelineState` shows the shadow map on a screen quad. The scene's per-frame data lives in a constant buffer;
the cubes' placements are learnopengl's translate · rotate · scale in DirectXMath's row-vector order,
`XMMatrixScaling(…) * XMMatrixRotationAxis(…) * XMMatrixTranslation(…)`.
:::

The `// TODO:` comments in the project mark where your code goes. Press **Build & run** (Ctrl+Enter) to compile it and
run it in the built-in simulator: the lit floor and cubes – without any shadows yet.

## Splitting the frustum

The first decision is where to split the view. learnopengl uses four split distances, fractions of the far plane:

```text
shadowCascadeLevels = { far / 50, far / 25, far / 10, far / 2 }  =  { 10, 20, 50, 250 }   (far = 500)
```

Four splits make **five cascades**: 0.1 – 10, 10 – 20, 20 – 50, 50 – 250 and 250 – 500 units from the camera. Each one
is longer than the one before, roughly in proportion to its distance – which is what perspective aliasing asks for, since
the size of a pixel's footprint grows with the distance. Real engines often pick the splits with a formula between an
even (linear) and a logarithmic spacing; learnopengl's fixed fractions are simple to read and work for this scene.

```quiz
With learnopengl's split distances 10, 20, 50 and 250, which cascade does a fragment 30 units in front of the camera belong to?
- [ ] Cascade 1 (10–20)
- [x] Cascade 2 (20–50)
- [ ] Cascade 3 (50–250)
- [ ] Cascade 0: the first cascade covers everything up to the first split beyond the fragment
---
The cascades are numbered from 0: 0.1–10, 10–20, 20–50, 50–250, 250–500. The fragment shader picks the first cascade whose far distance is beyond the fragment's depth – here 50.
```

### The corners of a cascade

For each cascade we need a light-space matrix – a light view and an orthographic projection – whose box encloses that
slice of the camera's frustum and nothing more. The slice is itself a frustum: the camera's projection with the
cascade's near and far distance. Its eight corners are easiest to find from the other end. In normalized device
coordinates every frustum is a box with corners at x, y = ±1 and z at the near and far end. Transform those eight
corners by the *inverse* of projection · view, divide by w, and you get the frustum's corners in world space.

:::opengl
In OpenGL the box's z runs from -1 to 1, so the corners are `(2x − 1, 2y − 1, 2z − 1)` for x, y, z ∈ {0, 1}:

```cpp
std::vector<glm::vec4> getFrustumCornersWorldSpace(const glm::mat4& projview)
{
    const glm::mat4 inv = glm::inverse(projview);

    std::vector<glm::vec4> frustumCorners;
    for (unsigned int x = 0; x < 2; ++x)
    {
        for (unsigned int y = 0; y < 2; ++y)
        {
            for (unsigned int z = 0; z < 2; ++z)
            {
                const glm::vec4 pt = inv * glm::vec4(2.0f * x - 1.0f, 2.0f * y - 1.0f, 2.0f * z - 1.0f, 1.0f);
                frustumCorners.push_back(pt / pt.w);
            }
        }
    }

    return frustumCorners;
}
```

with an overload `getFrustumCornersWorldSpace(proj, view)` that passes `proj * view`.

```quiz
Why does `getFrustumCornersWorldSpace` transform the points (±1, ±1, ±1) with the inverse of projection · view?
- [ ] Because the inverse matrix turns a perspective frustum into a box
- [ ] Because the shadow map needs normalized device coordinates
- [x] Because every view frustum is the box from -1 to 1 in OpenGL's normalized device coordinates; going back through the inverse (and dividing by w) gives the frustum's corners in world space
- [ ] Because the light's orthographic projection expects its input in clip space
---
Projection · view takes world space to clip space; after the divide by w, the frustum fills the cube [-1, 1]³. The inverse takes the cube's corners back to world space – with the w divide, since the projection is perspective.
```
:::
:::vulkan
Here Vulkan differs from learnopengl's code. With `GLM_FORCE_DEPTH_ZERO_TO_ONE` the projection maps depth to **0..1**,
so the normalized device coordinates box has z from 0 to 1, not from -1 to 1. The corners are therefore `(2x − 1, 2y −
1, z)`:

```cpp
// the 8 corners of a frustum in world space: the corners of Vulkan's normalized device coordinates box (x and y from
// -1 to 1, z from 0 to 1 - GLM_FORCE_DEPTH_ZERO_TO_ONE; learnopengl's OpenGL box has z from -1 to 1) through the
// inverse of projection * view
std::vector<glm::vec4> getFrustumCornersWorldSpace(const glm::mat4& projview) {
    const glm::mat4 inv = glm::inverse(projview);

    std::vector<glm::vec4> frustumCorners;
    for (unsigned int x = 0; x < 2; ++x) {
        for (unsigned int y = 0; y < 2; ++y) {
            for (unsigned int z = 0; z < 2; ++z) {
                const glm::vec4 pt = inv * glm::vec4(2.0f * x - 1.0f, 2.0f * y - 1.0f, (float)z, 1.0f);
                frustumCorners.push_back(pt / pt.w);
            }
        }
    }

    return frustumCorners;
}
```

With learnopengl's `2.0f * z - 1.0f`, z = -1 would lie *in front of* Vulkan's near plane: the near corners would land
too close to the camera (cascade 1 would start at 6.7 instead of 10), and every cascade's box would grow. The projection used here is a fresh `glm::perspective` for the cascade; it isn't flipped in y, but the
flip wouldn't matter – the eight corners are the same set either way.

```quiz
Why does the Vulkan project use `(float)z` instead of learnopengl's `2.0f * z - 1.0f` for the corners' depth?
- [x] Because with `GLM_FORCE_DEPTH_ZERO_TO_ONE` the near and far planes are at depth 0 and 1 in normalized device coordinates, not -1 and 1
- [ ] Because Vulkan's y axis points down
- [ ] Because Vulkan's shadow maps store depth as integers
- [ ] Because the corners have to be in light space, not world space
---
z = -1 is a point in front of the near plane in a 0..1 projection, so learnopengl's formula would make every cascade start too close to the camera and its light box too big.
```
:::
:::d3d12
Here Direct3D differs from learnopengl's code. `XMMatrixPerspectiveFovRH` maps depth to **0..1**, so the normalized
device coordinates box has z from 0 to 1, not from -1 to 1. The corners are therefore `(2x − 1, 2y − 1, z)`, transformed
by the inverse of view · projection (row vectors: the view first):

```cpp
std::vector<XMFLOAT4> getFrustumCornersWorldSpace(const XMMATRIX& projview)
{
    const XMMATRIX inv = XMMatrixInverse(nullptr, projview);

    std::vector<XMFLOAT4> frustumCorners;
    for (unsigned int x = 0; x < 2; ++x)
    {
        for (unsigned int y = 0; y < 2; ++y)
        {
            for (unsigned int z = 0; z < 2; ++z)
            {
                const XMVECTOR pt = XMVector4Transform(XMVectorSet(2.0f * x - 1.0f, 2.0f * y - 1.0f, static_cast<float>(z), 1.0f), inv);
                XMFLOAT4 corner;
                XMStoreFloat4(&corner, pt / XMVectorSplatW(pt));
                frustumCorners.push_back(corner);
            }
        }
    }

    return frustumCorners;
}
```

With learnopengl's `2.0f * z - 1.0f`, z = -1 would lie *in front of* Direct3D's near plane, and every cascade's box
would grow. In containers DirectXMath values are kept as storage types (`std::vector<XMFLOAT4>`): an `XMVECTOR` in a
`std::vector` isn't portable.

```quiz
Why does the Direct3D project use `static_cast<float>(z)` instead of learnopengl's `2.0f * z - 1.0f` for the corners' depth?
- [ ] Because Direct3D's y axis points down in texture space
- [ ] Because DirectXMath uses row vectors
- [ ] Because the corners have to be in light space, not world space
- [x] Because `XMMatrixPerspectiveFovRH` puts the near and far planes at depth 0 and 1 in normalized device coordinates, not -1 and 1
---
z = -1 is a point in front of the near plane in a 0..1 projection, so learnopengl's formula would make every cascade start too close to the camera and its light box too big.
```
:::

### A tight light box

Now the light. A directional light has no position, only a direction, so we may place its view wherever it suits us:
learnopengl puts it at the centre of the eight corners, looking at the centre along `-lightDir`:

```cpp
    const glm::mat4 lightView = glm::lookAt(center + lightDir, center, glm::vec3(0.0f, 1.0f, 0.0f));
```

In this light view, the orthographic box just has to enclose the eight corners: the smallest and largest x, y and z of
the corners transformed into light space. x and y are exactly that. z needs more room. Anything *between the light and
the cascade* can cast a shadow into it – a cube floating above the camera's view, a mountain behind it – even though it
is outside the camera's frustum. If the light's box ended at the corners, those objects would be clipped away in the
depth pass and their shadows would vanish. learnopengl therefore stretches the z range by a factor, `zMult = 10`, which
it notes has to be tuned to the scene; the projection is then `glm::ortho(minX, maxX, minY, maxY, minZ, maxZ)`.

:::opengl
```cpp
// the light-space matrix of the part of the camera's frustum between nearPlane and farPlane
glm::mat4 getLightSpaceMatrix(const float nearPlane, const float farPlane)
{
    const glm::mat4 proj = glm::perspective(glm::radians(fov), (float)SCR_WIDTH / (float)SCR_HEIGHT, nearPlane, farPlane);
    const glm::mat4 view = glm::lookAt(cameraPos, cameraPos + cameraFront, cameraUp);
    const std::vector<glm::vec4> corners = getFrustumCornersWorldSpace(proj, view);

    glm::vec3 center = glm::vec3(0, 0, 0);
    for (const glm::vec4& v : corners)
    {
        center += glm::vec3(v);
    }
    center /= corners.size();

    const glm::mat4 lightView = glm::lookAt(center + lightDir, center, glm::vec3(0.0f, 1.0f, 0.0f));

    float minX = std::numeric_limits<float>::max();
    float maxX = std::numeric_limits<float>::lowest();
    float minY = std::numeric_limits<float>::max();
    float maxY = std::numeric_limits<float>::lowest();
    float minZ = std::numeric_limits<float>::max();
    float maxZ = std::numeric_limits<float>::lowest();
    for (const glm::vec4& v : corners)
    {
        const glm::vec4 trf = lightView * v;
        minX = std::min(minX, trf.x);
        maxX = std::max(maxX, trf.x);
        minY = std::min(minY, trf.y);
        maxY = std::max(maxY, trf.y);
        minZ = std::min(minZ, trf.z);
        maxZ = std::max(maxZ, trf.z);
    }

    // Tune this parameter according to the scene
    constexpr float zMult = 10.0f;
    if (minZ < 0)
    {
        minZ *= zMult;
    }
    else
    {
        minZ /= zMult;
    }
    if (maxZ < 0)
    {
        maxZ /= zMult;
    }
    else
    {
        maxZ *= zMult;
    }

    const glm::mat4 lightProjection = glm::ortho(minX, maxX, minY, maxY, minZ, maxZ);
    return lightProjection * lightView;
}
```

The course takes the camera globals (`fov`, `cameraPos`, `cameraFront`, `cameraUp`) where learnopengl uses its `Camera`
class.
:::
:::vulkan
`getLightSpaceMatrix(nearPlane, farPlane)` is learnopengl's GLM code with the camera globals: the corners of
`glm::perspective(glm::radians(fov), …, nearPlane, farPlane)` and the camera's view, their centre, the light view
`glm::lookAt(center + lightDir, center, glm::vec3(0.0f, 1.0f, 0.0f))`, the minima and maxima in light space, the
stretched z range and `glm::ortho(minX, maxX, minY, maxY, minZ, maxZ)`. With `GLM_FORCE_DEPTH_ZERO_TO_ONE`, `glm::ortho`
maps the light's z range to 0..1 – the depth range Vulkan stores – where OpenGL maps it to -1..1 and then to the window
depth 0..1. So the shadow maps hold exactly the same depth values in both APIs.
:::
:::d3d12
`getLightSpaceMatrix(nearPlane, farPlane)` and `getLightSpaceMatrices()` are methods of `D3D12App` (they need
`m_width` / `m_height` for the aspect ratio); the maths is learnopengl's, with `fminf` / `fmaxf` and `FLT_MAX` (the
`min` / `max` macros of `<windows.h>` get in the way of `std::min` / `std::max`). The one real difference is the light's
projection: `XMMatrixOrthographicOffCenterRH` maps the same box to Direct3D's depth 0..1 where `glm::ortho` maps it to
-1..1 (which OpenGL then turns into window depth 0..1) – so the depth stored in the shadow maps is the same number in
both APIs:

```cpp
    // learnopengl's glm::ortho(minX, maxX, minY, maxY, minZ, maxZ): the same box, with
    // Direct3D's depth from 0 to 1
    const XMMATRIX lightProjection = XMMatrixOrthographicOffCenterRH(minX, maxX, minY, maxY, minZ, maxZ);
    XMFLOAT4X4 lightSpaceMatrix;
    XMStoreFloat4x4(&lightSpaceMatrix, lightView * lightProjection);    // row vectors: the view first, then the projection
    return lightSpaceMatrix;
```
:::

`getLightSpaceMatrices()` calls it once per cascade – camera near plane to the first split, split to split, last split
to the camera's far plane – and returns the five matrices. They depend on the camera, so they are recomputed **every
frame**: move the camera and the cascades move with it. (In this project the camera stands still, but the code is
ready for one that doesn't.)

```quiz
Why does `getLightSpaceMatrix` stretch the light box's z range by `zMult` instead of fitting it tightly around the cascade's corners?
- [ ] To make the depth values more precise
- [ ] Because an orthographic projection needs a near plane at 0
- [ ] To cover the next cascade as well, so that the cascades overlap
- [x] Because objects between the light and the cascade – outside the camera's frustum – can cast shadows into it, and a tight box would clip them away in the depth pass
---
x and y only need to cover what the camera sees of the cascade. Along the light's direction, everything that can throw a shadow onto that part must be in the depth map too. learnopengl's factor 10 is a tuning value for its scene; a tighter way is to fit the z range to the scene's bounds.
```

### The matrices in a uniform buffer

Both passes need all five matrices: the depth pass to render each cascade, the scene pass to look up the right one.
learnopengl keeps them in a uniform buffer – `layout (std140) uniform LightSpaceMatrices { mat4
lightSpaceMatrices[16]; };`, room for up to 16 cascades – and fills it each frame.

:::opengl
```cpp
    unsigned int matricesUBO;
    glGenBuffers(1, &matricesUBO);
    glBindBuffer(GL_UNIFORM_BUFFER, matricesUBO);
    glBufferData(GL_UNIFORM_BUFFER, sizeof(glm::mat4x4) * 16, nullptr, GL_STATIC_DRAW);
    glBindBufferBase(GL_UNIFORM_BUFFER, 0, matricesUBO);
    glBindBuffer(GL_UNIFORM_BUFFER, 0);
```

and at the start of every frame:

```cpp
        // 0. UBO setup: the light-space matrices of this frame's cascades
        const std::vector<glm::mat4> lightMatrices = getLightSpaceMatrices();
        glBindBuffer(GL_UNIFORM_BUFFER, matricesUBO);
        for (size_t i = 0; i < lightMatrices.size(); ++i)
        {
            glBufferSubData(GL_UNIFORM_BUFFER, i * sizeof(glm::mat4x4), sizeof(glm::mat4x4), &lightMatrices[i]);
        }
        glBindBuffer(GL_UNIFORM_BUFFER, 0);
```

The buffer is bound to binding point 0. Neither shader calls `glUniformBlockBinding` for its block: a uniform block's
binding is 0 by default, so both blocks read binding point 0 – learnopengl relies on that too. (`GL_STATIC_DRAW` is only
a hint; a buffer rewritten every frame would more honestly say `GL_DYNAMIC_DRAW`.)
:::
:::vulkan
learnopengl's second uniform buffer becomes a second buffer in the descriptor set: `struct LightSpaceMatrices {
glm::mat4 lightSpaceMatrices[16]; };` in its own persistently mapped buffer, `lightMatricesBuffer`, at **binding 2**,
visible to the geometry and the fragment stage. `updateUniformBuffer()` fills it every frame:

```cpp
        // 0. UBO setup: the light-space matrices of this frame's cascades
        const std::vector<glm::mat4> lightMatrices = getLightSpaceMatrices();
        LightSpaceMatrices matrices{};
        for (size_t i = 0; i < lightMatrices.size(); ++i) {
            matrices.lightSpaceMatrices[i] = lightMatrices[i];
        }
        memcpy(lightMatricesBufferMapped, &matrices, sizeof(matrices));
```

The shaders declare learnopengl's block with a binding: `layout(binding = 2) uniform LightSpaceMatrices { mat4
lightSpaceMatrices[16]; };`.
:::
:::d3d12
learnopengl's second uniform buffer becomes a second constant buffer: `struct LightSpaceMatrices { XMFLOAT4X4
lightSpaceMatrices[16]; }` (1024 bytes), persistently mapped and filled every frame in `OnUpdate` – transposed, like
every matrix the course hands to HLSL. Its CBV sits in CBV/SRV heap slot 3 behind **root parameter 3**, a descriptor
table with one CBV at b2, visible to all shaders: the depth pass's geometry shader and the scene's pixel shader both read
it as `cbuffer LightSpaceMatrices : register(b2) { float4x4 lightSpaceMatrices[16]; };`.
:::

Now do the first task, **light-matrices**: the split distances, the three functions and the uniform buffer, filled each
frame. Nothing reads the matrices yet, so the picture stays the same.

## One shadow map per cascade – in one texture

Five shadow maps could be five textures. learnopengl uses one **2D texture array** with five layers instead: one texture
object, one binding in the shader, and the layer is just a third texture coordinate. It also lets the depth pass render
all five at once, as we'll see. The course uses 1024 × 1024 texels per layer (learnopengl: 4096 × 4096 – the built-in
simulator draws on the CPU), nearest filtering, and a border of depth 1.0 outside the map, so that nothing outside a
cascade's box is in shadow.

:::opengl
```cpp
    glGenTextures(1, &lightDepthMaps);
    glBindTexture(GL_TEXTURE_2D_ARRAY, lightDepthMaps);
    glTexImage3D(
        GL_TEXTURE_2D_ARRAY, 0, GL_DEPTH_COMPONENT32F, depthMapResolution, depthMapResolution, int(shadowCascadeLevels.size()) + 1,
        0, GL_DEPTH_COMPONENT, GL_FLOAT, nullptr);

    glTexParameteri(GL_TEXTURE_2D_ARRAY, GL_TEXTURE_MIN_FILTER, GL_NEAREST);
    glTexParameteri(GL_TEXTURE_2D_ARRAY, GL_TEXTURE_MAG_FILTER, GL_NEAREST);
    glTexParameteri(GL_TEXTURE_2D_ARRAY, GL_TEXTURE_WRAP_S, GL_CLAMP_TO_BORDER);
    glTexParameteri(GL_TEXTURE_2D_ARRAY, GL_TEXTURE_WRAP_T, GL_CLAMP_TO_BORDER);

    constexpr float bordercolor[] = { 1.0f, 1.0f, 1.0f, 1.0f };
    glTexParameterfv(GL_TEXTURE_2D_ARRAY, GL_TEXTURE_BORDER_COLOR, bordercolor);

    // attach the whole array (all layers): the geometry shader picks the layer of each triangle
    glBindFramebuffer(GL_FRAMEBUFFER, lightFBO);
    glFramebufferTexture(GL_FRAMEBUFFER, GL_DEPTH_ATTACHMENT, lightDepthMaps, 0);
    glDrawBuffer(GL_NONE);
    glReadBuffer(GL_NONE);
```

`glTexImage3D` allocates all layers at once – for an array texture the "depth" parameter is the number of layers.
`glFramebufferTexture` (without `2D` or `Layer`) attaches the **whole** array: the framebuffer becomes *layered*, and
each primitive goes to the layer the geometry shader chooses with `gl_Layer`, exactly like the cube map faces in *Point
Shadows*.
:::
:::vulkan
The shadow map is one depth image (`lightDepthMaps`, `D32_SFLOAT`) with `arrayLayers = 5` and usage depth attachment +
sampled. One view of type `VK_IMAGE_VIEW_TYPE_2D_ARRAY` covers all five layers, and it serves twice: as the
`sampler2DArray` at binding 3, and as the depth attachment of a **layered framebuffer**:

```cpp
        // the same view is the framebuffer's depth attachment, with all the layers
        VkFramebufferCreateInfo framebufferInfo{};
        framebufferInfo.sType = VK_STRUCTURE_TYPE_FRAMEBUFFER_CREATE_INFO;
        framebufferInfo.renderPass = depthMapRenderPass;
        framebufferInfo.attachmentCount = 1;
        framebufferInfo.pAttachments = &lightDepthMapsView;
        framebufferInfo.width = depthMapResolution;
        framebufferInfo.height = depthMapResolution;
        framebufferInfo.layers = layerCount;
```

`layers = 5` is what lets the geometry shader's `gl_Layer` pick a layer. The render pass is the *Shadow Mapping*
project's depth-only pass (clear, store, final layout `DEPTH_STENCIL_READ_ONLY_OPTIMAL`). The sampler filters with
NEAREST and uses `VK_SAMPLER_ADDRESS_MODE_CLAMP_TO_BORDER` with `VK_BORDER_COLOR_FLOAT_OPAQUE_WHITE` – learnopengl's
border of 1.0.
:::
:::d3d12
The shadow map is one texture array, `m_lightDepthMaps`: `R32_TYPELESS` with `DepthOrArraySize = 5` (the fourth
argument of `CD3DX12_RESOURCE_DESC::Tex2D`). As in *Shadow Mapping*, the typeless format lets two views read the same
bits differently – here both views cover all five slices:

```cpp
        D3D12_DEPTH_STENCIL_VIEW_DESC dsvDesc = {};
        dsvDesc.Format = DXGI_FORMAT_D32_FLOAT;
        dsvDesc.ViewDimension = D3D12_DSV_DIMENSION_TEXTURE2DARRAY;
        dsvDesc.Flags = D3D12_DSV_FLAG_NONE;
        dsvDesc.Texture2DArray.MipSlice = 0;
        dsvDesc.Texture2DArray.FirstArraySlice = 0;
        dsvDesc.Texture2DArray.ArraySize = layers;
```

```cpp
        D3D12_SHADER_RESOURCE_VIEW_DESC srvDesc = {};
        srvDesc.Shader4ComponentMapping = D3D12_DEFAULT_SHADER_4_COMPONENT_MAPPING;
        srvDesc.Format = DXGI_FORMAT_R32_FLOAT;
        srvDesc.ViewDimension = D3D12_SRV_DIMENSION_TEXTURE2DARRAY;
        srvDesc.Texture2DArray.MostDetailedMip = 0;
        srvDesc.Texture2DArray.MipLevels = 1;
        srvDesc.Texture2DArray.FirstArraySlice = 0;
        srvDesc.Texture2DArray.ArraySize = layers;
```

The DSV goes into DSV heap slot 1, after the depth buffer's; the SRV into CBV/SRV heap slot 2, right after the wood's,
so one descriptor table holds both (t0 and t1). The static sampler s1 filters with points and uses
`D3D12_TEXTURE_ADDRESS_MODE_BORDER` with `D3D12_STATIC_BORDER_COLOR_OPAQUE_WHITE`. The array starts in `DEPTH_WRITE`;
after the depth pass a barrier turns it into a `PIXEL_SHADER_RESOURCE`, and another one turns it back at the end of the
frame.
:::

### All cascades in one pass

The obvious way to fill five shadow maps is five depth passes: bind a layer, set that cascade's matrix, draw the scene,
repeat. learnopengl does it in **one**: the scene is drawn once, and a geometry shader copies every triangle into each
layer. The vertex shader now only transforms to world space (`model * vec4(aPos, 1.0)`); the geometry shader runs **five
times per triangle** – geometry shader instancing – applies the invocation's light-space matrix and sends the triangle
to the layer of the same number.

:::opengl
```glsl
#version 410 core

// the shader runs 5 times per triangle (once per cascade): gl_InvocationID = 0 ... 4
layout(triangles, invocations = 5) in;
layout(triangle_strip, max_vertices = 3) out;

layout (std140) uniform LightSpaceMatrices
{
    mat4 lightSpaceMatrices[16];
};

void main()
{
    for (int i = 0; i < 3; ++i)
    {
        gl_Position = lightSpaceMatrices[gl_InvocationID] * gl_in[i].gl_Position;
        gl_Layer = gl_InvocationID;
        EmitVertex();
    }
    EndPrimitive();
}
```

The depth pass itself is short:

```cpp
        // 1. render depth of scene to texture (from light's perspective): all cascades in one pass
        // --------------------------------------------------------------
        simpleDepthShader.use();

        glBindFramebuffer(GL_FRAMEBUFFER, lightFBO);
        glViewport(0, 0, depthMapResolution, depthMapResolution);
        glClear(GL_DEPTH_BUFFER_BIT);
        renderScene(simpleDepthShader);
        glBindFramebuffer(GL_FRAMEBUFFER, 0);
```

`glClear` on a layered framebuffer clears all layers. learnopengl wraps the pass in `glCullFace(GL_FRONT)` /
`glCullFace(GL_BACK)` but never enables `GL_CULL_FACE`, so the calls do nothing; the course leaves them out.
:::
:::vulkan
```glsl
#version 450

// the shader runs 5 times per triangle (once per cascade): gl_InvocationID = 0 ... 4
layout(triangles, invocations = 5) in;
layout(triangle_strip, max_vertices = 3) out;

layout(binding = 2) uniform LightSpaceMatrices {
    mat4 lightSpaceMatrices[16];
};

void main() {
    for (int i = 0; i < 3; ++i) {
        gl_Position = lightSpaceMatrices[gl_InvocationID] * gl_in[i].gl_Position;
        gl_Layer = gl_InvocationID;
        EmitVertex();
    }
    EndPrimitive();
}
```

Geometry shaders are an optional feature in Vulkan: `isDeviceSuitable` checks `supportedFeatures.geometryShader`, and
`createLogicalDevice` turns it on with `deviceFeatures.geometryShader = VK_TRUE;`. The depth pipeline is created with
the three shader files – `createPipeline("shaders/shadow_mapping_depth.vert.spv", "shaders/shadow_mapping_depth.frag.spv",
"shaders/shadow_mapping_depth.geom.spv", …)` – and `recordCommandBuffer()` draws the scene once in the depth map's
render pass with `lightFramebuffer`. The render pass's clear clears all five layers.
:::
:::d3d12
HLSL's geometry shader instancing is the attribute `[instance(5)]`, the invocation number the system value
`SV_GSInstanceID` (GLSL's `gl_InvocationID`), and the layer the output `SV_RenderTargetArrayIndex` (`gl_Layer`):

```hlsl
struct PSInput
{
    float4 position : SV_POSITION;
    uint layer : SV_RenderTargetArrayIndex;    // the layer of the shadow maps this triangle goes to
};

GSInput VSMain(float4 position : POSITION)
{
    GSInput result;
    result.position = mul(position, model);
    return result;
}

[instance(5)]
[maxvertexcount(3)]
void GSMain(triangle GSInput input[3], uint invocation : SV_GSInstanceID, inout TriangleStream<PSInput> triStream)
{
    for (int i = 0; i < 3; ++i)
    {
        PSInput output;
        output.position = mul(input[i].position, lightSpaceMatrices[invocation]);
        output.layer = invocation;
        triStream.Append(output);
    }
    triStream.RestartStrip();
}
```

The geometry shader is compiled with the target `gs_5_0` and set as `psoDesc.GS` of `m_depthPipelineState` (and reset
with `CD3DX12_SHADER_BYTECODE(nullptr, 0)` for the next pipeline states). The depth pass binds no render target and the
array's DSV – `OMSetRenderTargets(0, nullptr, FALSE, &shadowDsvHandle)` – clears it (all slices) and calls
`RenderScene()` once.
:::

Why not five passes? They would work just as well – one view or framebuffer per layer and the cascade's matrix as a
push constant or root constant – and some engines prefer them, because geometry shaders are slow on some hardware. But
they submit the scene five times from the CPU. The geometry shader does the copies on the GPU, from one set of draw
calls, as learnopengl's article (and the *Point Shadows* chapter) does. A better way still is to send each object only to
the cascades its bounding volume touches – a near cube needn't be drawn into the cascade 250 units away.

For a first look at the result, the project draws one layer of the array on a screen quad instead of the scene – the
debug view of the *Shadow Mapping* chapter, now with a layer number (`showQuad = true`, `debugLayer = 2`).

Now do the second task, **depth-maps**: the array texture and its framebuffer, the geometry shader and the depth pass,
and the debug view. Build and run: the window shows **layer 2** – the cascade from 20 to 50 units, seen from the light.
White where nothing was drawn (depth 1), and a grey diamond: the floor's far corner as the light sees it, with the far
cubes as faint, slightly darker patches on it.

```quiz
In the depth pass, how often does the vertex shader run per vertex of the scene, and how often the geometry shader per triangle?
- [ ] Five times each: once per cascade
- [x] The vertex shader once per vertex (to world space), the geometry shader five times per triangle (one invocation per cascade)
- [ ] Once each: the geometry shader writes all five layers with one triangle
- [ ] The vertex shader five times, the geometry shader once
---
The scene is drawn once, so the vertex shader runs once per vertex. `invocations = 5` / `[instance(5)]` runs the geometry shader five times for every triangle, each invocation with its own `gl_InvocationID` / `SV_GSInstanceID`, which picks the matrix and the layer.
```

## Picking the cascade

Back in the scene pass (`showQuad = false`), the fragment shader has to know which cascade a fragment belongs to. The
split distances are distances along the camera's view direction, so the shader transforms the fragment into **view
space** and compares the absolute value of its z – its depth in front of the camera – with the split distances. The
first cascade whose far distance lies beyond the fragment's depth is its cascade; beyond the last split it is the last
cascade. learnopengl does this inside its shadow function; the course puts it into a function of its own, so that a debug
view can use it first:

:::opengl
```glsl
// the cascade of a fragment: the first one whose far distance lies beyond the fragment's depth in view space
int CascadeLayer(vec3 fragPosWorldSpace)
{
    vec4 fragPosViewSpace = view * vec4(fragPosWorldSpace, 1.0);
    float depthValue = abs(fragPosViewSpace.z);

    int layer = -1;
    for (int i = 0; i < cascadeCount; ++i)
    {
        if (depthValue < cascadePlaneDistances[i])
        {
            layer = i;
            break;
        }
    }
    if (layer == -1)
    {
        layer = cascadeCount;
    }
    return layer;
}
```

The shader gets `uniform float farPlane; uniform mat4 view; uniform float cascadePlaneDistances[16]; uniform int
cascadeCount;` – `cascadeCount` is the number of splits (4), learnopengl's "number of frusta - 1". The render loop sets
them: `shader.setFloat("farPlane", cameraFarPlane);`, `shader.setInt("cascadeCount", shadowCascadeLevels.size());` and
`cascadePlaneDistances[i]` in a loop (`view` is set already).
:::
:::vulkan
The cascades' values join the scene's uniform buffer. std140 needs care here: an array's elements are 16 bytes apart,
so learnopengl's `float cascadePlaneDistances[16]` becomes an array of `vec4` whose `.x` is used, and `farPlane` and
`cascadeCount` fill the four bytes after the two `vec3`s:

```cpp
struct UniformBufferObject {
    glm::mat4 view;
    glm::mat4 proj;
    glm::vec3 viewPos;
    float farPlane;
    glm::vec3 lightDir;
    int cascadeCount; // number of frusta - 1
    glm::vec4 cascadePlaneDistances[16];
};
```

`CascadeLayer` is learnopengl's loop with `abs((ubo.view * vec4(fragPosWorldSpace, 1.0)).z)` and
`ubo.cascadePlaneDistances[i].x`; `cascadeCount` is the number of splits (4), learnopengl's "number of frusta - 1".
:::
:::d3d12
The cascades' values join the scene's constant buffer. HLSL's packing rules put every element of a cbuffer array at the
start of a new 16-byte row, so learnopengl's `float cascadePlaneDistances[16]` becomes `float4
cascadePlaneDistances[16]` (C++ `XMFLOAT4`) whose `.x` is used, next to `float farPlane` and `int cascadeCount`.
`CascadeLayer` is learnopengl's loop with the view-space depth `abs(mul(float4(fragPosWorldSpace, 1.0f), view).z)` and
`cascadePlaneDistances[i].x`; `cascadeCount` is the number of splits (4), learnopengl's "number of frusta - 1".
:::

To see the cascades, the task tints every fragment with its cascade's colour – red, green, blue, yellow, magenta – by
multiplying the lighting with `cascadeColors[CascadeLayer(fragPos)]`. learnopengl's demo has a related view: with the
key C it draws the cascades' light boxes as translucent volumes (`drawCascadeVolumeVisualizers`), which shows how each
box encloses its slice of the frustum; the course describes it but doesn't build it.

Now do the third task, **cascade-layer**. Build and run: the floor is red near the camera, green in the middle and blue
at the back; the cubes take the colour of their cascade. The floor ends 25 units away, inside the blue cascade 2 – the
yellow and magenta cascades hold only the empty background, where nothing is drawn.

## Shadows

The shadow function is the *Shadow Mapping* chapter's with three changes: it picks the cascade first and transforms the
fragment with **that** cascade's matrix, it looks the depth up in **that** layer of the array – the layer is the third
texture coordinate of a `sampler2DArray` – and it scales the bias per cascade.

The bias needs scaling because the cascades' boxes have very different sizes. The bias is a distance in the shadow
map's depth, 0..1 across the light box's z range; a box ten times longer turns the same bias into ten times the distance
in the world – and too much bias detaches shadows from their casters (*peter panning*). learnopengl therefore divides the
bias by the cascade's far distance (times a factor 0.5): the farther and bigger the cascade, the smaller the bias in
depth units.

:::opengl
```glsl
float ShadowCalculation(vec3 fragPosWorldSpace)
{
    // select cascade layer
    int layer = CascadeLayer(fragPosWorldSpace);

    vec4 fragPosLightSpace = lightSpaceMatrices[layer] * vec4(fragPosWorldSpace, 1.0);
    // perform perspective divide
    vec3 projCoords = fragPosLightSpace.xyz / fragPosLightSpace.w;
    // transform to [0,1] range
    projCoords = projCoords * 0.5 + 0.5;

    // get depth of current fragment from light's perspective
    float currentDepth = projCoords.z;

    // keep the shadow at 0.0 when outside the far_plane region of the light's frustum.
    if (currentDepth > 1.0)
    {
        return 0.0;
    }
    // calculate bias (based on depth map resolution and slope)
    vec3 normal = normalize(fs_in.Normal);
    float bias = max(0.05 * (1.0 - dot(normal, lightDir)), 0.005);
    const float biasModifier = 0.5f;
    if (layer == cascadeCount)
    {
        bias *= 1 / (farPlane * biasModifier);
    }
    else
    {
        bias *= 1 / (cascadePlaneDistances[layer] * biasModifier);
    }

    float closestDepth = texture(shadowMap, vec3(projCoords.xy, layer)).r;
    float shadow = (currentDepth - bias) > closestDepth ? 1.0 : 0.0;

    return shadow;
}
```

The shader declares `uniform sampler2DArray shadowMap;` and learnopengl's `LightSpaceMatrices` block; the program binds
the array to texture unit 1 (`shader.setInt("shadowMap", 1);`, `glActiveTexture(GL_TEXTURE1); glBindTexture(GL_TEXTURE_2D_ARRAY,
lightDepthMaps);`). `main` computes `float shadow = ShadowCalculation(fs_in.FragPos);` and the debug tint goes.
:::
:::vulkan
`shadow_mapping.frag` declares the matrices at binding 2 and `layout(binding = 3) uniform sampler2DArray shadowMap;`.
`ShadowCalculation` is learnopengl's with one difference you know from the Vulkan *Shadow Mapping* chapter: only x and
y are mapped to 0..1 – the depth is 0..1 already:

```glsl
    vec4 fragPosLightSpace = lightSpaceMatrices[layer] * vec4(fragPosWorldSpace, 1.0);
    // perform perspective divide
    vec3 projCoords = fragPosLightSpace.xyz / fragPosLightSpace.w;
    // transform x and y to the [0,1] range of texture coordinates; z is in [0,1] already (GLM_FORCE_DEPTH_ZERO_TO_ONE)
    projCoords.xy = projCoords.xy * 0.5 + 0.5;
```

No y flip is needed anywhere on the light's path: the depth pass rendered with the same matrices the lookup uses, and in
Vulkan both a framebuffer's y and a texture's v point down, so they agree. The bias is scaled with
`ubo.cascadePlaneDistances[layer].x` (or `ubo.farPlane` for the last cascade), and the lookup is
`texture(shadowMap, vec3(projCoords.xy, layer)).r`. The descriptor set (bindings 0–3) is bound once at the start of
`recordCommandBuffer()`, before both passes.
:::
:::d3d12
The pixel shader declares `Texture2DArray shadowMap : register(t1);` and the `LightSpaceMatrices` cbuffer at b2.
`ShadowCalculation` is learnopengl's with the change you know from the Direct3D *Shadow Mapping* chapter: x and y become
texture coordinates with v flipped (v points down in Direct3D, y up), and z stays as it is (0..1):

```hlsl
    float4 fragPosLightSpace = mul(float4(fragPosWorldSpace, 1.0f), lightSpaceMatrices[layer]);
    // perform perspective divide
    float3 projCoords = fragPosLightSpace.xyz / fragPosLightSpace.w;
    // transform x and y from [-1,1] to [0,1] texture coordinates: in Direct3D v points down
    // while y points up, so y is flipped. z needs nothing: Direct3D's depth is 0..1 already.
    float2 shadowUV = float2(projCoords.x * 0.5f + 0.5f, -projCoords.y * 0.5f + 0.5f);
```

The bias is scaled with `cascadePlaneDistances[layer].x` (or `farPlane` for the last cascade), and the lookup is
`shadowMap.Sample(shadowSampler, float3(shadowUV, layer)).r` – a `Texture2DArray` takes the layer as the third
coordinate.
:::

```quiz
Why does the shadow function scale the bias down for the farther cascades?
- [ ] Because far fragments need no bias: shadow acne only appears near the camera
- [x] Because the bias is measured in the shadow map's 0..1 depth, which spans a much longer z range in a big cascade – the same bias would push shadows away from their casters there
- [ ] Because the far cascades' shadow maps have fewer texels
- [ ] Because PCF already removes the acne in the far cascades
---
In cascade 0 the light box is a few tens of units deep, in cascade 3 hundreds. A depth difference of 0.005 is a small distance in the first and a large one in the second. Dividing by the cascade's far distance keeps the bias roughly constant in world units.
```

Now do the fourth task, **shadows**. Build and run: the cubes cast their shadows onto the floor – back and to the left,
away from the light – in all three cascades the floor reaches, and onto each other. Where a shadow falls only the ambient
term is left. Look along the floor from near to far: the shadows stay crisp across the cascade borders, although the
cascades' maps cover very different areas.

## PCF

The shadows' edges are hard steps, one texel of the cascade's map wide – and a texel of cascade 2 is much bigger on the
floor than one of cascade 0. Percentage-closer filtering softens them as in the *Shadow Mapping* chapter: compare the
depth against the 3 × 3 texels around the position in the cascade's layer and average the nine results. The texel size
comes from the array's size – its width and height; the third component is the number of layers.

:::opengl
```glsl
    // PCF
    float shadow = 0.0;
    vec2 texelSize = 1.0 / vec2(textureSize(shadowMap, 0));
    for(int x = -1; x <= 1; ++x)
    {
        for(int y = -1; y <= 1; ++y)
        {
            float pcfDepth = texture(shadowMap, vec3(projCoords.xy + vec2(x, y) * texelSize, layer)).r;
            shadow += (currentDepth - bias) > pcfDepth ? 1.0 : 0.0;
        }
    }
    shadow /= 9.0;
```

`textureSize` of a `sampler2DArray` returns an `ivec3` (width, height, layers); `vec2(…)` keeps the first two.
:::
:::vulkan
```glsl
    // PCF
    float shadow = 0.0;
    vec2 texelSize = 1.0 / vec2(textureSize(shadowMap, 0));
    for (int x = -1; x <= 1; ++x) {
        for (int y = -1; y <= 1; ++y) {
            float pcfDepth = texture(shadowMap, vec3(projCoords.xy + vec2(x, y) * texelSize, layer)).r;
            shadow += (currentDepth - bias) > pcfDepth ? 1.0 : 0.0;
        }
    }
    shadow /= 9.0;
```

`textureSize` of a `sampler2DArray` returns an `ivec3` (width, height, layers); `vec2(…)` keeps the first two.
:::
:::d3d12
```hlsl
    float shadow = 0.0f;
    uint width, height, elements;
    shadowMap.GetDimensions(width, height, elements);
    float2 texelSize = 1.0f / float2(width, height);
    for (int x = -1; x <= 1; ++x)
    {
        for (int y = -1; y <= 1; ++y)
        {
            float pcfDepth = shadowMap.Sample(shadowSampler, float3(shadowUV + float2(x, y) * texelSize, layer)).r;
            shadow += (currentDepth - bias) > pcfDepth ? 1.0f : 0.0f;
        }
    }
```

`GetDimensions` of a `Texture2DArray` returns the width, the height and the number of elements (layers).
:::

Now do the last task, **pcf**. Build and run: the shadows get a soft border one texel wide – narrow near the camera,
wider at the back, where a texel of the far cascade covers more floor.

## Going further

Cascaded shadow maps are the standard technique for sunlight in open scenes, and learnopengl's article ends with the
improvements a production version needs:

- **Visible seams between cascades.** Where one cascade ends and the next begins, the shadow's resolution jumps, and a
  soft edge can suddenly get sharper. Blending the two cascades' results over a short band near the split hides the
  seam, at the price of two lookups there.
- **Shimmering.** The light boxes are recomputed every frame from the camera. When the camera moves or turns, each box
  moves and changes its size by fractions of a texel, so the shadow maps' texel grid slides over the world and shadow
  edges crawl and flicker. *Stabilising* the cascades fixes it: use a bounding *sphere* around the slice so the box's
  size doesn't change when the camera turns, and snap the box's position to whole texels in light space.
- **Tighter z ranges.** `zMult` is a guess. Fitting the near and far planes of the light box to the scene's bounds (or
  to the objects that can actually cast into the cascade) uses the depth precision better.
- **Choosing the splits.** A mix of a linear and a logarithmic split scheme ("practical split scheme") adapts the
  cascades to the near and far plane better than fixed fractions.
- **Culling per cascade.** With frustum culling against each light box, each object is only rendered into the cascades it
  can affect.
:::opengl
- **The context version.** The single-pass depth pass needs geometry shader instancing (OpenGL 4.0); with OpenGL 3.3
  you would render one pass per cascade, attaching one layer at a time with `glFramebufferTextureLayer`.
:::
:::vulkan
- **Without geometry shaders.** On devices without the `geometryShader` feature (many mobile GPUs) you render one pass
  per cascade with a single-layer view; with `VK_KHR_multiview` (core in Vulkan 1.1) one pass can also render into
  several layers with a different matrix per view.
:::
:::d3d12
- **Without geometry shaders.** The geometry shader stage is slow on some hardware; Direct3D 12 also offers view
  instancing (`ViewInstanceCount` in the pipeline state, `SV_ViewID` in the shader), which renders the same draw into
  several render target array slices with a different matrix per view.
:::

## Additional resources

- [Cascaded Shadow Mapping](https://learnopengl.com/Guest-Articles/2021/CSM): learnopengl's guest article this chapter
  follows, with pictures of the cascades and the light boxes.
- [shadow_mapping.cpp](https://github.com/JoeyDeVries/LearnOpenGL/blob/master/src/8.guest/2021/2.csm/shadow_mapping.cpp):
  learnopengl's demo with the cascade visualiser (key C).
- [Cascaded Shadow Maps (Microsoft)](https://learn.microsoft.com/en-us/windows/win32/dxtecharts/cascaded-shadow-maps):
  Microsoft's technical article on CSM, with stabilisation and the choice of the splits.

:::opengl
- [glFramebufferTexture](https://registry.khronos.org/OpenGL-Refpages/gl4/html/glFramebufferTexture.xhtml): attaching a
  whole array texture as a layered attachment.
:::
:::vulkan
- [Geometry shaders (Vulkan specification)](https://docs.vulkan.org/spec/latest/chapters/geometry.html): invocations,
  `gl_Layer` and layered framebuffers.
:::
:::d3d12
- [Geometry-Shader Object (HLSL)](https://learn.microsoft.com/en-us/windows/win32/direct3dhlsl/dx-graphics-hlsl-geometry-shader):
  `[instance(n)]`, `SV_GSInstanceID` and the stream output.
:::
