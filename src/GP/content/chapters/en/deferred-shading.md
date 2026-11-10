# Deferred Shading

The way we did lighting so far was called *forward rendering* or *forward shading*. A straightforward approach where we
render an object and light it according to all light sources in a scene. We do this for every object individually for
each object in the scene. While quite easy to understand and implement it is also quite heavy on performance as each
rendered object has to iterate over each light source for every rendered fragment, which is a lot! Forward rendering
also tends to waste a lot of fragment shader runs in scenes with a high depth complexity (multiple objects cover the
same screen pixel) as fragment shader outputs are overwritten: a fragment is lit with every light, and then a nearer
object covers it and all that work is thrown away.

*Deferred shading* or *deferred rendering* aims to overcome these issues by drastically changing the way we render
objects. This gives us several new options to significantly optimize scenes with large numbers of lights, allowing us to
render hundreds (or even thousands) of lights with an acceptable framerate. Deferred shading is based on the idea that
we *defer* or *postpone* most of the heavy rendering (like lighting) to a later stage. It consists of two passes:

1. The **geometry pass**: we render the scene once and retrieve all kinds of geometrical information from the objects
   that we store in a collection of textures called the **G-buffer**; think of position vectors, colour vectors, normal
   vectors and/or specular values. No lighting is calculated here.
2. The **lighting pass**: we render a screen-filled quad and calculate the scene's lighting for each pixel using the
   geometrical information stored in the G-buffer – pixel by pixel.

The big advantage: whatever fragment ends up in the G-buffer is the actual fragment information that ends up as a screen
pixel, as the depth test already concluded this fragment to be the last and top-most fragment. This ensures that for
each pixel we process in the lighting pass, we only calculate lighting once. Forward rendering costs *fragments × lights*
lighting calculations, and a scene with a lot of overlap has many more fragments than pixels; deferred rendering costs
*pixels × lights*, however many objects overlap. Furthermore, deferred rendering opens up the possibility for further
optimizations that allow us to render a much larger amount of light sources than with forward rendering – the light
volumes at the end of this chapter.

It also comes with a few disadvantages: the G-buffer requires us to store a relatively large amount of scene data in its
texture colour buffers, which eats memory, especially since scene data like position vectors require a high precision.
Another disadvantage is that it doesn't support blending (as we only have information of the top-most fragment) and
MSAA no longer works. There are several workarounds for this that we'll get to at the end of the chapter.

This chapter and the next one, *SSAO*, are the last lessons of the Advanced Lighting part. Nothing in them needs a new
kind of API object: the G-buffer is the floating point render targets of the HDR chapter, written all at once like the
two colour buffers of the bloom chapter, and the lighting pass is one more screen quad. This chapter shows how {{api}}
puts them together.

```quiz
In the start's forward renderer the boxes overlap on the screen. Where does it do lighting work that deferred shading avoids?
- [ ] It lights the background pixels, where no box is
- [ ] It lights every box twice: once for the diffuse and once for the specular part
- [x] A fragment of a box farther back is lit with all 32 lights, and then a nearer box covers it: that work is thrown away – deferred shading lights only the fragment that is left in each pixel
- [ ] It runs the vertex shader once per light
---
The depth test decides which fragment stays only after the fragment shader has run. Deferring the lighting to a pass over the finished G-buffer means every pixel is lit exactly once.
```

## The scene

learnopengl draws its backpack model nine times on a 3 × 3 grid; the course draws **nine container boxes** at the same
positions (x -3, 0, 3; y -0.5; z -3, 0, 3), each the 2 × 2 × 2 cube of the earlier chapters scaled by 0.75 – boxes 1.5
units wide, 1.5 units apart. The model doesn't matter for the technique, and boxes need no model loading. They use
`container2.png` as diffuse map and `container2_specular.png` as specular map, read as plain (linear) textures:
learnopengl's deferred demo does not gamma-correct, and neither does this chapter (no tone mapping either).

The lights are learnopengl's: **32 point lights** at "slightly random" positions with random colours:

:::opengl vulkan
```cpp
    srand(13);
    for (unsigned int i = 0; i < NR_LIGHTS; i++)
    {
        // calculate slightly random offsets
        float xPos = static_cast<float>(((rand() % 100) / 100.0) * 6.0 - 3.0);
        float yPos = static_cast<float>(((rand() % 100) / 100.0) * 6.0 - 4.0);
        float zPos = static_cast<float>(((rand() % 100) / 100.0) * 6.0 - 3.0);
        lightPositions.push_back(glm::vec3(xPos, yPos, zPos));
        // also calculate random color
        float rColor = static_cast<float>(((rand() % 100) / 200.0f) + 0.5); // between 0.5 and 1.0
        float gColor = static_cast<float>(((rand() % 100) / 200.0f) + 0.5); // between 0.5 and 1.0
        float bColor = static_cast<float>(((rand() % 100) / 200.0f) + 0.5); // between 0.5 and 1.0
        lightColors.push_back(glm::vec3(rColor, gColor, bColor));
    }
```
:::
:::d3d12
```cpp
    srand(13);
    for (unsigned int i = 0; i < NR_LIGHTS; i++)
    {
        // calculate slightly random offsets
        float xPos = static_cast<float>(((rand() % 100) / 100.0) * 6.0 - 3.0);
        float yPos = static_cast<float>(((rand() % 100) / 100.0) * 6.0 - 4.0);
        float zPos = static_cast<float>(((rand() % 100) / 100.0) * 6.0 - 3.0);
        lightPositions.push_back(XMFLOAT3(xPos, yPos, zPos));
        // also calculate random color
        float rColor = static_cast<float>(((rand() % 100) / 200.0f) + 0.5); // between 0.5 and 1.0
        float gColor = static_cast<float>(((rand() % 100) / 200.0f) + 0.5); // between 0.5 and 1.0
        float bColor = static_cast<float>(((rand() % 100) / 200.0f) + 0.5); // between 0.5 and 1.0
        lightColors.push_back(XMFLOAT3(rColor, gColor, bColor));
    }
```
:::

`srand(13)` seeds the C library's random number generator: the same seed gives the same sequence, so the lights land in
the same places every run. The sequence itself belongs to the C library, though: the pictures described here are those
of glibc's `rand()` (Linux, and the built-in simulator); with Microsoft's C runtime on Windows the 32 lights land
elsewhere – the same kind of scene, different in detail. The lights' attenuation is constant 1, linear 0.7 and quadratic
1.8, a short reach, so each light colours only the boxes near it. The lighting is learnopengl's: an ambient term of
`Diffuse * 0.1`, and for each light a diffuse term and a Blinn-Phong specular term (exponent 16, times the specular
map's value), both attenuated – in world space.

The camera is not learnopengl's (0, 0, 5) looking straight ahead: from there the front row hides the grid and most of the
lights. It sits at **(0, 5, 9) and looks down at the grid** (yaw -90, pitch -35), so the whole grid shows, with the lights
between, above and below the boxes. Nothing moves; the program needs no input.

:::opengl
The start is a forward renderer: `main.cpp` draws the nine boxes into the window with `forward_shading.vs` /
`forward_shading.fs`, and the fragment shader loops over all 32 lights for every fragment – learnopengl's lighting code,
with the surface data coming straight from the vertex shader and the textures. The light uniforms are set every frame
in a loop (`lights[i].Position`, `.Color`, `.Linear`, `.Quadratic`) together with `viewPos`. `renderCube()` and
learnopengl's `renderQuad()` (a screen-filling quad drawn as a triangle strip) are at the end of `main.cpp`. The
deferred shaders are there already: `g_buffer.vs` and `deferred_shading.vs` are complete, `g_buffer.fs` has its outputs
but its `main` is a TODO, `deferred_shading.fs` reads the G-buffer but only shows the albedo, and
`deferred_light_box.vs` / `.fs` are complete (they are used in the third task).
:::
:::vulkan
The start is a forward renderer: `recordCommandBuffer()` draws the nine boxes into the window with `forwardPipeline`
(`shaders/forward_shading.vert` / `.frag`) – a `for` loop over `objectPositions` with the model matrix as a push constant
and `vkCmdDraw(commandBuffer, 36, 1, 0, 0)` – and the fragment shader loops over all 32 lights for every fragment. The
lights are in the uniform buffer, after the matrices:

```cpp
struct Light {
    glm::vec3 position;
    float linear;
    glm::vec3 color;
    float quadratic;
};
```

std140 starts a `vec3` at a multiple of 16 bytes, like a `vec4`, so there is a 4-byte gap after each `vec3`. learnopengl's
order is Position, Color, Linear, Quadratic; the course moves each float into the gap after a `vec3`, so the C++ struct
has the shader's offsets without padding members (32 bytes per light). `updateUniformBuffer()` fills
`ubo.lights[i]` every frame (`linear` 0.7, `quadratic` 1.8) and `ubo.viewPos = cameraPos`; `createLights()` runs
learnopengl's loop above once. The vertex buffer holds the cube (vertices 0..35) and the screen quad (36..41). The
pipeline helper is `createPipeline(vertFile, fragFile, pipelineRenderPass, colorAttachmentCount, pipeline)`, with one
blend state per colour attachment, as in the bloom chapter. `createTextureSampler(filter, addressMode, sampler)` enables
anisotropic filtering only for `VK_FILTER_LINEAR` – a NEAREST sampler must return exactly one texel. The deferred
shaders are in `shaders/`: `g_buffer.vert`, `deferred_shading.vert` (the screen quad) and `deferred_light_box.vert` are
complete; `g_buffer.frag`, `deferred_shading.frag` and `deferred_light_box.frag` are TODOs that compile and write nothing.
:::
:::d3d12
The start is a forward renderer: `PopulateCommandList` draws the nine boxes into the back buffer with `m_pipelineState`
(`forward_shading.hlsl`) – their two maps (heap slots 1 and 2) in root parameter 2's table, and per box the model and
normal matrices as root constants (`ModelConstants`, root parameter 0) – and the pixel shader loops over all 32 lights
for every pixel. The lights are in the constant buffer (b1), filled in `OnUpdate` from the globals `lightPositions` /
`lightColors` that `LoadAssets` computes with learnopengl's loop above (as `XMFLOAT3`s). HLSL packs
`struct Light { float3 Position; float3 Color; float Linear; float Quadratic; }` in 16-byte rows: Position at offset 0,
Color at 16 – a `float3` never crosses a row, so it can't start at 12 –, Linear at 28, Quadratic at 32, and each element
of an array starts a new row, so a light takes 48 bytes. The C++ struct mirrors that with padding:
`XMFLOAT3 Position; float padding0; XMFLOAT3 Color; float Linear; float Quadratic; float padding1[3];`. The deferred
shader files are there: `g_buffer.hlsl` (its `PSMain` a TODO), `deferred_shading.hlsl` (it only shows the albedo) and
`deferred_light_box.hlsl` (complete, used in the third task).
:::

The `// TODO:` comments in the project mark where your code goes. Press **Build & run** (Ctrl+Enter) to compile the
program and run it in the built-in simulator: the 3 × 3 grid of wooden boxes with steel frames from above and behind,
the near row large at the bottom, the far row small at the top, black around them. The boxes' tops and the faces turned
towards nearby lights are lit in warm pastel colours, the rest is dark – only the 0.1 ambient term. The lights themselves
are invisible. Every fragment of every box was lit with all 32 lights, including the fragments that a nearer box then
covered.

## The G-buffer

The G-buffer is the collective term of all textures used to store lighting-relevant data for the final lighting pass.
Let's take this moment to briefly review all the data we need to light a fragment with forward rendering:

- A 3D world-space **position** vector to calculate the (interpolated) fragment position variable used for `lightDir`
  and `viewDir`.
- An RGB diffuse **colour** vector also known as *albedo*.
- A 3D **normal** vector for determining a surface's slope.
- A **specular** intensity float.
- All light source position and colour vectors.
- The player or viewer's position vector.

With these (per-fragment) variables at our disposal we are able to calculate the (Blinn-)Phong lighting we're
accustomed to. The light source positions and colours, and the viewer's position, can be configured as before; they are
the same for every pixel. The other variables are all specific to each of an object's fragments. If we can somehow pass
the exact same data to the final deferred lighting pass we can calculate the same lighting effects, even though we're
rendering fragments of a 2D quad.

There is no limit on what we can store in a G-buffer. Since we store all data in screen space, we store it in textures
the size of the window. We need positions, normals and colours – three render targets. Positions and normals are not
limited to 0..1 and need precision, so they go into **16-bit floating point** targets (half floats: enough precision
for positions in a scene of this size); the colour and the specular intensity fit into one **8-bit** RGBA target: the
albedo in rgb, the specular intensity in alpha. The geometry pass writes all three at once with the multiple render
targets of the bloom chapter. Each G-buffer target has four channels, even where three would do: GPUs generally prefer
4-component formats due to byte alignment, and some drivers may fail to complete a framebuffer with 3-component formats
otherwise.

| G-buffer target | contents | {{api}} format |
| --- | --- | --- |
| gPosition | world-space position (xyz) | 16-bit float RGBA |
| gNormal | world-space normal (xyz) | 16-bit float RGBA |
| gAlbedoSpec | albedo (rgb), specular intensity (a) | 8-bit UNORM RGBA |

The geometry pass also needs a depth buffer of its own: the depth test is what makes the G-buffer hold, for every pixel,
the nearest surface.

```quiz
Why are gPosition and gNormal 16-bit floating point targets, while albedo and specular share an 8-bit target?
- [x] A position like (-3.75, -1.25, 2.4) or a normal with negative components doesn't fit into 0..1, and positions need more than 256 steps; a colour and an intensity between 0 and 1 are fine with 8 bits
- [ ] Floating point targets are faster to write, and the albedo target is read more often
- [ ] The albedo is gamma-corrected, which only works with 8-bit formats
- [ ] Only the first two render targets of a pass can be floating point
---
An 8-bit UNORM channel stores 256 values between 0.0 and 1.0: it would clamp every position and every negative normal component. The price of the precision is memory: two 8-byte targets and one 4-byte target per pixel.
```

:::opengl
The G-buffer is a framebuffer with three colour textures and a depth renderbuffer – learnopengl's code, in the start's
TODO after the textures:

```cpp
    // configure g-buffer framebuffer
    // ------------------------------
    unsigned int gBuffer;
    glGenFramebuffers(1, &gBuffer);
    glBindFramebuffer(GL_FRAMEBUFFER, gBuffer);
    unsigned int gPosition, gNormal, gAlbedoSpec;
    // position color buffer
    glGenTextures(1, &gPosition);
    glBindTexture(GL_TEXTURE_2D, gPosition);
    glTexImage2D(GL_TEXTURE_2D, 0, GL_RGBA16F, SCR_WIDTH, SCR_HEIGHT, 0, GL_RGBA, GL_FLOAT, NULL);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, GL_NEAREST);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, GL_NEAREST);
    glFramebufferTexture2D(GL_FRAMEBUFFER, GL_COLOR_ATTACHMENT0, GL_TEXTURE_2D, gPosition, 0);
    // normal color buffer
    glGenTextures(1, &gNormal);
    glBindTexture(GL_TEXTURE_2D, gNormal);
    glTexImage2D(GL_TEXTURE_2D, 0, GL_RGBA16F, SCR_WIDTH, SCR_HEIGHT, 0, GL_RGBA, GL_FLOAT, NULL);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, GL_NEAREST);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, GL_NEAREST);
    glFramebufferTexture2D(GL_FRAMEBUFFER, GL_COLOR_ATTACHMENT1, GL_TEXTURE_2D, gNormal, 0);
    // color + specular color buffer
    glGenTextures(1, &gAlbedoSpec);
    glBindTexture(GL_TEXTURE_2D, gAlbedoSpec);
    glTexImage2D(GL_TEXTURE_2D, 0, GL_RGBA, SCR_WIDTH, SCR_HEIGHT, 0, GL_RGBA, GL_UNSIGNED_BYTE, NULL);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, GL_NEAREST);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, GL_NEAREST);
    glFramebufferTexture2D(GL_FRAMEBUFFER, GL_COLOR_ATTACHMENT2, GL_TEXTURE_2D, gAlbedoSpec, 0);
    // tell OpenGL which color attachments we'll use (of this framebuffer) for rendering
    unsigned int attachments[3] = { GL_COLOR_ATTACHMENT0, GL_COLOR_ATTACHMENT1, GL_COLOR_ATTACHMENT2 };
    glDrawBuffers(3, attachments);
    // create and attach depth buffer (renderbuffer)
    unsigned int rboDepth;
    glGenRenderbuffers(1, &rboDepth);
    glBindRenderbuffer(GL_RENDERBUFFER, rboDepth);
    glRenderbufferStorage(GL_RENDERBUFFER, GL_DEPTH_COMPONENT, SCR_WIDTH, SCR_HEIGHT);
    glFramebufferRenderbuffer(GL_FRAMEBUFFER, GL_DEPTH_ATTACHMENT, GL_RENDERBUFFER, rboDepth);
    // finally check if framebuffer is complete
    if (glCheckFramebufferStatus(GL_FRAMEBUFFER) != GL_FRAMEBUFFER_COMPLETE)
        std::cout << "Framebuffer not complete!" << std::endl;
    glBindFramebuffer(GL_FRAMEBUFFER, 0);
```

`glDrawBuffers` tells OpenGL that this framebuffer renders into all three colour attachments – without it, only
`GL_COLOR_ATTACHMENT0` would be written. The textures use `GL_NEAREST`: the lighting pass must read exactly one texel per
pixel, never a blend of two neighbouring positions or normals (more on that in the next section).

The geometry pass writes into them. `g_buffer.vs` is complete: it hands on the world-space position (`FragPos =
worldPos.xyz`), the texture coordinates and the normal (with the normal matrix). `g_buffer.fs` declares one output per
attachment – location n goes to the n-th entry of the draw buffers – and its `main` stores the data:

```glsl
#version 330 core
layout (location = 0) out vec3 gPosition;
layout (location = 1) out vec3 gNormal;
layout (location = 2) out vec4 gAlbedoSpec;

in vec2 TexCoords;
in vec3 FragPos;
in vec3 Normal;

uniform sampler2D texture_diffuse1;
uniform sampler2D texture_specular1;

void main()
{
    // store the fragment position vector in the first gbuffer texture
    gPosition = FragPos;
    // also store the per-fragment normals into the gbuffer
    gNormal = normalize(Normal);
    // and the diffuse per-fragment color
    gAlbedoSpec.rgb = texture(texture_diffuse1, TexCoords).rgb;
    // store specular intensity in gAlbedoSpec's alpha component
    gAlbedoSpec.a = texture(texture_specular1, TexCoords).r;
}
```

In `main.cpp`, the forward `shader` gives way to the two passes' shaders:

```cpp
    Shader shaderGeometryPass("g_buffer.vs", "g_buffer.fs");
    Shader shaderLightingPass("deferred_shading.vs", "deferred_shading.fs");
```

configured once (`shaderGeometryPass.setInt("texture_diffuse1", 0)` and `("texture_specular1", 1)`;
`shaderLightingPass.setInt("gPosition", 0)`, `("gNormal", 1)`, `("gAlbedoSpec", 2)`). The render loop becomes
learnopengl's two passes – the boxes into the G-buffer, then the screen quad into the window:

```cpp
        // 1. geometry pass: render scene's geometry/color data into gbuffer
        // -----------------------------------------------------------------
        glBindFramebuffer(GL_FRAMEBUFFER, gBuffer);
        glClear(GL_COLOR_BUFFER_BIT | GL_DEPTH_BUFFER_BIT);
        glm::mat4 projection = glm::perspective(glm::radians(fov), (float)SCR_WIDTH / (float)SCR_HEIGHT, 0.1f, 100.0f);
        glm::mat4 view = glm::lookAt(cameraPos, cameraPos + cameraFront, cameraUp);
        glm::mat4 model = glm::mat4(1.0f);
        shaderGeometryPass.use();
        shaderGeometryPass.setMat4("projection", projection);
        shaderGeometryPass.setMat4("view", view);
        glActiveTexture(GL_TEXTURE0);
        glBindTexture(GL_TEXTURE_2D, diffuseMap);
        glActiveTexture(GL_TEXTURE1);
        glBindTexture(GL_TEXTURE_2D, specularMap);
        for (unsigned int i = 0; i < objectPositions.size(); i++)
        {
            model = glm::mat4(1.0f);
            model = glm::translate(model, objectPositions[i]);
            model = glm::scale(model, glm::vec3(0.75f)); // boxes 1.5 units wide
            shaderGeometryPass.setMat4("model", model);
            renderCube();
        }
        glBindFramebuffer(GL_FRAMEBUFFER, 0);

        // 2. lighting pass: calculate lighting by iterating over a screen filled quad pixel-by-pixel using the gbuffer's content.
        // -----------------------------------------------------------------------------------------------------------------------
        glClear(GL_COLOR_BUFFER_BIT | GL_DEPTH_BUFFER_BIT);
        shaderLightingPass.use();
        glActiveTexture(GL_TEXTURE0);
        glBindTexture(GL_TEXTURE_2D, gPosition);
        glActiveTexture(GL_TEXTURE1);
        glBindTexture(GL_TEXTURE_2D, gNormal);
        glActiveTexture(GL_TEXTURE2);
        glBindTexture(GL_TEXTURE_2D, gAlbedoSpec);
        // TODO: send the lights and the view position to the lighting pass
        // finally render quad
        renderQuad();
```

(The TODO is the next task.) `deferred_shading.fs` of the start reads the four values from the G-buffer and, for now,
writes `FragColor = vec4(Diffuse, 1.0); // for now: show the albedo`. Now do the first task, **g-buffer**, and delete
the three textures, the renderbuffer and the framebuffer at the end of `main`.
:::
:::vulkan
In Vulkan the G-buffer is a render pass with three colour attachments and a depth attachment, and a framebuffer with
four image views. `createGBufferRenderPass()` describes the attachments – learnopengl's formats, cleared at the start,
stored at the end and left in `VK_IMAGE_LAYOUT_SHADER_READ_ONLY_OPTIMAL`, ready for the lighting pass to sample:

```cpp
        VkAttachmentDescription positionAttachment{};
        positionAttachment.format = VK_FORMAT_R16G16B16A16_SFLOAT; // learnopengl: GL_RGBA16F
        positionAttachment.samples = VK_SAMPLE_COUNT_1_BIT;
        positionAttachment.loadOp = VK_ATTACHMENT_LOAD_OP_CLEAR;
        positionAttachment.storeOp = VK_ATTACHMENT_STORE_OP_STORE; // keep the data: the lighting pass reads it
        positionAttachment.stencilLoadOp = VK_ATTACHMENT_LOAD_OP_DONT_CARE;
        positionAttachment.stencilStoreOp = VK_ATTACHMENT_STORE_OP_DONT_CARE;
        positionAttachment.initialLayout = VK_IMAGE_LAYOUT_UNDEFINED;
        positionAttachment.finalLayout = VK_IMAGE_LAYOUT_SHADER_READ_ONLY_OPTIMAL; // ready to be sampled after the pass

        // the normals: the same kind of attachment
        VkAttachmentDescription normalAttachment = positionAttachment;

        // the diffuse colour (rgb) and the specular intensity (a): learnopengl's GL_RGBA
        VkAttachmentDescription albedoSpecAttachment = positionAttachment;
        albedoSpecAttachment.format = VK_FORMAT_R8G8B8A8_UNORM;
```

The depth attachment is the usual one (`findDepthFormat()`, cleared, final layout
`VK_IMAGE_LAYOUT_DEPTH_STENCIL_ATTACHMENT_OPTIMAL`). The subpass takes the three colour attachments in order – fragment
shader output location n writes `pColorAttachments[n]`, learnopengl's `glDrawBuffers(3, attachments)` – and the depth
at attachment 3:

```cpp
        // the fragment shader's outputs: location n -> attachment n (learnopengl's glDrawBuffers(3, attachments))
        std::array<VkAttachmentReference, 3> colorAttachmentRefs{};
        colorAttachmentRefs[0].attachment = 0;
        colorAttachmentRefs[0].layout = VK_IMAGE_LAYOUT_COLOR_ATTACHMENT_OPTIMAL;
        colorAttachmentRefs[1].attachment = 1;
        colorAttachmentRefs[1].layout = VK_IMAGE_LAYOUT_COLOR_ATTACHMENT_OPTIMAL;
        colorAttachmentRefs[2].attachment = 2;
        colorAttachmentRefs[2].layout = VK_IMAGE_LAYOUT_COLOR_ATTACHMENT_OPTIMAL;

        VkAttachmentReference depthAttachmentRef{};
        depthAttachmentRef.attachment = 3;
        depthAttachmentRef.layout = VK_IMAGE_LAYOUT_DEPTH_STENCIL_ATTACHMENT_OPTIMAL;
```

Two subpass dependencies chain the passes, as in the HDR chapter: before the pass, wait until the last frame's lighting
pass has read the images (they are written again now); after it, make the colour writes visible to the lighting pass's
fragment shader:

```cpp
        // after the pass: the lighting pass's fragment shader waits until the G-buffer has been written
        dependencies[1].srcSubpass = 0;
        dependencies[1].dstSubpass = VK_SUBPASS_EXTERNAL;
        dependencies[1].srcStageMask = VK_PIPELINE_STAGE_COLOR_ATTACHMENT_OUTPUT_BIT;
        dependencies[1].srcAccessMask = VK_ACCESS_COLOR_ATTACHMENT_WRITE_BIT;
        dependencies[1].dstStageMask = VK_PIPELINE_STAGE_FRAGMENT_SHADER_BIT;
        dependencies[1].dstAccessMask = VK_ACCESS_SHADER_READ_BIT;
```

`createGBuffer()` (called before `createFramebuffers()`) creates the images – colour attachment **and** sampled, as the
geometry pass draws into them and the lighting pass reads them – their views, a depth image, and the framebuffer with the
four views in the render pass's order:

```cpp
        // position color buffer
        createImage(swapChainExtent.width, swapChainExtent.height, VK_FORMAT_R16G16B16A16_SFLOAT, VK_IMAGE_TILING_OPTIMAL, VK_IMAGE_USAGE_COLOR_ATTACHMENT_BIT | VK_IMAGE_USAGE_SAMPLED_BIT, VK_MEMORY_PROPERTY_DEVICE_LOCAL_BIT, gPositionImage, gPositionImageMemory);
        gPositionImageView = createImageView(gPositionImage, VK_FORMAT_R16G16B16A16_SFLOAT, VK_IMAGE_ASPECT_COLOR_BIT);
```

and the same for `gNormalImage` and `gAlbedoSpecImage` (`VK_FORMAT_R8G8B8A8_UNORM`), then `gBufferDepthImage`,
`std::array<VkImageView, 4> attachments = {gPositionImageView, gNormalImageView, gAlbedoSpecImageView,
gBufferDepthImageView}` and `gBufferFramebuffer`. Every Vulkan device can render into and sample these two formats.

A pipeline is made for one render pass, and its colour blend state has one entry per colour attachment of the subpass.
So the forward pipeline gives way to two:

```cpp
        // a pipeline is made for one render pass: the geometry pass's for the G-buffer's (3 colour attachments)
        createPipeline("shaders/g_buffer.vert.spv", "shaders/g_buffer.frag.spv", gBufferRenderPass, 3, geometryPipeline);
        // the lighting pass's (the screen quad) for the window's
        createPipeline("shaders/deferred_shading.vert.spv", "shaders/deferred_shading.frag.spv", renderPass, 1, lightingPipeline);
```

The lighting pass reads the G-buffer through a sampler that returns exactly one texel – learnopengl's `GL_NEAREST`:
`createTextureSampler(VK_FILTER_NEAREST, VK_SAMPLER_ADDRESS_MODE_CLAMP_TO_EDGE, gBufferSampler)`. Its descriptor set holds
the uniform buffer (binding 0) and the G-buffer's three images at bindings 1, 2 and 3. All sets share one layout, so the
layout gets a binding 3 (`VkDescriptorSetLayoutBinding sampler3LayoutBinding = samplerLayoutBinding;
sampler3LayoutBinding.binding = 3;`) – the boxes' set leaves it empty, which is fine because their shaders don't read
it. The pool grows to two sets: 2 uniform buffers and 6 combined image samplers (each set takes what the layout has,
written or not), `maxSets = 2`. `createGBufferDescriptorSet(gPositionImageView, gNormalImageView, gAlbedoSpecImageView,
gBufferSampler, gBufferDescriptorSet)` writes the four descriptors – the images with `imageLayout =
VK_IMAGE_LAYOUT_SHADER_READ_ONLY_OPTIMAL`, the layout the render pass leaves them in.

In `recordCommandBuffer()`, the geometry pass comes first. It clears four attachments, so it needs four clear values:

```cpp
        // one clear value per attachment: the three colour images, and the depth 1.0 (the far plane)
        std::array<VkClearValue, 4> gBufferClearValues{};
        gBufferClearValues[0].color = {{0.0f, 0.0f, 0.0f, 1.0f}};
        gBufferClearValues[1].color = {{0.0f, 0.0f, 0.0f, 1.0f}};
        gBufferClearValues[2].color = {{0.0f, 0.0f, 0.0f, 1.0f}};
        gBufferClearValues[3].depthStencil = {1.0f, 0};
```

Inside it: the viewport, the scissor, the vertex buffer, `geometryPipeline`, `containerDescriptorSet` and the start's box
loop. After `vkCmdEndRenderPass` the G-buffer's colour images are in `VK_IMAGE_LAYOUT_SHADER_READ_ONLY_OPTIMAL`. Then the
window's render pass, with the screen quad instead of the boxes:

```cpp
        // the screen quad, lit with the G-buffer's data (the viewport, scissor and vertex buffer set above still apply)
        vkCmdBindPipeline(commandBuffer, VK_PIPELINE_BIND_POINT_GRAPHICS, lightingPipeline);
        vkCmdBindDescriptorSets(commandBuffer, VK_PIPELINE_BIND_POINT_GRAPHICS, pipelineLayout, 0, 1, &gBufferDescriptorSet, 0, nullptr);
        vkCmdDraw(commandBuffer, 6, 1, 36, 0); // renderQuad(): the screen quad's 6 vertices start at vertex 36
```

The viewport and scissor are dynamic state of the command buffer, so they stay set across render passes. In
`g_buffer.frag`, one output per colour attachment, and learnopengl's four assignments:

```glsl
// location n = colour attachment n of the G-buffer's subpass (learnopengl's glDrawBuffers)
layout(location = 0) out vec4 gPosition;
layout(location = 1) out vec4 gNormal;
layout(location = 2) out vec4 gAlbedoSpec;

void main() {
    // store the fragment position vector in the first gbuffer texture
    gPosition = vec4(fs_in.fragPos, 1.0);
    // also store the per-fragment normals into the gbuffer
    gNormal = vec4(normalize(fs_in.normal), 1.0);
    // and the diffuse per-fragment color
    gAlbedoSpec.rgb = texture(texture_diffuse1, fs_in.texCoord).rgb;
    // store specular intensity in gAlbedoSpec's alpha component
    gAlbedoSpec.a = texture(texture_specular1, fs_in.texCoord).r;
}
```

(with `texture_diffuse1` / `texture_specular1` at bindings 1 / 2 and the `VS_OUT` block of `g_buffer.vert`, which hands on
the world-space position, the normal and the texture coordinates). For now `deferred_shading.frag` declares only
`layout(binding = 3) uniform sampler2D gAlbedoSpec;` and shows the albedo: `vec3 Diffuse = texture(gAlbedoSpec,
fragTexCoord).rgb; outColor = vec4(Diffuse, 1.0);`. Now do the first task, **g-buffer**, and destroy the G-buffer's images,
views, memory and framebuffer, the sampler, both pipelines and the new render pass in `cleanup()`.
:::
:::d3d12
In Direct3D 12 the G-buffer is three textures with a render target view and a shader resource view each – like the bloom
chapter's colour buffers, but with different formats. They are created in a `for` loop over the formats, start in the
`PIXEL_SHADER_RESOURCE` state, and get their RTVs after the swap chain's buffers (slots `FrameCount` to `FrameCount + 2`;
the RTV heap needs `FrameCount + 3`) and their SRVs in slots 3 to 5 of the CBV/SRV heap (which needs 6):

```cpp
        // Positions and normals: a half-precision float per channel (GL_RGBA16F); colour and
        // specular intensity: 8 bits per channel (GL_RGBA).
        const DXGI_FORMAT gBufferFormats[3] = { DXGI_FORMAT_R16G16B16A16_FLOAT, DXGI_FORMAT_R16G16B16A16_FLOAT, DXGI_FORMAT_R8G8B8A8_UNORM };
```

```cpp
        for (UINT i = 0; i < 3; i++)
        {
            // A texture that can be a render target (ALLOW_RENDER_TARGET). It starts in the
            // PIXEL_SHADER_RESOURCE state: every frame turns it into a render target for the
            // geometry pass, and back for the lighting pass, which reads it.
            CD3DX12_RESOURCE_DESC textureDesc = CD3DX12_RESOURCE_DESC::Tex2D(gBufferFormats[i], m_width, m_height, 1, 1, 1, 0, D3D12_RESOURCE_FLAG_ALLOW_RENDER_TARGET);
            CD3DX12_CLEAR_VALUE clearValue(gBufferFormats[i], optimizedClearColor);
            ThrowIfFailed(m_device->CreateCommittedResource(
                &heapProperties,
                D3D12_HEAP_FLAG_NONE,
                &textureDesc,
                D3D12_RESOURCE_STATE_PIXEL_SHADER_RESOURCE,
                &clearValue,
                IID_PPV_ARGS(&m_gBuffer[i])));

            // A render target view, to draw into it: in the RTV heap after the swap chain's
            // buffers (slots FrameCount to FrameCount + 2).
            CD3DX12_CPU_DESCRIPTOR_HANDLE rtvHandle(m_rtvHeap->GetCPUDescriptorHandleForHeapStart(), FrameCount + i, m_rtvDescriptorSize);
            m_device->CreateRenderTargetView(m_gBuffer[i].Get(), nullptr, rtvHandle);
```

followed by the SRV (`srvDesc.Format = gBufferFormats[i]`, slot `3 + i`). The PSO must know the number and formats of
the render targets; the geometry pass compiles `g_buffer.hlsl` and writes three:

```cpp
        psoDesc.NumRenderTargets = 3;
        psoDesc.RTVFormats[0] = DXGI_FORMAT_R16G16B16A16_FLOAT;
        psoDesc.RTVFormats[1] = DXGI_FORMAT_R16G16B16A16_FLOAT;
        psoDesc.RTVFormats[2] = DXGI_FORMAT_R8G8B8A8_UNORM;
        psoDesc.DSVFormat = DXGI_FORMAT_D32_FLOAT;
```

The lighting pass gets its own PSO, `m_lightingPipelineState`, from the same description with the shaders of
`deferred_shading.hlsl`: the back buffer as the only render target, and no depth buffer – the screen quad covers every
pixel once:

```cpp
        psoDesc.NumRenderTargets = 1;
        psoDesc.RTVFormats[0] = DXGI_FORMAT_R8G8B8A8_UNORM;
        psoDesc.RTVFormats[1] = DXGI_FORMAT_UNKNOWN;
        psoDesc.RTVFormats[2] = DXGI_FORMAT_UNKNOWN;
        psoDesc.DepthStencilState.DepthEnable = FALSE;
        psoDesc.DSVFormat = DXGI_FORMAT_UNKNOWN;
        ThrowIfFailed(m_device->CreateGraphicsPipelineState(&psoDesc, IID_PPV_ARGS(&m_lightingPipelineState)));
```

The lighting pass reads three textures, t0, t1 and t2. Root parameter 2 is a table of two SRVs – the boxes' two maps.
The G-buffer's SRVs are in slots 3, 4 and 5, so table 2 can point at slot 3 for gPosition and gNormal, and a new table,
root parameter 3, holds gAlbedoSpec at t2:

```cpp
        CD3DX12_DESCRIPTOR_RANGE ranges[3];
        ranges[0].Init(D3D12_DESCRIPTOR_RANGE_TYPE_CBV, 1, 1);
        ranges[1].Init(D3D12_DESCRIPTOR_RANGE_TYPE_SRV, 2, 0);
        ranges[2].Init(D3D12_DESCRIPTOR_RANGE_TYPE_SRV, 1, 2);
```

```cpp
        rootParameters[3].InitAsDescriptorTable(1, &ranges[2], D3D12_SHADER_VISIBILITY_PIXEL);
```

(`CD3DX12_ROOT_PARAMETER rootParameters[4]`.) Why not simply make root parameter 2 a range of three SRVs? Then the boxes'
table, pointing at slot 1, would reach into slot 3 – gPosition, a render target while the boxes are drawn. That is legal
as long as no shader reads it, but confusing; two tables bind exactly what each pass reads. The G-buffer is read with a
second static sampler, s1: point filtering and clamping – learnopengl's `GL_NEAREST`, one texel per pixel:

```cpp
        samplers[1] = samplers[0];
        samplers[1].Filter = D3D12_FILTER_MIN_MAG_MIP_POINT;
        samplers[1].AddressU = D3D12_TEXTURE_ADDRESS_MODE_CLAMP;
        samplers[1].AddressV = D3D12_TEXTURE_ADDRESS_MODE_CLAMP;
        samplers[1].AddressW = D3D12_TEXTURE_ADDRESS_MODE_CLAMP;
        samplers[1].ShaderRegister = 1;
```

In `PopulateCommandList`, the geometry pass turns the three textures into render targets, binds all three with the depth
buffer and clears them:

```cpp
    CD3DX12_RESOURCE_BARRIER barriers[3] =
    {
        CD3DX12_RESOURCE_BARRIER::Transition(m_gBuffer[0].Get(), D3D12_RESOURCE_STATE_PIXEL_SHADER_RESOURCE, D3D12_RESOURCE_STATE_RENDER_TARGET),
        CD3DX12_RESOURCE_BARRIER::Transition(m_gBuffer[1].Get(), D3D12_RESOURCE_STATE_PIXEL_SHADER_RESOURCE, D3D12_RESOURCE_STATE_RENDER_TARGET),
        CD3DX12_RESOURCE_BARRIER::Transition(m_gBuffer[2].Get(), D3D12_RESOURCE_STATE_PIXEL_SHADER_RESOURCE, D3D12_RESOURCE_STATE_RENDER_TARGET)
    };
    m_commandList->ResourceBarrier(3, barriers);

    CD3DX12_CPU_DESCRIPTOR_HANDLE gBufferRtvHandles[3] =
    {
        CD3DX12_CPU_DESCRIPTOR_HANDLE(m_rtvHeap->GetCPUDescriptorHandleForHeapStart(), FrameCount, m_rtvDescriptorSize),
        CD3DX12_CPU_DESCRIPTOR_HANDLE(m_rtvHeap->GetCPUDescriptorHandleForHeapStart(), FrameCount + 1, m_rtvDescriptorSize),
        CD3DX12_CPU_DESCRIPTOR_HANDLE(m_rtvHeap->GetCPUDescriptorHandleForHeapStart(), FrameCount + 2, m_rtvDescriptorSize)
    };
    CD3DX12_CPU_DESCRIPTOR_HANDLE dsvHandle(m_dsvHeap->GetCPUDescriptorHandleForHeapStart());
    m_commandList->OMSetRenderTargets(3, gBufferRtvHandles, FALSE, &dsvHandle);
```

(then three `ClearRenderTargetView` calls and the depth clear), draws the boxes as before, and turns the textures back
into shader resources. The lighting pass draws into the back buffer **without** a DSV and points the two tables at the
G-buffer:

```cpp
    // The back buffer, without a depth buffer: the screen quad needs no depth test.
    CD3DX12_CPU_DESCRIPTOR_HANDLE rtvHandle(m_rtvHeap->GetCPUDescriptorHandleForHeapStart(), m_frameIndex, m_rtvDescriptorSize);
    m_commandList->OMSetRenderTargets(1, &rtvHandle, FALSE, nullptr);
    m_commandList->ClearRenderTargetView(rtvHandle, clearColor, 0, nullptr);

    // The lighting pass's pipeline state, gPosition and gNormal (heap slots 3 and 4) as root
    // parameter 2's table (t0, t1) and gAlbedoSpec (slot 5) as root parameter 3's (t2).
    m_commandList->SetPipelineState(m_lightingPipelineState.Get());
    CD3DX12_GPU_DESCRIPTOR_HANDLE gPositionNormal(m_cbvSrvHeap->GetGPUDescriptorHandleForHeapStart(), 3, m_cbvSrvDescriptorSize);
    m_commandList->SetGraphicsRootDescriptorTable(2, gPositionNormal);
    CD3DX12_GPU_DESCRIPTOR_HANDLE gAlbedoSpec(m_cbvSrvHeap->GetGPUDescriptorHandleForHeapStart(), 5, m_cbvSrvDescriptorSize);
    m_commandList->SetGraphicsRootDescriptorTable(3, gAlbedoSpec);
    m_commandList->DrawInstanced(6, 1, 36, 0);    // the screen quad: vertices 36 to 41
```

In `g_buffer.hlsl`, the pixel shader returns a struct with one member per render target (learnopengl's three `layout
(location = n) out` variables):

```hlsl
struct PSOutput
{
    float4 gPosition : SV_TARGET0;
    float4 gNormal : SV_TARGET1;
    float4 gAlbedoSpec : SV_TARGET2;
};
```

and its `PSMain` stores learnopengl's four values (its vertex shader hands on the world-space position, the normal and
the texture coordinates):

```hlsl
    PSOutput output;
    // store the fragment position vector in the first gbuffer texture
    output.gPosition = float4(input.fragPos, 1.0f);
    // also store the per-fragment normals into the gbuffer
    output.gNormal = float4(normalize(input.normal), 1.0f);
    // and the diffuse per-fragment color
    output.gAlbedoSpec.rgb = texture_diffuse1.Sample(wrapSampler, input.texCoord).rgb;
    // store specular intensity in gAlbedoSpec's alpha component
    output.gAlbedoSpec.a = texture_specular1.Sample(wrapSampler, input.texCoord).r;
    return output;
```

`deferred_shading.hlsl` declares the G-buffer at t0, t1, t2 with `SamplerState pointSampler : register(s1);` and, for
now, returns the albedo: `return float4(Diffuse, 1.0f);`. Now do the first task, **g-buffer**.
:::

:::opengl
```quiz
What would happen if you left out `glDrawBuffers(3, attachments)`?
- [ ] The framebuffer would be incomplete and nothing would be drawn
- [ ] OpenGL would write all three outputs into the first attachment, one after the other
- [ ] The three textures would be bound as texture units 0, 1 and 2
- [x] A framebuffer only draws into `GL_COLOR_ATTACHMENT0` by default: gPosition would be written, gNormal and gAlbedoSpec would stay at their cleared values
---
Output location n goes to the n-th entry of the draw buffers list. The attachments exist without it, but nothing is written into them.
```
:::
:::vulkan
```quiz
Why does the geometry pass need its own pipeline, created with `gBufferRenderPass` and 3 colour attachments, instead of reusing the forward pipeline?
- [ ] A pipeline can only be used with one vertex shader per frame
- [x] A pipeline is created for a render pass (and subpass): its colour blend state needs one entry per colour attachment of that subpass, and the formats must match – the window's pass has one attachment, the G-buffer's has three
- [ ] The geometry pass needs a different vertex buffer
- [ ] Pipelines without a depth test can't write to more than one attachment
---
The pipeline can be used with any render pass that is *compatible* with the one it was created with – same number and formats of attachments. The lighting pipeline is made for the window's pass, the geometry pipeline for the G-buffer's.
```
:::
:::d3d12
```quiz
Why does the lighting pass read gAlbedoSpec through a second table (root parameter 3) instead of a three-SRV range in root parameter 2?
- [ ] A descriptor table can hold at most two SRVs
- [ ] t2 can only be bound through its own root parameter
- [x] Root parameter 2 is also the boxes' table (slots 1 and 2): as a three-SRV range it would reach into slot 3, gPosition, while that texture is a render target – legal if no shader reads it, but two tables bind exactly what each pass reads
- [ ] The two tables are needed because the formats of the textures differ
---
A table points at consecutive descriptors in the heap. The G-buffer's SRVs are in slots 3, 4 and 5; table 2 points at slot 3 in the lighting pass, table 3 at slot 5.
```
:::

Press **Build & run**: the window shows the **albedo**, unlit. The boxes are there, but every face is equally bright – the
tops, the dark front faces, the sides – in the texture's plain colours: wood about (150, 98, 52), steel about (155, 157,
163) out of 255. The background stays black: the G-buffer was cleared to zero there. Nothing has been lit: that is the
lighting pass's job.

## The deferred lighting pass

With a large collection of fragment data in the G-buffer at our disposal we have the option to completely calculate the
scene's final lit colours. We do this by iterating over each of the G-buffer textures pixel by pixel and use their
content as input to the lighting algorithms. Because the G-buffer texture values all represent the final transformed
fragment values we only have to do the expensive lighting operations once per pixel. This is especially useful in
complex scenes where we'd easily invoke multiple expensive fragment shader calls per pixel in a forward rendering
setting.

For the lighting pass we're going to render a 2D screen-filled quad (a bit like a post-processing effect) and execute an
expensive lighting fragment shader on each pixel. The quad's texture coordinates cover the G-buffer exactly once, so
each pixel reads its own texel – which is why the G-buffer is sampled with nearest filtering: with linear filtering, a
pixel at the edge of a box would mix the position and normal of the box with the background's zeros, or with another box
far behind it, and light a surface that doesn't exist.

The lighting code is the forward shader's – learnopengl's – except that the inputs come from the G-buffer instead of the
vertex shader and the textures. The lights are the same 32 as before, and `viewPos` the camera position: both are
world space, like the G-buffer's positions and normals.

:::opengl
`deferred_shading.fs` reads the G-buffer:

```glsl
    // retrieve data from gbuffer
    vec3 FragPos = texture(gPosition, TexCoords).rgb;
    vec3 Normal = texture(gNormal, TexCoords).rgb;
    vec3 Diffuse = texture(gAlbedoSpec, TexCoords).rgb;
    float Specular = texture(gAlbedoSpec, TexCoords).a;
```

and then calculates the lighting as usual – learnopengl's code:

```glsl
    // then calculate lighting as usual
    vec3 lighting  = Diffuse * 0.1; // hard-coded ambient component
    vec3 viewDir  = normalize(viewPos - FragPos);
    for(int i = 0; i < NR_LIGHTS; ++i)
    {
        // diffuse
        vec3 lightDir = normalize(lights[i].Position - FragPos);
        vec3 diffuse = max(dot(Normal, lightDir), 0.0) * Diffuse * lights[i].Color;
        // specular
        vec3 halfwayDir = normalize(lightDir + viewDir);
        float spec = pow(max(dot(Normal, halfwayDir), 0.0), 16.0);
        vec3 specular = lights[i].Color * spec * Specular;
        // attenuation
        float distance = length(lights[i].Position - FragPos);
        float attenuation = 1.0 / (1.0 + lights[i].Linear * distance + lights[i].Quadratic * distance * distance);
        diffuse *= attenuation;
        specular *= attenuation;
        lighting += diffuse + specular;
    }
    FragColor = vec4(lighting, 1.0);
```

The uniforms are the forward shader's: `struct Light { vec3 Position; vec3 Color; float Linear; float Quadratic; };`,
`uniform Light lights[NR_LIGHTS];` and `uniform vec3 viewPos;`. In `main.cpp`, the TODO in the lighting pass sends them
to `shaderLightingPass`, the same loop the forward pass had:

```cpp
        // send light relevant uniforms
        for (unsigned int i = 0; i < lightPositions.size(); i++)
        {
            shaderLightingPass.setVec3("lights[" + std::to_string(i) + "].Position", lightPositions[i]);
            shaderLightingPass.setVec3("lights[" + std::to_string(i) + "].Color", lightColors[i]);
            // update attenuation parameters
            const float linear = 0.7f;
            const float quadratic = 1.8f;
            shaderLightingPass.setFloat("lights[" + std::to_string(i) + "].Linear", linear);
            shaderLightingPass.setFloat("lights[" + std::to_string(i) + "].Quadratic", quadratic);
        }
        shaderLightingPass.setVec3("viewPos", cameraPos);
```

Each member of each array element is a uniform of its own, found by its name. Now do the task **lighting-pass**.
:::
:::vulkan
The lights and `viewPos` are already in the uniform buffer – `updateUniformBuffer()` filled them for the forward pass –
and `gBufferDescriptorSet` has the buffer at binding 0. So `main.cpp` doesn't change: only `deferred_shading.frag`. It
declares the uniform block like `forward_shading.frag`, and the G-buffer's three images:

```glsl
const int NR_LIGHTS = 32;

// std140: a vec3 starts at a multiple of 16 bytes - a float after each vec3 fills the 4 bytes up to the next one
struct Light {
    vec3 position;
    float linear;
    vec3 color;
    float quadratic;
};

layout(binding = 0) uniform UniformBufferObject {
    mat4 view;
    mat4 proj;
    Light lights[NR_LIGHTS];
    vec3 viewPos;
} ubo;

// the G-buffer: bindings 1, 2 and 3 (learnopengl's gPosition, gNormal and gAlbedoSpec texture units)
layout(binding = 1) uniform sampler2D gPosition;
layout(binding = 2) uniform sampler2D gNormal;
layout(binding = 3) uniform sampler2D gAlbedoSpec;
```

Its `main` reads the G-buffer and lights the pixel – learnopengl's code with `ubo.`:

```glsl
void main() {
    // retrieve data from gbuffer
    vec3 FragPos = texture(gPosition, fragTexCoord).rgb;
    vec3 Normal = texture(gNormal, fragTexCoord).rgb;
    vec3 Diffuse = texture(gAlbedoSpec, fragTexCoord).rgb;
    float Specular = texture(gAlbedoSpec, fragTexCoord).a;

    // then calculate lighting as usual
    vec3 lighting  = Diffuse * 0.1; // hard-coded ambient component
    vec3 viewDir  = normalize(ubo.viewPos - FragPos);
    for (int i = 0; i < NR_LIGHTS; ++i) {
        // diffuse
        vec3 lightDir = normalize(ubo.lights[i].position - FragPos);
        vec3 diffuse = max(dot(Normal, lightDir), 0.0) * Diffuse * ubo.lights[i].color;
        // specular
        vec3 halfwayDir = normalize(lightDir + viewDir);
        float spec = pow(max(dot(Normal, halfwayDir), 0.0), 16.0);
        vec3 specular = ubo.lights[i].color * spec * Specular;
        // attenuation
        float distance = length(ubo.lights[i].position - FragPos);
        float attenuation = 1.0 / (1.0 + ubo.lights[i].linear * distance + ubo.lights[i].quadratic * distance * distance);
        diffuse *= attenuation;
        specular *= attenuation;
        lighting += diffuse + specular;
    }
    outColor = vec4(lighting, 1.0);
}
```

The array of structs has the same stride in C++ and GLSL – 32 bytes, a multiple of 16 as std140 requires for array
elements – so `ubo.lights[i]` is `lights[i]` of the C++ struct. Now do the task **lighting-pass**.
:::
:::d3d12
`main.cpp` already sends the lights – `OnUpdate` filled the constant buffer for the forward pass – so only
`deferred_shading.hlsl` changes. It declares the light and the constant buffer like `forward_shading.hlsl`:

```hlsl
// A point light: where it is, its colour and its attenuation (the constant term is 1.0).
struct Light
{
    float3 Position;
    float3 Color;

    float Linear;
    float Quadratic;
};
#define NR_LIGHTS 32

// The constant buffer at register b1 (the CBV in root parameter 1's table).
cbuffer SceneConstantBuffer : register(b1)
{
    float4x4 view;
    float4x4 projection;
    Light lights[NR_LIGHTS];
    float3 viewPos;
};
```

and `PSMain` reads the G-buffer with the point sampler and lights the pixel – learnopengl's code in HLSL:

```hlsl
    // retrieve data from gbuffer
    float3 FragPos = gPosition.Sample(pointSampler, input.texCoord).rgb;
    float3 Normal = gNormal.Sample(pointSampler, input.texCoord).rgb;
    float3 Diffuse = gAlbedoSpec.Sample(pointSampler, input.texCoord).rgb;
    float Specular = gAlbedoSpec.Sample(pointSampler, input.texCoord).a;

    // then calculate lighting as usual
    float3 lighting = Diffuse * 0.1f; // hard-coded ambient component
    float3 viewDir = normalize(viewPos - FragPos);
    for (int i = 0; i < NR_LIGHTS; ++i)
    {
        // diffuse
        float3 lightDir = normalize(lights[i].Position - FragPos);
        float3 diffuse = max(dot(Normal, lightDir), 0.0f) * Diffuse * lights[i].Color;
        // specular
        float3 halfwayDir = normalize(lightDir + viewDir);
        float spec = pow(max(dot(Normal, halfwayDir), 0.0f), 16.0f);
        float3 specular = lights[i].Color * spec * Specular;
        // attenuation
        float distance = length(lights[i].Position - FragPos);
        float attenuation = 1.0f / (1.0f + lights[i].Linear * distance + lights[i].Quadratic * distance * distance);
        diffuse *= attenuation;
        specular *= attenuation;
        lighting += diffuse + specular;
    }
    return float4(lighting, 1.0f);
```

`NR_LIGHTS` is a `#define`, learnopengl's `const int NR_LIGHTS = 32;`: the size of an array in a cbuffer must be known
when the shader is compiled. Now do the task
**lighting-pass**.
:::

```quiz
Why is the G-buffer read with nearest (point) filtering in the lighting pass?
- [ ] Linear filtering doesn't work with floating point textures
- [x] Each pixel must get exactly its own surface's position and normal: filtering would average a box's edge with the background or with a box far behind it – a position and normal of no real surface
- [ ] Nearest filtering is needed so the quad's texture coordinates are in pixels
- [ ] Linear filtering would gamma-correct the albedo twice
---
A colour can be blended between texels without much harm; a position halfway between a box and the wall behind it is a point in empty space, and it would be lit as if it were a surface.
```

Press **Build & run**: the picture is **the start picture again** – the lit boxes, warm where lights are near, dark
elsewhere; no pixel differs by more than 1 from the forward renderer. That's the point: the same lighting code with the
same inputs gives the same colours. What changed is the work: each pixel is now lit exactly once – 800 × 600 × 32 light
calculations per frame, however many boxes overlap.

## Combining deferred rendering with forward rendering

Say we want to render each of the light sources as a 3D cube positioned at the light source's position emitting the
colour of the light. A first idea that comes to mind is to simply forward render all the light sources on top of the
deferred lighting quad at the end of the deferred shading pipeline. So basically render the cubes as we'd normally do,
but only after we've finished the deferred rendering operations: a cube at each light, scale 0.125, in the light's
colour (`deferred_light_box`'s fragment shader writes nothing but the colour).

However, the rendered cubes don't take any of the stored geometry depth of the deferred renderer into account and are,
as a result, always rendered on top of the previously rendered objects – the lighting pass drew a flat quad, and the
window's depth buffer, if there is one, knows nothing about the boxes. What we need to do is first copy the depth
information stored in the geometry pass into the window's depth buffer, and only then render the light cubes. This way
the light cubes' fragments are only rendered when on top of the previously rendered geometry. How that is done is where
the three APIs differ most in this chapter.

:::opengl
We can copy the content of a framebuffer to the content of another framebuffer with the help of `glBlitFramebuffer`, a
function we also used in the anti-aliasing chapter to resolve multisampled framebuffers. The `glBlitFramebuffer` function
allows us to copy a user-defined region of a framebuffer to a user-defined region of another framebuffer. We bind the
G-buffer as the read framebuffer and the window's (0) as the draw framebuffer, and copy only the depth:

```cpp
        // 2.5. copy content of geometry's depth buffer to default framebuffer's depth buffer
        // ----------------------------------------------------------------------------------
        glBindFramebuffer(GL_READ_FRAMEBUFFER, gBuffer);
        glBindFramebuffer(GL_DRAW_FRAMEBUFFER, 0); // write to default framebuffer
        // blit to default framebuffer. Note that this may or may not work as the internal formats of both the FBO and default framebuffer have to match.
        // the internal formats are implementation defined. This works on all of my systems, but if it doesn't on yours you'll likely have to write to the
        // depth buffer in another shader stage (or somehow see to match the default framebuffer's internal format with the FBO's internal format).
        glBlitFramebuffer(0, 0, SCR_WIDTH, SCR_HEIGHT, 0, 0, SCR_WIDTH, SCR_HEIGHT, GL_DEPTH_BUFFER_BIT, GL_NEAREST);
        glBindFramebuffer(GL_FRAMEBUFFER, 0);
```

learnopengl's comment says what can go wrong: blitting depth requires the same depth format on both sides, and the
window's is chosen by the system. Here the G-buffer's `GL_DEPTH_COMPONENT` renderbuffer and GLFW's default 24-bit depth
buffer match. Without the copy, the window's depth buffer holds only the screen quad's flat depth (0.5 everywhere: NDC z
= 0), so the cubes would not be hidden behind the boxes correctly. The cubes themselves – learnopengl's
`// 3. render lights on top of scene` – use `Shader shaderLightBox("deferred_light_box.vs", "deferred_light_box.fs");`:

```cpp
        shaderLightBox.use();
        shaderLightBox.setMat4("projection", projection);
        shaderLightBox.setMat4("view", view);
        for (unsigned int i = 0; i < lightPositions.size(); i++)
        {
            model = glm::mat4(1.0f);
            model = glm::translate(model, lightPositions[i]);
            model = glm::scale(model, glm::vec3(0.125f));
            shaderLightBox.setMat4("model", model);
            shaderLightBox.setVec3("lightColor", lightColors[i]);
            renderCube();
        }
```

Now do the task **light-cubes**.
:::
:::vulkan
learnopengl copies the G-buffer's depth into the window's depth buffer with `glBlitFramebuffer`. Vulkan has
`vkCmdBlitImage`, but blitting a depth image needs the format features `VK_FORMAT_FEATURE_BLIT_SRC_BIT` /
`BLIT_DST_BIT` for the depth format, which not every device has; `vkCmdCopyImage` works, but needs two depth images and
barriers around the copy. There's a simpler way: a render pass can **load** what an earlier pass stored. So the window's
render pass uses the G-buffer's depth image as its own depth attachment – the window's depth image goes away
(`depthImage`, its memory and view, and `createDepthResources()`), and `createFramebuffers()` puts
`gBufferDepthImageView` next to each swap chain image view.

Three things make that work. The geometry pass keeps its depth: `depthAttachment.storeOp = VK_ATTACHMENT_STORE_OP_STORE`
in `createGBufferRenderPass()`. The window's render pass loads it instead of clearing it, starting from the layout the
geometry pass left it in:

```cpp
        // the depth attachment is the G-buffer's depth image: keep what the geometry pass wrote (load it, don't clear it)
        // - learnopengl copies it into the window's depth buffer with glBlitFramebuffer
        VkAttachmentDescription depthAttachment{};
        depthAttachment.format = findDepthFormat();
        depthAttachment.samples = VK_SAMPLE_COUNT_1_BIT;
        depthAttachment.loadOp = VK_ATTACHMENT_LOAD_OP_LOAD;
        depthAttachment.storeOp = VK_ATTACHMENT_STORE_OP_DONT_CARE;
        depthAttachment.stencilLoadOp = VK_ATTACHMENT_LOAD_OP_DONT_CARE;
        depthAttachment.stencilStoreOp = VK_ATTACHMENT_STORE_OP_DONT_CARE;
        depthAttachment.initialLayout = VK_IMAGE_LAYOUT_DEPTH_STENCIL_ATTACHMENT_OPTIMAL; // as the geometry pass left it
        depthAttachment.finalLayout = VK_IMAGE_LAYOUT_DEPTH_STENCIL_ATTACHMENT_OPTIMAL;
```

And its subpass dependency, which already waits for earlier depth writes (`srcStageMask` includes
`VK_PIPELINE_STAGE_LATE_FRAGMENT_TESTS_BIT`, `srcAccessMask` `VK_ACCESS_DEPTH_STENCIL_ATTACHMENT_WRITE_BIT`), now also
names the read that the load is: `dstAccessMask = VK_ACCESS_COLOR_ATTACHMENT_WRITE_BIT |
VK_ACCESS_DEPTH_STENCIL_ATTACHMENT_READ_BIT | VK_ACCESS_DEPTH_STENCIL_ATTACHMENT_WRITE_BIT`. The clear value for the
depth stays in the array but isn't used (a loaded attachment isn't cleared).

The screen quad is drawn in the same pass, before the cubes – it must neither be hidden by that depth nor overwrite it.
So `createPipeline` gets a `VkBool32 depthTestEnable` parameter for both depth settings:

```cpp
        depthStencil.depthTestEnable = depthTestEnable;
        depthStencil.depthWriteEnable = depthTestEnable;
```

`VK_TRUE` for the geometry pipeline, `VK_FALSE` for the lighting pipeline, and `VK_TRUE` for the new `lightBoxPipeline`
(`"shaders/deferred_light_box.vert.spv"`, `"shaders/deferred_light_box.frag.spv"`, `renderPass`, 1). The cube's colour
reaches the fragment shader as a push constant after the model matrix – push constants are laid out like std430, so the
`vec3` starts right after the `mat4`:

```cpp
struct PushConstants {
    glm::mat4 model;
    glm::vec3 lightColor;
};
```

The push constant range – and every `vkCmdPushConstants`, the boxes' too – now names both stages,
`VK_SHADER_STAGE_VERTEX_BIT | VK_SHADER_STAGE_FRAGMENT_BIT`. In `recordCommandBuffer()`, after the quad, still in the
window's pass:

```cpp
        // 3. render lights on top of scene: the pass's depth is the G-buffer's, so the boxes hide the light cubes behind them
        vkCmdBindPipeline(commandBuffer, VK_PIPELINE_BIND_POINT_GRAPHICS, lightBoxPipeline);
        for (unsigned int i = 0; i < lightPositions.size(); i++) {
            glm::mat4 model = glm::mat4(1.0f);
            model = glm::translate(model, lightPositions[i]);
            model = glm::scale(model, glm::vec3(0.125f));
            constants.model = model;
            constants.lightColor = lightColors[i];
            vkCmdPushConstants(commandBuffer, pipelineLayout, VK_SHADER_STAGE_VERTEX_BIT | VK_SHADER_STAGE_FRAGMENT_BIT, 0, sizeof(PushConstants), &constants);
            vkCmdDraw(commandBuffer, 36, 1, 0, 0); // renderCube()
        }
```

`gBufferDescriptorSet` is still bound, and its binding 0 is the uniform buffer with the view and projection matrices that
`deferred_light_box.vert` reads. `deferred_light_box.frag` declares the push constant block `{ mat4 model; vec3
lightColor; } pc` and writes `outColor = vec4(pc.lightColor, 1.0);`. Now do the task **light-cubes**, and destroy the new
pipeline in `cleanup()`.
:::
:::d3d12
learnopengl copies the G-buffer's depth into the window's depth buffer here. **Direct3D 12 needs no copy**: a depth
buffer belongs to no framebuffer. It is a resource with a depth-stencil view, bound with whatever render targets the
next `OMSetRenderTargets` names. The geometry pass's `m_depthStencil` still holds the boxes' depths after the lighting
pass – the lighting quad was drawn without a DSV – so the light cubes are drawn into the back buffer with that same DSV:

```cpp
    // 2.5. learnopengl copies the geometry pass's depth into the window's depth buffer here
    // (glBlitFramebuffer). In Direct3D 12 a depth buffer belongs to no framebuffer: the
    // geometry pass's depth buffer is still filled with the scene's depths, so it is bound
    // together with the back buffer - nothing to copy.
    m_commandList->OMSetRenderTargets(1, &rtvHandle, FALSE, &dsvHandle);

    // 3. render lights on top of scene: a small cube per light, in its colour (root
    // constants), with the light cubes' pipeline state - hidden where a box is in front.
    m_commandList->SetPipelineState(m_lightBoxPipelineState.Get());
    for (unsigned int i = 0; i < lightPositions.size(); i++)
    {
        XMMATRIX model = XMMatrixScaling(0.125f, 0.125f, 0.125f) * XMMatrixTranslation(lightPositions[i].x, lightPositions[i].y, lightPositions[i].z);
        XMStoreFloat4x4(&modelConstants.model, XMMatrixTranspose(model));
        modelConstants.lightColor = lightColors[i];
        m_commandList->SetGraphicsRoot32BitConstants(0, sizeof(ModelConstants) / 4, &modelConstants, 0);
        m_commandList->DrawInstanced(36, 1, 0, 0);
    }
```

A copy (`CopyResource` into a second depth buffer) would only be needed if the window pass had a depth buffer of its own
with other contents. `ModelConstants` already has the `lightColor` (35 root constants: two matrices and a `float3`), and
`deferred_light_box.hlsl` is complete: its `VSMain` transforms the cube, its `PSMain` returns `float4(lightColor, 1.0f)`.
The PSO, `m_lightBoxPipelineState`, is made from the lighting pass's description – the back buffer's format – with the
depth test back on:

```cpp
        psoDesc.VS = CD3DX12_SHADER_BYTECODE(lightBoxVertexShader.Get());
        psoDesc.PS = CD3DX12_SHADER_BYTECODE(lightBoxPixelShader.Get());
        psoDesc.DepthStencilState.DepthEnable = TRUE;
        psoDesc.DSVFormat = DXGI_FORMAT_D32_FLOAT;
        ThrowIfFailed(m_device->CreateGraphicsPipelineState(&psoDesc, IID_PPV_ARGS(&m_lightBoxPipelineState)));
```

(with the shaders compiled from `deferred_light_box.hlsl`, `VSMain` and `PSMain`). The default depth function is
`D3D12_COMPARISON_FUNC_LESS`, as for the boxes. Now do the task **light-cubes**.
:::

:::opengl
```quiz
Why must the G-buffer's depth be copied into the window's depth buffer before the light cubes are drawn?
- [x] The window's depth buffer holds only the screen quad's flat depth: without the boxes' depths the cubes behind a box would be drawn over it
- [ ] `glBlitFramebuffer` also copies the lighting into the window
- [ ] The light cubes are drawn into the G-buffer and need its depth there
- [ ] Without it, the depth test would discard the screen quad
---
The blit copies only `GL_DEPTH_BUFFER_BIT`, and only works if both depth buffers have the same format – learnopengl's comment in the code warns about that.
```
:::
:::vulkan
```quiz
The window's render pass uses the G-buffer's depth image with `loadOp = VK_ATTACHMENT_LOAD_OP_LOAD`. Why is the lighting pipeline created with `depthTestEnable = VK_FALSE`?
- [ ] A pipeline with a depth test can't read from sampled images
- [ ] Loading a depth attachment disables the depth test anyway
- [x] The quad is drawn into the same pass first: with the test on it would be hidden wherever a box is nearer than the quad's depth, and with depth writes it would overwrite the boxes' depths that the light cubes need
- [ ] The lighting pipeline has no depth attachment in its render pass
---
The lighting pass must touch every pixel and leave the depth alone; only the light cubes are tested against it. That's why `createPipeline` takes the flag for both `depthTestEnable` and `depthWriteEnable`.
```
:::
:::d3d12
```quiz
Why does Direct3D 12 need no equivalent of learnopengl's `glBlitFramebuffer` for the light cubes?
- [ ] The swap chain's back buffer has a depth buffer built in that the geometry pass fills
- [ ] The light cubes' PSO reads the G-buffer's positions instead of a depth buffer
- [ ] `OMSetRenderTargets` copies the depth when the render target changes
- [x] A depth buffer is not part of a framebuffer: the geometry pass's `m_depthStencil` still holds the boxes' depths, so it is simply bound together with the back buffer for the cubes
---
The lighting quad was drawn without a DSV (`nullptr`) and its PSO has `DepthEnable = FALSE`, so nothing touched the depth buffer between the geometry pass and the cubes.
```
:::

Press **Build & run**: **32 small pastel cubes** appear between, above and below the boxes, about 12 to 28 pixels
wide – grey, orange, pink, mint, cyan, purple. A few are hidden behind boxes, for example under the left middle box;
others float over the black background around the grid. Everything else is unchanged.

These cubes don't have any lighting of their own: they show the light's colour. Any object that needs another shader –
a transparent object, a special material – can be forward rendered this way after the lighting pass, depth-tested
against the G-buffer's depth. That's how deferred renderers combine the two techniques.

## A larger number of lights

What deferred rendering is often praised for is its ability to render an enormous amount of light sources without a
heavy cost on performance. Deferred rendering by itself doesn't allow for a very large amount of light sources, as we'd
still have to calculate each fragment's lighting component for each of the scene's light sources. What makes a large
amount of light sources possible is a very neat optimization we can apply to the deferred rendering pipeline: that of
*light volumes*.

Normally when we render a fragment in a large lit scene we'd calculate the contribution of each light source in a
scene, regardless of their distance to the fragment. A large portion of these light sources will never reach the
fragment, so why waste all these lighting computations?

The idea behind light volumes is to calculate the radius, or volume, of a light source i.e. the area where its light is
able to reach fragments. As most light sources use some form of attenuation, we can use that to calculate the maximum
distance or radius their light is able to reach. We then only do the expensive lighting calculations if a fragment is
inside one or more of these light volumes.

### Calculating a light's volume or radius

To obtain a light's volume radius we have to solve the attenuation equation for when its light contribution becomes
0.0. For the attenuation function we'll use the function introduced in the Light casters chapter:

```text
attenuation = 1.0 / (Kc + Kl * d + Kq * d²)
```

What we want to do is solve this equation for when the attenuation is 0.0. Unfortunately this equation will never
exactly reach 0.0, so there won't be a solution. What we can do however is not solve the equation for 0.0, but solve it
for a brightness value that is close to 0.0 but still perceived as dark. learnopengl chooses 5/256: with 8 bits per
channel, a contribution below 5 of 256 levels is hardly visible. The light's brightest colour channel, *Imax*, times the
attenuation must reach 5/256:

```text
5/256 = Imax / (Kc + Kl * d + Kq * d²)
Kq * d² + Kl * d + Kc - Imax * 256/5 = 0
```

A quadratic equation in *d*, which we solve with the quadratic formula (taking the positive root):

```text
d = (-Kl + sqrt(Kl² - 4 * Kq * (Kc - Imax * 256/5))) / (2 * Kq)
```

With Kc = 1, Kl = 0.7 and Kq = 1.8, a light whose brightest channel is 0.5 reaches about 3.5 units, a light with a
channel of 1.0 about 5.1. Every light's radius is computed once per light on the CPU and sent with it; the shader skips
the light wherever the fragment is farther away:

```text
for(int i = 0; i < NR_LIGHTS; ++i)
{
    // calculate distance between light source and current fragment
    float distance = length(lights[i].Position - FragPos);
    if(distance < lights[i].Radius)
    {
        // do expensive lighting
        [...]
    }
}
```

:::opengl
In `main.cpp`'s light loop, learnopengl's code – the constant term is not sent, the shader assumes 1.0:

```cpp
            // update attenuation parameters and calculate radius
            const float constant = 1.0f; // note that we don't send this to the shader, we assume it is always 1.0 (in our case)
            const float linear = 0.7f;
            const float quadratic = 1.8f;
            shaderLightingPass.setFloat("lights[" + std::to_string(i) + "].Linear", linear);
            shaderLightingPass.setFloat("lights[" + std::to_string(i) + "].Quadratic", quadratic);
            // then calculate radius of light volume/sphere
            const float maxBrightness = std::fmaxf(std::fmaxf(lightColors[i].r, lightColors[i].g), lightColors[i].b);
            float radius = (-linear + std::sqrt(linear * linear - 4 * quadratic * (constant - (256.0f / 5.0f) * maxBrightness))) / (2.0f * quadratic);
            shaderLightingPass.setFloat("lights[" + std::to_string(i) + "].Radius", radius);
```

`deferred_shading.fs` gets `float Radius;` in `struct Light`, and the loop computes the distance first and wraps the rest
in the test:

```glsl
    for(int i = 0; i < NR_LIGHTS; ++i)
    {
        // calculate distance between light source and current fragment
        float distance = length(lights[i].Position - FragPos);
        if(distance < lights[i].Radius)
        {
            // diffuse
            vec3 lightDir = normalize(lights[i].Position - FragPos);
            vec3 diffuse = max(dot(Normal, lightDir), 0.0) * Diffuse * lights[i].Color;
            // specular
            vec3 halfwayDir = normalize(lightDir + viewDir);
            float spec = pow(max(dot(Normal, halfwayDir), 0.0), 16.0);
            vec3 specular = lights[i].Color * spec * Specular;
            // attenuation
            float attenuation = 1.0 / (1.0 + lights[i].Linear * distance + lights[i].Quadratic * distance * distance);
            diffuse *= attenuation;
            specular *= attenuation;
            lighting += diffuse + specular;
        }
    }
```

Now do the last task, **light-volumes**.
:::
:::vulkan
The radius goes into the uniform buffer with each light. In the shader, `float radius;` follows `quadratic` – the struct
is then 36 bytes, and **std140 rounds the size of a struct used as an array element up to a multiple of 16 bytes**: 48.
The C++ struct must have the same stride, so it gets three floats of padding:

```cpp
struct Light {
    glm::vec3 position;
    float linear;
    glm::vec3 color;
    float quadratic;
    float radius; // the light volume's radius: farther away the light adds (almost) nothing
    float pad1;   // std140 rounds the size of a struct up to a multiple of 16 bytes: 48
    float pad2;
    float pad3;
};
```

In `updateUniformBuffer()`'s light loop, learnopengl's code – the constant term is not sent, the shader assumes 1.0:

```cpp
            // update attenuation parameters and calculate radius
            const float constant = 1.0f; // note that we don't send this to the shader, we assume it is always 1.0 (in our case)
            const float linear = 0.7f;
            const float quadratic = 1.8f;
            ubo.lights[i].linear = linear;
            ubo.lights[i].quadratic = quadratic;
            // then calculate radius of light volume/sphere
            const float maxBrightness = std::fmaxf(std::fmaxf(lightColors[i].r, lightColors[i].g), lightColors[i].b);
            float radius = (-linear + std::sqrt(linear * linear - 4 * quadratic * (constant - (256.0f / 5.0f) * maxBrightness))) / (2.0f * quadratic);
            ubo.lights[i].radius = radius;
```

`deferred_shading.frag` gets `float radius;` in `struct Light`, and the loop computes the distance first and wraps the
rest in the test:

```glsl
    for (int i = 0; i < NR_LIGHTS; ++i) {
        // calculate distance between light source and current fragment
        float distance = length(ubo.lights[i].position - FragPos);
        if (distance < ubo.lights[i].radius) {
            // diffuse
            vec3 lightDir = normalize(ubo.lights[i].position - FragPos);
            vec3 diffuse = max(dot(Normal, lightDir), 0.0) * Diffuse * ubo.lights[i].color;
            // specular
            vec3 halfwayDir = normalize(lightDir + viewDir);
            float spec = pow(max(dot(Normal, halfwayDir), 0.0), 16.0);
            vec3 specular = ubo.lights[i].color * spec * Specular;
            // attenuation
            float attenuation = 1.0 / (1.0 + ubo.lights[i].linear * distance + ubo.lights[i].quadratic * distance * distance);
            diffuse *= attenuation;
            specular *= attenuation;
            lighting += diffuse + specular;
        }
    }
```

Now do the last task, **light-volumes**.
:::
:::d3d12
The radius goes into the constant buffer with each light. In HLSL, `float Radius;` after `Quadratic` lands at offset
36, still in the third 16-byte row – so the light stays 48 bytes, and the C++ struct trades one float of padding for it:

```cpp
    struct Light
    {
        XMFLOAT3 Position;
        float padding0;
        XMFLOAT3 Color;
        float Linear;
        float Quadratic;
        float Radius;
        float padding1[2];
    };
```

In `OnUpdate`'s light loop, learnopengl's code – the constant term is not sent, the shader assumes 1.0:

```cpp
        // update attenuation parameters and calculate radius
        const float constant = 1.0f; // note that we don't send this to the shader, we assume it is always 1.0 (in our case)
        const float linear = 0.7f;
        const float quadratic = 1.8f;
        constantBufferData.lights[i].Linear = linear;
        constantBufferData.lights[i].Quadratic = quadratic;
        // then calculate radius of light volume/sphere: the distance at which the light's
        // brightest channel has faded to 5/256 - too dark to see in an 8-bit colour
        const float maxBrightness = std::fmax(std::fmax(lightColors[i].x, lightColors[i].y), lightColors[i].z);
        float radius = (-linear + std::sqrt(linear * linear - 4 * quadratic * (constant - (256.0f / 5.0f) * maxBrightness))) / (2.0f * quadratic);
        constantBufferData.lights[i].Radius = radius;
```

(learnopengl writes `std::fmaxf`, which not every standard library declares in `std`; `std::fmax` has a `float`
overload. An `XMFLOAT3`'s channels are `x`, `y`, `z`.) `deferred_shading.hlsl` gets `float Radius;` in `struct Light`, and
the loop computes the distance first and wraps the rest in the test:

```hlsl
    for (int i = 0; i < NR_LIGHTS; ++i)
    {
        // calculate distance between light source and current fragment
        float distance = length(lights[i].Position - FragPos);
        if (distance < lights[i].Radius)
        {
            // diffuse
            float3 lightDir = normalize(lights[i].Position - FragPos);
            float3 diffuse = max(dot(Normal, lightDir), 0.0f) * Diffuse * lights[i].Color;
            // specular
            float3 halfwayDir = normalize(lightDir + viewDir);
            float spec = pow(max(dot(Normal, halfwayDir), 0.0f), 16.0f);
            float3 specular = lights[i].Color * spec * Specular;
            // attenuation
            float attenuation = 1.0f / (1.0f + lights[i].Linear * distance + lights[i].Quadratic * distance * distance);
            diffuse *= attenuation;
            specular *= attenuation;
            lighting += diffuse + specular;
        }
    }
```

Now do the last task, **light-volumes**.
:::

Press **Build & run**: the picture is **almost the same – a little darker in places**. The light cubes, the tops of the
front boxes and the dark front faces are unchanged; but the steel frames of the far row lose about a fifth of their
brightness (the far middle box's frame drops from about 149 to 117), and the inner sides of the front corner boxes get
darker too. About 28,000 pixels darken by more than 5 levels, none gets brighter.

Why, if a skipped light contributes "nothing visible"? The radius is where *one* light's brightest channel falls to 5/256
– each light skipped there would have added at most a few levels. But the scene has 32 lights, a few units apart, and
from a given point many of them are just outside their radius. Their small contributions add up: where a dozen lights
each lose 2 or 3 levels, the sum is 30. learnopengl's text assumes few overlapping lights; with 32 lights packed this
densely the cut-off shows. A threshold smaller than 5/256 would push the radii out and hide the difference, at the cost
of fewer skipped lights.

### How we really use light volumes

The fragment shader shown above doesn't really work in practice and only illustrates how we can sort of use a light's
volume to reduce lighting calculations. The reality is that your GPU and its shading language are pretty bad at
optimizing loops and branches. The reason for this is that shader execution on the GPU is highly parallel and most
architectures require that a large collection of threads – the pixels of a group, 32 or 64 of them – run the exact same
shader code in lockstep. When the threads of a group take different sides of an `if`, the group runs both sides, with
the threads that didn't take a side masked off. So wherever one pixel of a group is inside a light's radius, the whole
group pays for that light; the radius check above saves little or nothing, and we still calculate lighting for (nearly)
all light sources.

The appropriate approach to using light volumes is to render actual spheres, scaled by the light volume radius. The
centres of these spheres are positioned at the light source's position, and as it is scaled by the light volume radius
the sphere exactly encompasses the light's visible volume. This is where the trick comes in: we use the deferred lighting
shader for rendering the spheres. As a rendered sphere produces fragment shader invocations that exactly match the
pixels the light source affects, we only render the relevant pixels and skip all other pixels. Each light's sphere is
drawn with additive blending, so the lights' contributions sum up in the window. This now gives a time complexity of
*objects + lights × covered pixels*, instead of *pixels × lights*.

There are still issues with this approach: face culling should be enabled (otherwise we'd render a light's effect twice,
for the front and the back of the sphere) and when it is enabled the camera may enter a light volume, after which the
volume isn't rendered anymore (due to back-face culling), removing the light source's influence. We can solve that by
only rendering the spheres' back faces – culling the front faces. Rendering light volumes does take its toll on
performance, and while it is generally much faster than normal deferred shading for rendering a large number of lights,
there's still more we can optimize.

Two other popular (and more efficient) extensions on top of deferred shading exist called *deferred lighting* (or light
pre-pass) and *tile-based deferred shading*. Modern renderers go further still with *clustered* shading: the screen is
divided into tiles (and, for clustered shading, depth slices), a compute pass finds the lights that touch each tile or
cluster, and the lighting then loops only over that short list – a loop that is the same for all pixels of a tile, so
the lockstep problem disappears. These techniques are beyond this chapter, but the G-buffer and lighting pass you built
are their foundation.

```quiz
Why does the `if (distance < radius)` in the lighting shader save little on a GPU, and what do real renderers do instead?
- [ ] The `if` is removed by the shader compiler, so the radius has no effect
- [ ] The test itself costs as much as the lighting it skips
- [ ] It saves nothing because every pixel is inside every light's radius
- [x] The pixels of a group run in lockstep: if one of them needs a light, the whole group runs its code – so renderers draw each light's volume (a sphere of that radius) or build per-tile light lists, and light only the pixels a light can reach
---
The picture got a little darker because 32 skipped contributions just below 5/256 add up – the speed-up a GPU gets from the `if` is the smaller effect.
```

## Deferred rendering vs forward rendering

By itself (without light volumes), deferred shading is a nice optimization as each pixel only runs a single fragment
shader, compared to forward rendering where we'd often run the fragment shader multiple times per pixel. Deferred
rendering does come with a few disadvantages though: a large memory overhead – here 8 + 8 + 4 bytes per pixel for the
G-buffer plus its depth, read again in the lighting pass –, no MSAA, and blending still has to be done with forward
rendering.

- **Blending and transparency.** The G-buffer holds one surface per pixel, the nearest. A window or a glass in front of a
  box would need both surfaces' data: a transparent object can't be stored in it. Deferred renderers draw transparent
  objects afterwards with forward rendering, sorted back to front and depth-tested against the G-buffer's depth – the
  light cubes' technique.
- **MSAA.** Multisampling resolves the samples of a pixel into one colour at the end; a G-buffer of positions and normals
  can't be resolved that way (an averaged normal is no normal), and multisampled G-buffers multiply the memory. Deferred
  renderers usually anti-alias the final picture with a post-processing filter (FXAA, TAA and the like) instead.
- **One lighting model.** Every pixel is lit by the same lighting pass. Objects that need a different lighting algorithm
  need more data in the G-buffer (a material ID, say) or a forward pass of their own.

When you have a small scene and not too many lights, deferred rendering is not necessarily faster and sometimes even
slower, as the overhead then outweighs the benefits of deferred rendering. In more complex scenes, deferred rendering
quickly becomes a significant optimization; especially with the more advanced optimization extensions. And with that,
the G-buffer is in place for the last chapter of this part: SSAO, which reads positions and normals from a G-buffer just
like this one.

## Additional resources

:::opengl
- [Deferred Shading](https://learnopengl.com/Advanced-Lighting/Deferred-Shading): learnopengl's chapter this chapter
  follows, with the backpack scene and pictures of the G-buffer.
- [deferred_shading.cpp](https://github.com/JoeyDeVries/LearnOpenGL/blob/master/src/5.advanced_lighting/8.1.deferred_shading/deferred_shading.cpp):
  learnopengl's program.
- [glBlitFramebuffer](https://registry.khronos.org/OpenGL-Refpages/gl4/html/glBlitFramebuffer.xhtml): copying a region
  of one framebuffer's buffers into another's.
:::
:::vulkan
- [Deferred Shading](https://learnopengl.com/Advanced-Lighting/Deferred-Shading): learnopengl's chapter this chapter
  follows, with the backpack scene and pictures of the G-buffer.
- [Render Pass](https://docs.vulkan.org/spec/latest/chapters/renderpass.html): the specification's chapter on
  attachments, load and store operations, and subpass dependencies.
- [Shader memory layout](https://docs.vulkan.org/guide/latest/shader_memory_layout.html): the Vulkan Guide on std140
  and std430 – why the light struct is padded to 48 bytes.
:::
:::d3d12
- [Deferred Shading](https://learnopengl.com/Advanced-Lighting/Deferred-Shading): learnopengl's chapter this chapter
  follows, with the backpack scene and pictures of the G-buffer.
- [ID3D12GraphicsCommandList::OMSetRenderTargets](https://learn.microsoft.com/en-us/windows/win32/api/d3d12/nf-d3d12-id3d12graphicscommandlist-omsetrendertargets):
  binding several render targets and a depth-stencil view.
- [Packing rules for constant variables](https://learn.microsoft.com/en-us/windows/win32/direct3dhlsl/dx-graphics-hlsl-packing-rules):
  how HLSL lays out the `Light` array in the constant buffer.
:::
