# Postprocessing

Wouldn't it be fun if we could completely spice up the visuals of the game with just a few postprocessing effects? We
could create a blurry shake effect, inverse all the colors of the scene, do crazy vertex movement, and/or make use of
other interesting effects with relative ease – thanks to rendering into a texture first. This chapter makes extensive
use of concepts from the Framebuffers and Anti Aliasing chapters.

In the Framebuffers chapter we demonstrated how we could use postprocessing to achieve interesting effects using just a
single texture. In Hedgerow we're going to do something similar: we render the whole game into a **multisampled**
colour buffer, resolve it into an ordinary texture – each pixel the average of its samples, so the edges are
anti-aliased – and then draw that texture onto a quad that covers the whole window, with zero or more postprocessing
effects applied by the quad's shader. The steps, in learnopengl's words, are:

:::opengl
1. Bind to the multisampled framebuffer.
2. Render the game as normal.
3. Blit the multisampled framebuffer to a normal framebuffer with a texture attachment.
4. Unbind the framebuffer (use the default framebuffer).
5. Use the colour buffer texture from the normal framebuffer in the postprocessing shader.
6. Render a quad of screen size as the output of the postprocessing shader.
:::
:::vulkan
1. Begin an off-screen render pass whose colour attachment has 4 samples per pixel.
2. Render the game as normal – its pipelines are made for that render pass.
3. End the render pass: its **resolve attachment**, a single-sample image, receives the average of each pixel's samples
   (learnopengl's blit).
4. Begin the window's render pass (learnopengl's default framebuffer).
5. Use the resolved image in the postprocessing shader.
6. Render a quad of screen size as the output of the postprocessing shader.
:::
:::d3d12
1. Set a render target with 4 samples per pixel.
2. Render the game as normal – its pipeline states are made for 4 samples.
3. Resolve the multisampled target into a single-sample texture with `ResolveSubresource` (learnopengl's blit), between
   two pairs of barriers.
4. Set the back buffer as the render target again (learnopengl's default framebuffer).
5. Use the resolved texture in the postprocessing shader.
6. Render a quad of screen size as the output of the postprocessing shader.
:::

The effects are learnopengl's three:

- **Shake**: slightly shake the scene with a small blur.
- **Confuse**: inverse the colours of the scene, but also the x and y axis.
- **Chaos**: make use of an edge detection kernel to create interesting visuals and also move the textured image in a
  circular fashion for an interesting chaotic effect.

The project is `particles`' solution with new `// TODO:` sections and a new shader.
:::opengl
The new shader is `post_processing.vs` / `post_processing.fs`; its start bodies only pass the quad and the texture
through.
:::
:::vulkan
The new shader is `shaders/post_processing.vert` / `shaders/post_processing.frag` (built to `.spv` like the others);
its start bodies only pass the quad and the texture through.
:::
:::d3d12
The new shader is `post_processing.hlsl` with `VSMain` and `PSMain`; its start bodies only pass the quad and the
texture through.
:::
The chapter's expected results show the game at **1.45 seconds** (frame 87). That moment is chosen on purpose: the ball
hits the solid stone in frame 86 (see `collision-resolution`), and at the end of the chapter that hit will shake the
screen.

## The postprocessing shader

Below is the vertex shader:

:::opengl
```glsl
#version 330 core
layout (location = 0) in vec4 vertex; // <vec2 position, vec2 texCoords>

out vec2 TexCoords;

uniform bool chaos;
uniform bool confuse;
uniform bool shake;
uniform float time;

void main()
{
    gl_Position = vec4(vertex.xy, 0.0, 1.0);
    vec2 texture = vertex.zw;
    if (chaos)
    {
        float strength = 0.3;
        vec2 pos = vec2(texture.x + sin(time) * strength, texture.y + cos(time) * strength);
        TexCoords = pos;
    }
    else if (confuse)
    {
        TexCoords = vec2(1.0 - texture.x, 1.0 - texture.y);
    }
    else
    {
        TexCoords = texture;
    }
    if (shake)
    {
        float strength = 0.01;
        gl_Position.x += cos(time * 10.0) * strength;
        gl_Position.y += cos(time * 15.0) * strength;
    }
}
```
:::
:::vulkan
```glsl
#version 450

layout(push_constant) uniform PostProcessingConstants {
    float time;
    int   chaos;
    int   confuse;
    int   shake;
} pc;

layout(location = 0) in vec4 vertex; // <vec2 position, vec2 texCoords>

layout(location = 0) out vec2 TexCoords;

void main() {
    gl_Position = vec4(vertex.xy, 0.0, 1.0);
    vec2 texture = vertex.zw;
    if (pc.chaos != 0) {
        float strength = 0.3;
        // Vulkan's texture v points down (OpenGL's up): minus here, so the picture moves as in OpenGL
        vec2 pos = vec2(texture.x + sin(pc.time) * strength, texture.y - cos(pc.time) * strength);
        TexCoords = pos;
    } else if (pc.confuse != 0) {
        TexCoords = vec2(1.0 - texture.x, 1.0 - texture.y);
    } else {
        TexCoords = texture;
    }
    if (pc.shake != 0) {
        float strength = 0.01;
        gl_Position.x += cos(pc.time * 10.0) * strength;
        gl_Position.y -= cos(pc.time * 15.0) * strength; // Vulkan's clip space y points down: minus moves up, as OpenGL's +
    }
}
```
:::
:::d3d12
```hlsl
PSInput VSMain(float2 position : POSITION, float2 texCoord : TEXCOORD)
{
    PSInput result;

    result.position = float4(position, 0.0f, 1.0f);
    if (chaos)
    {
        float strength = 0.3f;
        // v points down in Direct3D: minus moves the picture the way learnopengl's plus does
        float2 pos = float2(texCoord.x + sin(time) * strength, texCoord.y - cos(time) * strength);
        result.texCoord = pos;
    }
    else if (confuse)
    {
        result.texCoord = float2(1.0f - texCoord.x, 1.0f - texCoord.y);
    }
    else
    {
        result.texCoord = texCoord;
    }
    if (shake)
    {
        float strength = 0.01f;
        result.position.x += cos(time * 10.0f) * strength;
        result.position.y += cos(time * 15.0f) * strength;
    }

    return result;
}
```
:::

Based on whatever setting is enabled, the vertex shader takes different paths. If either chaos or confuse is set to
true, the vertex shader will manipulate the texture coordinates to move the scene around: either translate the texture
coordinates in a circle-like fashion – (sin(time), cos(time)) scaled by 0.3 –, or inverse them (`1.0 - texture`: the
picture upside down and mirrored). Because the texture's wrapping method repeats, the chaos effect will cause the scene
to repeat itself at various parts of the quad. Additionally, if shake is set to true, it will move the vertex positions
around by a small amount – at most 0.01 in normalized device coordinates, 4 pixels horizontally and 3 vertically –, as if the screen
shakes. Note that chaos and confuse shouldn't be true at the same time, while shake is able to work with any of the
other effects on.

:::vulkan
Two lines differ from learnopengl's, and both for the same reason: in Vulkan, clip space y and texture v point
*down*, in OpenGL up. The quad keeps learnopengl's vertices – (−1, −1) with texture coordinate (0, 0) – and in Vulkan
that is the top-left corner of the window *and* of the texture, so the picture is upright, as in OpenGL. But an effect
that moves the picture by "+y" would move it the other way. So the chaos effect subtracts `cos(time) * strength` from
v, and the shake subtracts from `gl_Position.y`: the picture moves exactly as OpenGL's.
:::
:::d3d12
One line differs from learnopengl's: in Direct3D, texture v points *down* (v = 0 is the top row), so the quad's
texture coordinates have v = 0 at the top – (−1, −1), the bottom-left corner, gets (0, 1) – and the picture is upright.
An effect that adds to v would therefore move the picture the other way than in OpenGL; the chaos effect subtracts
`cos(time) * strength` instead, and the picture moves as OpenGL's. Normalized device coordinates point up in both
APIs, so the shake keeps learnopengl's `+=`. HLSL's names: learnopengl's `texture` variable is the input `texCoord`.
:::

In addition to offsetting the vertex positions or texture coordinates, we'd also like to create some visual change as
soon as any of the effects are active. We can accomplish this within the fragment shader:

:::opengl
```glsl
#version 330 core
in vec2 TexCoords;
out vec4 color;

uniform sampler2D scene;
uniform vec2  offsets[9];
uniform int   edge_kernel[9];
uniform float blur_kernel[9];

uniform bool chaos;
uniform bool confuse;
uniform bool shake;

void main()
{
    // zero out memory since an out variable is initialized with undefined values by default
    color = vec4(0.0);

    vec3 sample[9];
    // sample from texture offsets if using convolution matrix
    if (chaos || shake)
        for (int i = 0; i < 9; i++)
            sample[i] = vec3(texture(scene, TexCoords.st + offsets[i]));

    // process effects
    if (chaos)
    {
        for (int i = 0; i < 9; i++)
            color += vec4(sample[i] * edge_kernel[i], 0.0);
        color.a = 1.0;
    }
    else if (confuse)
    {
        color = vec4(1.0 - texture(scene, TexCoords).rgb, 1.0);
    }
    else if (shake)
    {
        for (int i = 0; i < 9; i++)
            color += vec4(sample[i] * blur_kernel[i], 0.0);
        color.a = 1.0;
    }
    else
    {
        color = texture(scene, TexCoords);
    }
}
```
:::
:::vulkan
```glsl
layout(binding = 0) uniform PostProcessingUniforms {
    vec4  offsets[9];     // .xy (std140: every array element takes 16 bytes)
    ivec4 edge_kernel[9]; // .x
    vec4  blur_kernel[9]; // .x
} kernels;

layout(binding = 1) uniform sampler2D scene;

void main() {
    // zero out memory since an out variable is initialized with undefined values by default
    color = vec4(0.0);

    vec3 samples[9]; // learnopengl's "sample" is a keyword in GLSL 4.50
    // sample from texture offsets if using convolution matrix
    if (pc.chaos != 0 || pc.shake != 0)
        for (int i = 0; i < 9; i++)
            samples[i] = vec3(texture(scene, TexCoords.st + kernels.offsets[i].xy));

    // process effects
    if (pc.chaos != 0) {
        for (int i = 0; i < 9; i++)
            color += vec4(samples[i] * kernels.edge_kernel[i].x, 0.0);
        color.a = 1.0;
    } else if (pc.confuse != 0) {
        color = vec4(1.0 - texture(scene, TexCoords).rgb, 1.0);
    } else if (pc.shake != 0) {
        for (int i = 0; i < 9; i++)
            color += vec4(samples[i] * kernels.blur_kernel[i].x, 0.0);
        color.a = 1.0;
    } else {
        // alpha 1: the texture has an alpha channel (where the sprites' transparent parts were drawn it is below 1);
        // OpenGL's GL_RGB texture has none and reads 1
        color = vec4(texture(scene, TexCoords).rgb, 1.0);
    }
}
```
:::
:::d3d12
```hlsl
float4 PSMain(PSInput input) : SV_TARGET
{
    float4 color = float4(0.0f, 0.0f, 0.0f, 0.0f);

    float3 samples[9];    // learnopengl's "sample" is a keyword in HLSL
    // sample from texture offsets if using convolution matrix
    if (chaos || shake)
        for (int i = 0; i < 9; i++)
            samples[i] = scene.Sample(wrapSampler, input.texCoord + offsets[i]).rgb;

    // process effects
    if (chaos)
    {
        for (int i = 0; i < 9; i++)
            color += float4(samples[i] * edge_kernel[i], 0.0f);
        color.a = 1.0f;
    }
    else if (confuse)
    {
        color = float4(1.0f - scene.Sample(wrapSampler, input.texCoord).rgb, 1.0f);
    }
    else if (shake)
    {
        for (int i = 0; i < 9; i++)
            color += float4(samples[i] * blur_kernel[i], 0.0f);
        color.a = 1.0f;
    }
    else
    {
        // alpha 1: learnopengl's texture is GL_RGB (alpha 1); this one has alpha, which the
        // sprites' blending lowers at their soft edges - the quad would blend them with black
        color = float4(scene.Sample(wrapSampler, input.texCoord).rgb, 1.0f);
    }
    return color;
}
```
:::

This long shader almost directly follows from the fragment shader of the Framebuffers chapter and processes several
postprocessing effects based on the effect type activated. Chaos and shake both need the 9 texels around the pixel –
`offsets` are 1/300 of the texture apart –, so they are sampled first. Chaos then weighs them with the **edge
detection** kernel (8 in the middle, −1 around it: flat areas add up to black, edges light up), confuse inverts the
colour, and shake weighs them with the **blur** kernel (1 2 1 / 2 4 2 / 1 2 1, divided by 16). Because the `if`
asks for chaos first, chaos wins if both chaos and confuse are on.

:::opengl
This time, though, the offset matrix and the convolution kernels are uniforms that we set from the OpenGL code. The
advantage is that we only have to set them once, instead of recalculating these matrices in each fragment shader run.
The array keeps learnopengl's name `sample`; in GLSL 3.30 that is an ordinary name (it becomes a keyword only in GLSL
4.00). Add `SetFloat` to the shader functions – the shader's `time` is a float – and load the shader in `Init`:

```cpp
void SetFloat(Shader& shader, const char* name, float value, bool useShader = false)
{
    if (useShader)
        Use(shader);
    glUniform1f(glGetUniformLocation(shader.ID, name), value);
}
```

```cpp
LoadShader("post_processing.vs", "post_processing.fs", nullptr, "postprocessing");
```
:::
:::vulkan
learnopengl's uniforms come in two kinds, and Vulkan gets two places for them. What changes every frame – `time` and
the three switches – is a **push constant** block, `PostProcessingConstants`; a `bool` in a shader block takes 4 bytes,
so the switches are `int`s (learnopengl sets them with `SetInteger` too). What learnopengl sets only once – the offsets
and the two kernels – is a **uniform buffer**, written once when the postprocessor is created. In a uniform block
(std140) every element of an array starts at a multiple of 16 bytes, so the arrays are `vec4` / `ivec4` arrays of which
only `.xy` or `.x` is used – on both sides:

```cpp
struct PostProcessingConstants {
    float time;
    int   chaos;
    int   confuse;
    int   shake;
};

struct PostProcessingUniforms {
    glm::vec4  offsets[9];
    glm::ivec4 edge_kernel[9];
    glm::vec4  blur_kernel[9];
};
```

GLSL 4.50 reserves `sample`, so the array is called `samples`. And the plain branch writes alpha 1: the course's
texture is RGBA, and where the sprites' transparent parts were drawn its alpha is below 1 – OpenGL's GL_RGB texture has
no alpha and reads 1 there.

The descriptor set layout's binding 0 (the uniform buffer) was visible only to the vertex stage; the kernels are read
in the fragment shader, so `uboLayoutBinding.stageFlags = VK_SHADER_STAGE_VERTEX_BIT | VK_SHADER_STAGE_FRAGMENT_BIT`.

A pipeline belongs to a render pass and to a sample count: its `rasterizationSamples` must match the attachments it
draws into. The quad draws into the window (1 sample), but the sprites and particles will soon draw into a 4-sample
image. So `createPipeline` and `LoadShader` get two more parameters, the render pass and the sample count, and `Init`
loads the postprocessing shader for the window's render pass:

```cpp
LoadShader("shaders/post_processing.vert.spv", "shaders/post_processing.frag.spv", "postprocessing", VK_BLEND_FACTOR_ONE_MINUS_SRC_ALPHA, renderPass, VK_SAMPLE_COUNT_1_BIT); // the window's pass
```
:::
:::d3d12
learnopengl's per-frame uniforms – `time` and the three switches – are **root constants**, the `cbuffer
PostProcessingConstants` at `b0` (bools as `int`s, 4 bytes each). What learnopengl sets only once from the program –
the offsets and the two kernels, with `glUniform2fv`, `glUniform1iv` and `glUniform1fv` – never changes, so in HLSL it
is simply `static const` data of the shader: no buffer, no upload.

```hlsl
static const float offset = 1.0f / 300.0f;
static const float2 offsets[9] = {
    float2(-offset, -offset),  // top-left
    float2( 0.0f,   -offset),  // top-center
    float2( offset, -offset),  // top-right
    float2(-offset,  0.0f),    // center-left
    float2( 0.0f,    0.0f),    // center-center
    float2( offset,  0.0f),    // center - right
    float2(-offset,  offset),  // bottom-left
    float2( 0.0f,    offset),  // bottom-center
    float2( offset,  offset)   // bottom-right
};
static const int edge_kernel[9] = {
    -1, -1, -1,
    -1,  8, -1,
    -1, -1, -1
};
static const float blur_kernel[9] = {
    1.0f / 16.0f, 2.0f / 16.0f, 1.0f / 16.0f,
    2.0f / 16.0f, 4.0f / 16.0f, 2.0f / 16.0f,
    1.0f / 16.0f, 2.0f / 16.0f, 1.0f / 16.0f
};
```

The offsets' rows are written with v pointing down (the row above has `-offset`); both kernels are symmetric, so the
result is the same. `sample` is an HLSL keyword, so the array is called `samples`. And the plain branch writes alpha 1:
the course's texture is RGBA, and the sprites' blending lowers its alpha at their soft edges – OpenGL's GL_RGB texture
has no alpha and reads 1 there. Load the shader after the particle shader:

```cpp
LoadShader(L"post_processing.hlsl", "postprocessing");
```
:::

Now do the task **post-shader**. Nothing uses the shader yet: **no visible change**.

```quiz
In the chaos effect the picture shows up several times across the window, shifted by up to 0.3 of its size. Why does it repeat instead of ending in a band of edge colour?
- [ ] Because the vertex shader draws the quad four times
- [ ] Because the edge detection kernel copies the picture into its neighbours
- [x] Because the texture is sampled with a repeating wrap mode: texture coordinates beyond 0..1 wrap around to the other side of the picture
- [ ] Because the multisampled buffer stores four copies of the picture
---
learnopengl's Texture2D defaults to `GL_REPEAT`; the course's Vulkan sampler and Direct3D's static sampler wrap as well. With clamping, the shifted part would show the picture's border texels stretched.
```

## The PostProcessor

learnopengl puts the framebuffers, the quad and the effects into a class `PostProcessor`; the course writes it as a
struct with free functions, as everywhere in the game:

:::opengl
```cpp
struct PostProcessor
{
    // state
    Shader       PostProcessingShader;
    Texture2D    Texture;
    unsigned int Width = 0, Height = 0;
    // options
    bool         Confuse = false, Chaos = false, Shake = false;
    // render state
    unsigned int MSFBO = 0, FBO = 0; // MSFBO = Multisampled FBO. FBO is regular, used for blitting MS color-buffer to texture
    unsigned int RBO = 0;            // RBO is used for multisampled color buffer
    unsigned int VAO = 0;
};
```

`MSFBO` is the multisampled framebuffer the game is drawn into, `RBO` its renderbuffer with 4 samples per pixel, `FBO`
the ordinary framebuffer with `Texture` as its colour attachment. learnopengl's constructor becomes
`InitPostProcessor`, its private `initRenderData` the overload `InitRenderData(PostProcessor&)` (the sprite renderer's
is `InitRenderData(SpriteRenderer&)`); it makes the quad, learnopengl's six vertices from (−1, −1) to (1, 1):

```cpp
void InitPostProcessor(PostProcessor& effects, Shader shader, unsigned int width, unsigned int height)
{
    effects.PostProcessingShader = shader;
    effects.Width = width;
    effects.Height = height;
    // initialize renderbuffer/framebuffer object
    glGenFramebuffers(1, &effects.MSFBO);
    glGenFramebuffers(1, &effects.FBO);
    glGenRenderbuffers(1, &effects.RBO);
    // initialize renderbuffer storage with a multisampled color buffer (don't need a depth/stencil buffer)
    glBindFramebuffer(GL_FRAMEBUFFER, effects.MSFBO);
    glBindRenderbuffer(GL_RENDERBUFFER, effects.RBO);
    glRenderbufferStorageMultisample(GL_RENDERBUFFER, 4, GL_RGB, width, height); // allocate storage for render buffer object
    glFramebufferRenderbuffer(GL_FRAMEBUFFER, GL_COLOR_ATTACHMENT0, GL_RENDERBUFFER, effects.RBO); // attach MS render buffer object to framebuffer
    if (glCheckFramebufferStatus(GL_FRAMEBUFFER) != GL_FRAMEBUFFER_COMPLETE)
        std::cout << "ERROR::POSTPROCESSOR: Failed to initialize MSFBO" << std::endl;
    // also initialize the FBO/texture to blit multisampled color-buffer to; used for shader operations (for postprocessing effects)
    glBindFramebuffer(GL_FRAMEBUFFER, effects.FBO);
    glGenTextures(1, &effects.Texture.ID);
    Generate(effects.Texture, width, height, NULL);
    glFramebufferTexture2D(GL_FRAMEBUFFER, GL_COLOR_ATTACHMENT0, GL_TEXTURE_2D, effects.Texture.ID, 0); // attach texture to framebuffer as its color attachment
    if (glCheckFramebufferStatus(GL_FRAMEBUFFER) != GL_FRAMEBUFFER_COMPLETE)
        std::cout << "ERROR::POSTPROCESSOR: Failed to initialize FBO" << std::endl;
    glBindFramebuffer(GL_FRAMEBUFFER, 0);
    // initialize render data and uniforms
    InitRenderData(effects);
    SetInteger(effects.PostProcessingShader, "scene", 0, true);
    float offset = 1.0f / 300.0f;
    float offsets[9][2] = {
        { -offset,  offset  },  // top-left
        {  0.0f,    offset  },  // top-center
        {  offset,  offset  },  // top-right
        { -offset,  0.0f    },  // center-left
        {  0.0f,    0.0f    },  // center-center
        {  offset,  0.0f    },  // center - right
        { -offset, -offset  },  // bottom-left
        {  0.0f,   -offset  },  // bottom-center
        {  offset, -offset  }   // bottom-right
    };
    glUniform2fv(glGetUniformLocation(effects.PostProcessingShader.ID, "offsets"), 9, (float*)offsets);
    int edge_kernel[9] = {
        -1, -1, -1,
        -1,  8, -1,
        -1, -1, -1
    };
    glUniform1iv(glGetUniformLocation(effects.PostProcessingShader.ID, "edge_kernel"), 9, edge_kernel);
    float blur_kernel[9] = {
        1.0f / 16.0f, 2.0f / 16.0f, 1.0f / 16.0f,
        2.0f / 16.0f, 4.0f / 16.0f, 2.0f / 16.0f,
        1.0f / 16.0f, 2.0f / 16.0f, 1.0f / 16.0f
    };
    glUniform1fv(glGetUniformLocation(effects.PostProcessingShader.ID, "blur_kernel"), 9, blur_kernel);
}
```

Since all of the concepts of managing (multisampled) framebuffers were already extensively discussed in earlier
chapters, they need little explanation here. The renderbuffer gets storage for **4 samples** of `GL_RGB` per pixel and
no depth buffer – a 2D game needs none. The texture is a `Texture2D` with its defaults (`GL_RGB`, `GL_REPEAT`,
`GL_LINEAR`); learnopengl's Texture2D constructor generates its ID, which the course's struct does not, hence the
`glGenTextures` before `Generate(…, NULL)` – `NULL` data allocates the image without filling it. Both framebuffers are
checked for completeness. Then the uniforms that never change are set once – note `(float*)offsets`: a `float[9][2]`
is 18 floats in a row, what `glUniform2fv` with a count of 9 expects.
:::
:::vulkan
```cpp
struct PostProcessor {
    // state
    VkPipeline       PostProcessingShader = VK_NULL_HANDLE; // the postprocessing pipeline
    Texture2D        Texture;   // the picture of the game the quad shows: the multisampled image resolved into it
    unsigned int     Width = 0, Height = 0;
    // options
    bool             Confuse = false, Chaos = false, Shake = false;
    // render state (learnopengl: the multisampled framebuffer MSFBO with its renderbuffer RBO, blitted into the
    // framebuffer FBO with the texture; Vulkan: one render pass whose multisampled colour attachment is resolved into
    // Texture at the end of the pass, and one framebuffer with both images)
    VkRenderPass     RenderPass = VK_NULL_HANDLE;
    VkFramebuffer    Framebuffer = VK_NULL_HANDLE;
    VkImage          MSImage = VK_NULL_HANDLE;       // the multisampled colour image (learnopengl's RBO)
    VkDeviceMemory   MSImageMemory = VK_NULL_HANDLE;
    VkImageView      MSImageView = VK_NULL_HANDLE;
    VkBuffer         UniformBuffer = VK_NULL_HANDLE; // the offsets and kernels (PostProcessingUniforms)
    VkDeviceMemory   UniformBufferMemory = VK_NULL_HANDLE;
    VkBuffer         quadBuffer = VK_NULL_HANDLE;    // learnopengl's VAO: the quad over the whole window
    VkDeviceMemory   quadBufferMemory = VK_NULL_HANDLE;
    VkPipelineLayout pipelineLayout = VK_NULL_HANDLE;
    VkCommandBuffer  commandBuffer = VK_NULL_HANDLE;     // the command buffer being recorded this frame
    VkRenderPass     WindowRenderPass = VK_NULL_HANDLE;  // learnopengl's default framebuffer: the window's render
    VkFramebuffer    WindowFramebuffer = VK_NULL_HANDLE; // pass and this frame's swap chain framebuffer
};
```

Vulkan has no `glBlitFramebuffer`. vulkan-tutorial's Multisampling chapter shows the Vulkan way instead: the render
pass itself resolves. The postprocessor owns an **off-screen render pass** with two attachments – a 4-sample colour
image `MSImage` (learnopengl's renderbuffer) and the single-sample `Texture` as the subpass's **resolve attachment**:

```cpp
void createPostProcessingRenderPass(PostProcessor& effects) {
    // the multisampled colour image: only its resolved pixels are kept
    VkAttachmentDescription colorAttachment{};
    colorAttachment.format = VK_FORMAT_R8G8B8A8_UNORM;
    colorAttachment.samples = VK_SAMPLE_COUNT_4_BIT;
    colorAttachment.loadOp = VK_ATTACHMENT_LOAD_OP_CLEAR;
    colorAttachment.storeOp = VK_ATTACHMENT_STORE_OP_DONT_CARE;
    colorAttachment.stencilLoadOp = VK_ATTACHMENT_LOAD_OP_DONT_CARE;
    colorAttachment.stencilStoreOp = VK_ATTACHMENT_STORE_OP_DONT_CARE;
    colorAttachment.initialLayout = VK_IMAGE_LAYOUT_UNDEFINED;
    colorAttachment.finalLayout = VK_IMAGE_LAYOUT_COLOR_ATTACHMENT_OPTIMAL;

    // the texture: each pixel's 4 samples are averaged ("resolved") into it, then it is ready to be sampled
    VkAttachmentDescription colorAttachmentResolve{};
    colorAttachmentResolve.format = VK_FORMAT_R8G8B8A8_UNORM;
    colorAttachmentResolve.samples = VK_SAMPLE_COUNT_1_BIT;
    colorAttachmentResolve.loadOp = VK_ATTACHMENT_LOAD_OP_DONT_CARE;
    colorAttachmentResolve.storeOp = VK_ATTACHMENT_STORE_OP_STORE;
    colorAttachmentResolve.stencilLoadOp = VK_ATTACHMENT_LOAD_OP_DONT_CARE;
    colorAttachmentResolve.stencilStoreOp = VK_ATTACHMENT_STORE_OP_DONT_CARE;
    colorAttachmentResolve.initialLayout = VK_IMAGE_LAYOUT_UNDEFINED;
    colorAttachmentResolve.finalLayout = VK_IMAGE_LAYOUT_SHADER_READ_ONLY_OPTIMAL;

    VkAttachmentReference colorAttachmentRef{};
    colorAttachmentRef.attachment = 0;
    colorAttachmentRef.layout = VK_IMAGE_LAYOUT_COLOR_ATTACHMENT_OPTIMAL;

    VkAttachmentReference colorAttachmentResolveRef{};
    colorAttachmentResolveRef.attachment = 1;
    colorAttachmentResolveRef.layout = VK_IMAGE_LAYOUT_COLOR_ATTACHMENT_OPTIMAL;

    VkSubpassDescription subpass{};
    subpass.pipelineBindPoint = VK_PIPELINE_BIND_POINT_GRAPHICS;
    subpass.colorAttachmentCount = 1;
    subpass.pColorAttachments = &colorAttachmentRef;
    subpass.pResolveAttachments = &colorAttachmentResolveRef;

    std::array<VkSubpassDependency, 2> dependencies{};
    // before the pass: wait until the last frame's postprocessing quad has read the texture
    dependencies[0].srcSubpass = VK_SUBPASS_EXTERNAL;
    dependencies[0].dstSubpass = 0;
    dependencies[0].srcStageMask = VK_PIPELINE_STAGE_FRAGMENT_SHADER_BIT | VK_PIPELINE_STAGE_COLOR_ATTACHMENT_OUTPUT_BIT;
    dependencies[0].srcAccessMask = VK_ACCESS_COLOR_ATTACHMENT_WRITE_BIT;
    dependencies[0].dstStageMask = VK_PIPELINE_STAGE_COLOR_ATTACHMENT_OUTPUT_BIT;
    dependencies[0].dstAccessMask = VK_ACCESS_COLOR_ATTACHMENT_WRITE_BIT;
    // after the pass: the postprocessing shaders that sample the texture wait until the resolve has written it
    dependencies[1].srcSubpass = 0;
    dependencies[1].dstSubpass = VK_SUBPASS_EXTERNAL;
    dependencies[1].srcStageMask = VK_PIPELINE_STAGE_COLOR_ATTACHMENT_OUTPUT_BIT;
    dependencies[1].srcAccessMask = VK_ACCESS_COLOR_ATTACHMENT_WRITE_BIT;
    dependencies[1].dstStageMask = VK_PIPELINE_STAGE_FRAGMENT_SHADER_BIT;
    dependencies[1].dstAccessMask = VK_ACCESS_SHADER_READ_BIT;

    std::array<VkAttachmentDescription, 2> attachments = {colorAttachment, colorAttachmentResolve};
    VkRenderPassCreateInfo renderPassInfo{};
    renderPassInfo.sType = VK_STRUCTURE_TYPE_RENDER_PASS_CREATE_INFO;
    renderPassInfo.attachmentCount = static_cast<uint32_t>(attachments.size());
    renderPassInfo.pAttachments = attachments.data();
    renderPassInfo.subpassCount = 1;
    renderPassInfo.pSubpasses = &subpass;
    renderPassInfo.dependencyCount = static_cast<uint32_t>(dependencies.size());
    renderPassInfo.pDependencies = dependencies.data();

    if (vkCreateRenderPass(device, &renderPassInfo, nullptr, &effects.RenderPass) != VK_SUCCESS) {
        throw std::runtime_error("failed to create postprocessing render pass!");
    }
}
```

At the end of the subpass each pixel's 4 samples are averaged into `Texture`, which then ends in
`SHADER_READ_ONLY_OPTIMAL`, ready for the quad. The multisampled image's samples are not needed after that: its storeOp
is `DONT_CARE`, and its usage includes `TRANSIENT_ATTACHMENT`: its contents never leave the render pass. The two
subpass dependencies order the pass against the quad that samples the texture: before the pass, wait until the last
frame's quad has read it; after it, the quad's fragment shader waits for the resolve's writes.

`InitPostProcessor`, learnopengl's constructor, makes both images (`createImage` gets vulkan-tutorial's `numSamples`
parameter), the render pass, one framebuffer with both views (learnopengl's MSFBO and FBO in one), the quad, the
kernels' uniform buffer and the quad's descriptor set (the buffer at binding 0, the texture at binding 1 –
learnopengl's `scene`):

```cpp
void InitPostProcessor(PostProcessor& effects, VkPipeline shader, unsigned int width, unsigned int height) {
    effects.PostProcessingShader = shader;
    effects.Width = width;
    effects.Height = height;
    effects.pipelineLayout = pipelineLayout;
    effects.WindowRenderPass = renderPass;
    // the multisampled colour image (learnopengl's renderbuffer with 4 samples; no depth/stencil buffer needed).
    // Every Vulkan device supports 4 samples for colour attachments.
    createImage(width, height, VK_SAMPLE_COUNT_4_BIT, VK_FORMAT_R8G8B8A8_UNORM, VK_IMAGE_TILING_OPTIMAL, VK_IMAGE_USAGE_TRANSIENT_ATTACHMENT_BIT | VK_IMAGE_USAGE_COLOR_ATTACHMENT_BIT, VK_MEMORY_PROPERTY_DEVICE_LOCAL_BIT, effects.MSImage, effects.MSImageMemory);
    effects.MSImageView = createImageView(effects.MSImage, VK_FORMAT_R8G8B8A8_UNORM, VK_IMAGE_ASPECT_COLOR_BIT);
    // the texture the samples are resolved into and the quad samples (learnopengl's FBO texture)
    createImage(width, height, VK_SAMPLE_COUNT_1_BIT, VK_FORMAT_R8G8B8A8_UNORM, VK_IMAGE_TILING_OPTIMAL, VK_IMAGE_USAGE_COLOR_ATTACHMENT_BIT | VK_IMAGE_USAGE_SAMPLED_BIT, VK_MEMORY_PROPERTY_DEVICE_LOCAL_BIT, effects.Texture.Image, effects.Texture.Memory);
    effects.Texture.View = createImageView(effects.Texture.Image, VK_FORMAT_R8G8B8A8_UNORM, VK_IMAGE_ASPECT_COLOR_BIT);
    effects.Texture.Width = width;
    effects.Texture.Height = height;
    // the off-screen render pass and its framebuffer with both images
    createPostProcessingRenderPass(effects);
    std::array<VkImageView, 2> attachments = {effects.MSImageView, effects.Texture.View};
    VkFramebufferCreateInfo framebufferInfo{};
    framebufferInfo.sType = VK_STRUCTURE_TYPE_FRAMEBUFFER_CREATE_INFO;
    framebufferInfo.renderPass = effects.RenderPass;
    framebufferInfo.attachmentCount = static_cast<uint32_t>(attachments.size());
    framebufferInfo.pAttachments = attachments.data();
    framebufferInfo.width = width;
    framebufferInfo.height = height;
    framebufferInfo.layers = 1;
    if (vkCreateFramebuffer(device, &framebufferInfo, nullptr, &effects.Framebuffer) != VK_SUCCESS) {
        throw std::runtime_error("failed to create postprocessing framebuffer!");
    }
    // initialize render data and uniforms
    InitRenderData(effects);
    float offset = 1.0f / 300.0f;
    float offsets[9][2] = {
        { -offset,  offset  },  // top-left
        {  0.0f,    offset  },  // top-center
        {  offset,  offset  },  // top-right
        { -offset,  0.0f    },  // center-left
        {  0.0f,    0.0f    },  // center-center
        {  offset,  0.0f    },  // center - right
        { -offset, -offset  },  // bottom-left
        {  0.0f,   -offset  },  // bottom-center
        {  offset, -offset  }   // bottom-right
    };
    int edge_kernel[9] = {
        -1, -1, -1,
        -1,  8, -1,
        -1, -1, -1
    };
    float blur_kernel[9] = {
        1.0f / 16.0f, 2.0f / 16.0f, 1.0f / 16.0f,
        2.0f / 16.0f, 4.0f / 16.0f, 2.0f / 16.0f,
        1.0f / 16.0f, 2.0f / 16.0f, 1.0f / 16.0f
    };
    // (Vulkan's texture v points down, so "top" and "bottom" swap their names; both kernels are symmetric, so the
    // result is the same)
    PostProcessingUniforms kernels{};
    for (int i = 0; i < 9; i++) {
        kernels.offsets[i] = glm::vec4(offsets[i][0], offsets[i][1], 0.0f, 0.0f);
        kernels.edge_kernel[i] = glm::ivec4(edge_kernel[i], 0, 0, 0);
        kernels.blur_kernel[i] = glm::vec4(blur_kernel[i], 0.0f, 0.0f, 0.0f);
    }
    // learnopengl sets these uniforms once: a uniform buffer written once
    createBuffer(sizeof(PostProcessingUniforms), VK_BUFFER_USAGE_UNIFORM_BUFFER_BIT, VK_MEMORY_PROPERTY_HOST_VISIBLE_BIT | VK_MEMORY_PROPERTY_HOST_COHERENT_BIT, effects.UniformBuffer, effects.UniformBufferMemory);
    void* data;
    vkMapMemory(device, effects.UniformBufferMemory, 0, sizeof(PostProcessingUniforms), 0, &data);
        memcpy(data, &kernels, sizeof(PostProcessingUniforms));
    vkUnmapMemory(device, effects.UniformBufferMemory);
    // the descriptor set of the quad: the kernels (binding 0) and the texture (binding 1, learnopengl's "scene")
    createDescriptorSet(effects.UniformBuffer, sizeof(PostProcessingUniforms), effects.Texture.View, textureSampler, effects.Texture.DescriptorSet);
}
```

Both images are `VK_FORMAT_R8G8B8A8_UNORM`. Every Vulkan device supports 4 samples for colour attachments, so
learnopengl's fixed 4 is safe (vulkan-tutorial asks `getMaxUsableSampleCount` for the most a device can do). Because
the sprite and particle pipelines will be made for this render pass, `Init` creates the postprocessor **first** – right
after the postprocessing shader, before the other shaders; learnopengl creates it last, which OpenGL allows because a
shader program does not depend on a framebuffer. `createDescriptorSet` now takes the buffer and its size, so the
textures pass `uniformBuffer, sizeof(UniformBufferObject)`, and `cleanup()` destroys the new objects.
:::
:::d3d12
```cpp
struct PostProcessor
{
    // state
    Shader                       PostProcessingShader;
    Texture2D                    Texture;
    unsigned int                 Width = 0, Height = 0;
    // options
    bool                         Confuse = false, Chaos = false, Shake = false;
    // render state
    ComPtr<ID3D12Resource>       MSRenderTarget;  // the multisampled colour buffer the game is drawn into (learnopengl's MSFBO with its RBO)
    ComPtr<ID3D12DescriptorHeap> RtvHeap;         // its render target view
    ComPtr<ID3D12Resource>       quadVertexBuffer;
    D3D12_VERTEX_BUFFER_VIEW     quadVertexBufferView = {};
};
```

learnopengl's multisampled framebuffer with its 4-sample renderbuffer is `MSRenderTarget`, a texture with
`SampleDesc.Count = 4` that can be a render target, with its view in a small RTV heap of its own. The FBO with its
texture is `Texture`, an ordinary `Texture2D` with one sample per pixel and its shader resource view in the next heap
slot. (The swap chain's buffers cannot be multisampled at all – a flip-model swap chain needs `SampleDesc.Count = 1`,
as in the Anti Aliasing chapter – so rendering into a separate target and resolving it is how Direct3D 12 programs do
anti-aliasing anyway.) learnopengl's constructor becomes `InitPostProcessor`, its private `initRenderData` the overload
`InitRenderData(PostProcessor&)`, which makes the quad in an upload heap, with v = 0 at the top:

```cpp
void InitPostProcessor(PostProcessor& effects, Shader shader, unsigned int width, unsigned int height)
{
    effects.PostProcessingShader = shader;
    effects.Width = width;
    effects.Height = height;
    // initialize the multisampled colour buffer: a texture with 4 samples per pixel that can
    // be a render target (don't need a depth/stencil buffer). Every Direct3D 11-class GPU can
    // draw 4 samples per pixel in this format; check it anyway.
    D3D12_FEATURE_DATA_MULTISAMPLE_QUALITY_LEVELS qualityLevels = {};
    qualityLevels.Format = DXGI_FORMAT_R8G8B8A8_UNORM;
    qualityLevels.SampleCount = 4;
    qualityLevels.Flags = D3D12_MULTISAMPLE_QUALITY_LEVELS_FLAG_NONE;
    ThrowIfFailed(Graphics.Device->CheckFeatureSupport(D3D12_FEATURE_MULTISAMPLE_QUALITY_LEVELS, &qualityLevels, sizeof(qualityLevels)));
    if (qualityLevels.NumQualityLevels == 0)
        throw std::runtime_error("ERROR::POSTPROCESSOR: Failed to initialize the multisampled render target");
    const float clearColor[] = { 0.0f, 0.0f, 0.0f, 1.0f };    // the colour BeginRender clears it to (fastest)
    CD3DX12_CLEAR_VALUE clearValue(DXGI_FORMAT_R8G8B8A8_UNORM, clearColor);
    CD3DX12_HEAP_PROPERTIES heapProperties(D3D12_HEAP_TYPE_DEFAULT);
    CD3DX12_RESOURCE_DESC msDesc = CD3DX12_RESOURCE_DESC::Tex2D(DXGI_FORMAT_R8G8B8A8_UNORM, width, height, 1, 1, 4, 0, D3D12_RESOURCE_FLAG_ALLOW_RENDER_TARGET);
    ThrowIfFailed(Graphics.Device->CreateCommittedResource(
        &heapProperties,
        D3D12_HEAP_FLAG_NONE,
        &msDesc,
        D3D12_RESOURCE_STATE_RENDER_TARGET,
        &clearValue,
        IID_PPV_ARGS(&effects.MSRenderTarget)));
    // its render target view, in a small RTV heap of its own
    D3D12_DESCRIPTOR_HEAP_DESC rtvHeapDesc = {};
    rtvHeapDesc.NumDescriptors = 1;
    rtvHeapDesc.Type = D3D12_DESCRIPTOR_HEAP_TYPE_RTV;
    rtvHeapDesc.Flags = D3D12_DESCRIPTOR_HEAP_FLAG_NONE;
    ThrowIfFailed(Graphics.Device->CreateDescriptorHeap(&rtvHeapDesc, IID_PPV_ARGS(&effects.RtvHeap)));
    Graphics.Device->CreateRenderTargetView(effects.MSRenderTarget.Get(), nullptr, effects.RtvHeap->GetCPUDescriptorHandleForHeapStart());
    // also initialize the texture to resolve the multisampled colour buffer into; used for
    // shader operations (for postprocessing effects): one sample per pixel, its view in the
    // next free slot of the CBV/SRV heap
    effects.Texture.ID = Graphics.SrvCount++;
    effects.Texture.Width = width;
    effects.Texture.Height = height;
    CD3DX12_RESOURCE_DESC textureDesc = CD3DX12_RESOURCE_DESC::Tex2D(effects.Texture.Internal_Format, width, height, 1, 1);
    ThrowIfFailed(Graphics.Device->CreateCommittedResource(
        &heapProperties,
        D3D12_HEAP_FLAG_NONE,
        &textureDesc,
        D3D12_RESOURCE_STATE_PIXEL_SHADER_RESOURCE,
        nullptr,
        IID_PPV_ARGS(&effects.Texture.Resource)));
    D3D12_SHADER_RESOURCE_VIEW_DESC srvDesc = {};
    srvDesc.Shader4ComponentMapping = D3D12_DEFAULT_SHADER_4_COMPONENT_MAPPING;
    srvDesc.Format = effects.Texture.Internal_Format;
    srvDesc.ViewDimension = D3D12_SRV_DIMENSION_TEXTURE2D;
    srvDesc.Texture2D.MipLevels = 1;
    CD3DX12_CPU_DESCRIPTOR_HANDLE srvHandle(Graphics.SrvHeap->GetCPUDescriptorHandleForHeapStart(), effects.Texture.ID, Graphics.SrvDescriptorSize);
    Graphics.Device->CreateShaderResourceView(effects.Texture.Resource.Get(), &srvDesc, srvHandle);
    // initialize render data (the kernels are constants in post_processing.hlsl)
    InitRenderData(effects);
}
```

`CheckFeatureSupport` asks whether the format can have 4 samples – every GPU of feature level 11_0 and up must support
it, but asking costs nothing. The multisampled target is created in the `RENDER_TARGET` state with an optimised clear
value of black (the colour `BeginRender` clears it to), the texture in the `PIXEL_SHADER_RESOURCE` state. There is no
depth buffer: a 2D game needs none, as in learnopengl. In `OnDestroy`, `Effects = PostProcessor();` releases it all.
:::

Make the global `Effects` next to the other game objects and set it up in `Init`, after the particles:

```cpp
InitPostProcessor(Effects, GetShader("postprocessing"), game.Width, game.Height);
```

Now do the task **post-processor**. The game still draws into the window: **no visible change**.

## Rendering into the texture

The interesting parts are `BeginRender` and `EndRender`. Since we have to render the entire game scene into the
multisampled target, we call `BeginRender` before and `EndRender` after the scene's rendering code; the postprocessor
then handles the operations behind the scenes. `Render` – an overload of the game's `Render(Game&)` – draws the quad
with the effects.

:::opengl
```cpp
void BeginRender(PostProcessor& effects)
{
    glBindFramebuffer(GL_FRAMEBUFFER, effects.MSFBO);
    glClearColor(0.0f, 0.0f, 0.0f, 1.0f);
    glClear(GL_COLOR_BUFFER_BIT);
}

void EndRender(PostProcessor& effects)
{
    // now resolve multisampled color-buffer into intermediate FBO to store to texture
    glBindFramebuffer(GL_READ_FRAMEBUFFER, effects.MSFBO);
    glBindFramebuffer(GL_DRAW_FRAMEBUFFER, effects.FBO);
    glBlitFramebuffer(0, 0, effects.Width, effects.Height, 0, 0, effects.Width, effects.Height, GL_COLOR_BUFFER_BIT, GL_NEAREST);
    glBindFramebuffer(GL_FRAMEBUFFER, 0); // binds both READ and WRITE framebuffer to default framebuffer
}

void Render(PostProcessor& effects, float time)
{
    // set uniforms/options
    Use(effects.PostProcessingShader);
    SetFloat(effects.PostProcessingShader, "time", time);
    SetInteger(effects.PostProcessingShader, "confuse", effects.Confuse);
    SetInteger(effects.PostProcessingShader, "chaos", effects.Chaos);
    SetInteger(effects.PostProcessingShader, "shake", effects.Shake);
    // render textured quad
    glActiveTexture(GL_TEXTURE0);
    glBindTexture(GL_TEXTURE_2D, effects.Texture.ID);
    glBindVertexArray(effects.VAO);
    glDrawArrays(GL_TRIANGLES, 0, 6);
    glBindVertexArray(0);
}
```

`glBlitFramebuffer` copies a rectangle from the read framebuffer to the draw framebuffer; when the read framebuffer is
multisampled and the draw framebuffer is not, the copy **resolves** – each pixel gets the average of its samples. The
two rectangles must then be the same size, and `GL_NEAREST` is enough (there is no scaling to filter). After that,
`glBindFramebuffer(GL_FRAMEBUFFER, 0)` binds the window's default framebuffer for reading and drawing again. The
sprite shader needs no change: in OpenGL the number of samples belongs to the framebuffer, not to the program.
:::
:::vulkan
```cpp
void BeginRender(PostProcessor& effects) {
    VkRenderPassBeginInfo renderPassInfo{};
    renderPassInfo.sType = VK_STRUCTURE_TYPE_RENDER_PASS_BEGIN_INFO;
    renderPassInfo.renderPass = effects.RenderPass;
    renderPassInfo.framebuffer = effects.Framebuffer;
    renderPassInfo.renderArea.offset = {0, 0};
    renderPassInfo.renderArea.extent = {effects.Width, effects.Height};

    VkClearValue clearColor = {{{0.0f, 0.0f, 0.0f, 1.0f}}};
    renderPassInfo.clearValueCount = 1;
    renderPassInfo.pClearValues = &clearColor;

    vkCmdBeginRenderPass(effects.commandBuffer, &renderPassInfo, VK_SUBPASS_CONTENTS_INLINE);
}

void EndRender(PostProcessor& effects) {
    // the end of the off-screen pass resolves the multisampled image into Texture (learnopengl's glBlitFramebuffer)
    vkCmdEndRenderPass(effects.commandBuffer);
    // then the window's render pass begins (learnopengl binds the default framebuffer again)
    VkRenderPassBeginInfo renderPassInfo{};
    renderPassInfo.sType = VK_STRUCTURE_TYPE_RENDER_PASS_BEGIN_INFO;
    renderPassInfo.renderPass = effects.WindowRenderPass;
    renderPassInfo.framebuffer = effects.WindowFramebuffer;
    renderPassInfo.renderArea.offset = {0, 0};
    renderPassInfo.renderArea.extent = {effects.Width, effects.Height};

    VkClearValue clearColor = {{{0.0f, 0.0f, 0.0f, 1.0f}}};
    renderPassInfo.clearValueCount = 1;
    renderPassInfo.pClearValues = &clearColor;

    vkCmdBeginRenderPass(effects.commandBuffer, &renderPassInfo, VK_SUBPASS_CONTENTS_INLINE);
}

void Render(PostProcessor& effects, float time) {
    vkCmdBindPipeline(effects.commandBuffer, VK_PIPELINE_BIND_POINT_GRAPHICS, effects.PostProcessingShader);
    // set uniforms/options
    PostProcessingConstants constants{};
    constants.time = time;
    constants.confuse = effects.Confuse;
    constants.chaos = effects.Chaos;
    constants.shake = effects.Shake;
    vkCmdPushConstants(effects.commandBuffer, effects.pipelineLayout, VK_SHADER_STAGE_VERTEX_BIT | VK_SHADER_STAGE_FRAGMENT_BIT, 0, sizeof(PostProcessingConstants), &constants);
    // render textured quad
    vkCmdBindDescriptorSets(effects.commandBuffer, VK_PIPELINE_BIND_POINT_GRAPHICS, effects.pipelineLayout, 0, 1, &effects.Texture.DescriptorSet, 0, nullptr);
    VkBuffer vertexBuffers[] = {effects.quadBuffer};
    VkDeviceSize offsets[] = {0};
    vkCmdBindVertexBuffers(effects.commandBuffer, 0, 1, vertexBuffers, offsets);
    vkCmdDraw(effects.commandBuffer, 6, 1, 0, 0);
}
```

`BeginRender` begins the off-screen pass, cleared to black. `EndRender` ends it – the resolve – and then begins the
**window's** render pass, with `Effects.WindowFramebuffer`, this frame's swap chain framebuffer. So
`recordCommandBuffer` no longer begins the window's pass itself: it sets the viewport and the scissor (dynamic state,
valid in both passes), hands the command buffer to the renderer, the particles and the postprocessor, calls
`Render(Hedgerow)` and ends the window's pass:

```cpp
Effects.commandBuffer = commandBuffer;
Effects.WindowFramebuffer = swapChainFramebuffers[imageIndex];
// the game's picture: the off-screen pass (BeginRender ... EndRender), then the window's render pass with the
// postprocessing quad (EndRender begins it)
Render(Hedgerow);

vkCmdEndRenderPass(commandBuffer); // the window's render pass
```

And the sprite and particle pipelines are now made for `Effects.RenderPass` with 4 samples:

```cpp
LoadShader("shaders/sprite.vert.spv", "shaders/sprite.frag.spv", "sprite", VK_BLEND_FACTOR_ONE_MINUS_SRC_ALPHA, Effects.RenderPass, VK_SAMPLE_COUNT_4_BIT);
LoadShader("shaders/particle.vert.spv", "shaders/particle.frag.spv", "particle", VK_BLEND_FACTOR_ONE, Effects.RenderPass, VK_SAMPLE_COUNT_4_BIT); // additive blending
```
:::
:::d3d12
```cpp
void BeginRender(PostProcessor& effects)
{
    CD3DX12_CPU_DESCRIPTOR_HANDLE rtvHandle(effects.RtvHeap->GetCPUDescriptorHandleForHeapStart());
    Graphics.CommandList->OMSetRenderTargets(1, &rtvHandle, FALSE, nullptr);
    const float clearColor[] = { 0.0f, 0.0f, 0.0f, 1.0f };
    Graphics.CommandList->ClearRenderTargetView(rtvHandle, clearColor, 0, nullptr);
}

void EndRender(PostProcessor& effects)
{
    // now resolve the multisampled colour buffer into the texture: each pixel gets the average
    // of its samples. The render target becomes the resolve's source, the texture its destination.
    CD3DX12_RESOURCE_BARRIER barriers[2] =
    {
        CD3DX12_RESOURCE_BARRIER::Transition(effects.MSRenderTarget.Get(), D3D12_RESOURCE_STATE_RENDER_TARGET, D3D12_RESOURCE_STATE_RESOLVE_SOURCE),
        CD3DX12_RESOURCE_BARRIER::Transition(effects.Texture.Resource.Get(), D3D12_RESOURCE_STATE_PIXEL_SHADER_RESOURCE, D3D12_RESOURCE_STATE_RESOLVE_DEST)
    };
    Graphics.CommandList->ResourceBarrier(_countof(barriers), barriers);
    Graphics.CommandList->ResolveSubresource(effects.Texture.Resource.Get(), 0, effects.MSRenderTarget.Get(), 0, effects.Texture.Internal_Format);
    // and back: the render target for the next frame, the texture for the pixel shader
    barriers[0] = CD3DX12_RESOURCE_BARRIER::Transition(effects.MSRenderTarget.Get(), D3D12_RESOURCE_STATE_RESOLVE_SOURCE, D3D12_RESOURCE_STATE_RENDER_TARGET);
    barriers[1] = CD3DX12_RESOURCE_BARRIER::Transition(effects.Texture.Resource.Get(), D3D12_RESOURCE_STATE_RESOLVE_DEST, D3D12_RESOURCE_STATE_PIXEL_SHADER_RESOURCE);
    Graphics.CommandList->ResourceBarrier(_countof(barriers), barriers);
    // draw into the back buffer again (learnopengl: the default framebuffer)
    Graphics.CommandList->OMSetRenderTargets(1, &Graphics.BackBufferRtv, FALSE, nullptr);
}

void Render(PostProcessor& effects, float time)
{
    // set the shader and its options (root constants)
    Use(effects.PostProcessingShader);
    PostProcessingConstants constants = {};
    constants.time = time;
    constants.confuse = effects.Confuse;
    constants.chaos = effects.Chaos;
    constants.shake = effects.Shake;
    Graphics.CommandList->SetGraphicsRoot32BitConstants(0, sizeof(PostProcessingConstants) / 4, &constants, 0);
    // render textured quad
    CD3DX12_GPU_DESCRIPTOR_HANDLE textureHandle(Graphics.SrvHeap->GetGPUDescriptorHandleForHeapStart(), effects.Texture.ID, Graphics.SrvDescriptorSize);
    Graphics.CommandList->SetGraphicsRootDescriptorTable(2, textureHandle);
    Graphics.CommandList->IASetVertexBuffers(0, 1, &effects.quadVertexBufferView);
    Graphics.CommandList->DrawInstanced(6, 1, 0, 0);
}
```

`ResolveSubresource` is learnopengl's blit: it writes the average of each pixel's samples into the texture. It needs
the multisampled target in the `RESOLVE_SOURCE` state and the texture in `RESOLVE_DEST`, so two barriers go before it
and two after it – back to `RENDER_TARGET` for the next frame and to `PIXEL_SHADER_RESOURCE` for the quad. Then
`OMSetRenderTargets` with the back buffer's view is learnopengl's `glBindFramebuffer(GL_FRAMEBUFFER, 0)`. The game's
functions don't know the back buffer, so `GraphicsContext` gains `BackBufferRtv`, set in `PopulateCommandList` right
before `Render(Hedgerow);`.

A pipeline state can only draw into render targets with its `SampleDesc.Count`. So `Compile`, `loadShaderFromFile`
and `LoadShader` get a parameter `UINT sampleCount = 1`, and the sprite and particle shaders are loaded with 4:

```cpp
LoadShader(L"sprite.hlsl", "sprite", D3D12_BLEND_INV_SRC_ALPHA, 4);
LoadShader(L"particle.hlsl", "particle", D3D12_BLEND_ONE, 4);
```

The quad's shader keeps 1: it draws into the window. learnopengl passes `glfwGetTime()` to `Render`; the course adds
`GetTime()`, the seconds since its first call – OnUpdate's clock, so frame n reads n / 60:

```cpp
float GetTime()
{
    static auto startTime = std::chrono::high_resolution_clock::now();
    return std::chrono::duration<float, std::chrono::seconds::period>(std::chrono::high_resolution_clock::now() - startTime).count();
}
```
:::

Using the new postprocessor within the game is relatively straightforward: we wrap the scene in `BeginRender` and
`EndRender` and draw the quad after it:

:::opengl
```cpp
void Render(Game& game)
{
    if (game.State == GAME_ACTIVE)
    {
        // begin rendering to postprocessing framebuffer
        BeginRender(Effects);
        // draw background
        DrawSprite(Renderer, GetTexture("background").ID, glm::vec2(0.0f, 0.0f), glm::vec2(game.Width, game.Height), 0.0f);
        // draw level
        DrawLevel(game.Levels[game.Level], Renderer);
        // draw player
        DrawObject(Player, Renderer);
        // draw particles
        DrawParticles(Particles);
        // draw ball
        DrawObject(Ball, Renderer);
        // end rendering to postprocessing framebuffer
        EndRender(Effects);
        // render postprocessing quad
        Render(Effects, glfwGetTime());
    }
}
```
:::
:::vulkan
```cpp
void Render(Game& game) {
    if (game.State == GAME_ACTIVE) {
        // begin rendering to postprocessing framebuffer
        BeginRender(Effects);
        // draw background
        DrawSprite(Renderer, GetTexture("background").DescriptorSet, glm::vec2(0.0f, 0.0f), glm::vec2(game.Width, game.Height), 0.0f);
        // draw level
        DrawLevel(game.Levels[game.Level], Renderer);
        // draw player
        DrawObject(Player, Renderer);
        // draw particles
        DrawParticles(Particles);
        // draw ball
        DrawObject(Ball, Renderer);
        // end rendering to postprocessing framebuffer
        EndRender(Effects);
        // render postprocessing quad
        Render(Effects, static_cast<float>(glfwGetTime()));
    }
}
```
:::
:::d3d12
```cpp
void Render(Game& game)
{
    if (game.State == GAME_ACTIVE)
    {
        // begin rendering to postprocessing render target
        BeginRender(Effects);
        // draw background
        DrawSprite(Renderer, GetTexture("background").ID, XMFLOAT2(0.0f, 0.0f), XMFLOAT2(static_cast<float>(game.Width), static_cast<float>(game.Height)), 0.0f);
        // draw level
        DrawLevel(game.Levels[game.Level], Renderer);
        // draw player
        DrawObject(Player, Renderer);
        // draw particles
        DrawParticles(Particles);
        // draw ball
        DrawObject(Ball, Renderer);
        // end rendering to postprocessing render target
        EndRender(Effects);
        // render postprocessing quad
        Render(Effects, GetTime());
    }
}
```
:::

Now do the task **render-to-texture**. Build and run: **almost no visible change** – and that is the point: the game now
takes the detour through the multisampled target, the resolve and the quad, and only the edges show it. They are
anti-aliased: the rims of the ball and the paddle are smoother, and pixel rows 37, 112 and 187, which the edges between
two rows of blocks cross exactly at the pixel centres, are now half one block and half the other.
:::vulkan d3d12
(Before, those rows belonged to the lower block in {{api}} and to the upper one in OpenGL – the rasterization rules
differ at exactly that boundary, see `levels`. With 4 samples per pixel both APIs average the two blocks and agree.)
:::

```quiz
learnopengl calls `BeginRender` before the background is drawn and `EndRender` after the ball. What would happen if `EndRender` were called before the ball instead?
- [ ] Nothing: the ball is still drawn into the multisampled buffer
- [x] The ball would be drawn after the resolve, straight into the window – and then covered by the full-screen quad, so it would vanish
- [ ] The ball would be drawn twice, once in each buffer
- [ ] The resolve would fail because the scene is incomplete
---
Everything that should appear in the picture, and be touched by the effects, must be drawn between the two calls. The quad covers every pixel of the window.
```

:::opengl
```quiz
Why does `EndRender` blit the multisampled framebuffer into a second framebuffer, instead of letting the post shader sample the renderbuffer directly?
- [ ] Because a framebuffer can only be read once per frame
- [ ] Because `glBlitFramebuffer` applies the effects
- [ ] Because the renderbuffer has no colour, only depth
- [x] Because a renderbuffer can't be sampled by a shader at all, and a multisampled image holds several samples per pixel; the blit resolves them into one colour per pixel in an ordinary texture the shader can read
---
`glBlitFramebuffer` resolves when the read framebuffer is multisampled and the draw framebuffer is not; the two rectangles must then be the same size.
```
:::
:::vulkan
```quiz
How does the Vulkan project turn the 4 samples per pixel into the one colour the post shader samples?
- [ ] With `vkCmdBlitImage` from `MSImage` to `Texture` in `EndRender`
- [ ] The post shader reads the 4 samples and averages them
- [x] `Texture` is the subpass's resolve attachment (`pResolveAttachments`): when the off-screen pass ends, each pixel's samples are averaged into it, and it ends in `SHADER_READ_ONLY_OPTIMAL`
- [ ] The swap chain image is multisampled and resolves itself at presentation
---
`vkCmdBlitImage` can't take a multisampled source (`vkCmdResolveImage` could, outside the pass). The resolve attachment is vulkan-tutorial's way, and the multisampled image's storeOp can be DONT_CARE.
```
:::
:::d3d12
```quiz
What must `EndRender` do around `ResolveSubresource`?
- [ ] Nothing: `ResolveSubresource` changes the resource states itself
- [ ] Close the command list and execute it, because a resolve can't be recorded with draws
- [ ] Create a new shader resource view of the texture every frame
- [x] Transition the multisampled target to `RESOLVE_SOURCE` and the texture to `RESOLVE_DEST` before it, and both back – to `RENDER_TARGET` and `PIXEL_SHADER_RESOURCE` – after it
---
In Direct3D 12 the program tracks the states. Without the barriers the debug layer reports the wrong states, and the GPU may resolve before the draws are done or sample before the resolve is.
```
:::

:::opengl
```quiz
The sprite and particle shaders now draw into a framebuffer with 4 samples per pixel. What had to change in them?
- [x] Nothing: in OpenGL the sample count belongs to the framebuffer that is bound, not to the shader program
- [ ] They need `#extension GL_ARB_multisample`
- [ ] They must write `gl_SampleMask`
- [ ] They have to be loaded again after `InitPostProcessor`
---
In Vulkan and Direct3D 12 the sample count is part of the pipeline object, so their sprite and particle pipelines had to be made again for 4 samples.
```
:::
:::vulkan
```quiz
Why does `Init` now load the postprocessing shader and call `InitPostProcessor` before it loads the sprite and particle shaders?
- [ ] Because the post shader must be compiled first
- [x] Because a pipeline is made for a render pass and a sample count: the sprite and particle pipelines draw into the postprocessor's off-screen pass with `VK_SAMPLE_COUNT_4_BIT`, so `Effects.RenderPass` must exist first
- [ ] Because the descriptor pool is filled in that order
- [ ] Because learnopengl does it in that order
---
learnopengl creates the postprocessor last; OpenGL allows that because a shader program doesn't depend on any framebuffer.
```
:::
:::d3d12
```quiz
Why are the sprite and particle shaders loaded with `sampleCount` 4, but the postprocessing shader with 1?
- [ ] Because the post shader samples the texture 9 times
- [ ] Because only alpha-blended pipeline states can use multisampling
- [ ] Because 4 samples make the sprites' shaders run 4 times faster
- [x] Because a pipeline state can only draw into render targets with its `SampleDesc.Count`: the sprites and particles draw into the 4-sample target, the quad into the back buffer with 1 sample
---
In OpenGL the sample count belongs to the framebuffer, so learnopengl's shaders need no change. Direct3D 12 bakes it into the pipeline state.
```
:::

## Trying the effects

Wherever we want, we can now set the required effect property of the postprocessor to true, and its effect will be
immediately active. Try the first one: in `Init`, right after the postprocessor is set up, switch on confuse – as a
try-out line, which the last task removes again:

```cpp
InitPostProcessor(Effects, GetShader("postprocessing"), game.Width, game.Height);
Effects.Confuse = true; // try the effects: confuse (the picture upside down, its colours inverted)
```

Now do the task **confuse**. Build and run: **the whole picture is upside down and mirrored, its colours inverted** –
the light sky at the bottom, the blocks at the bottom, the paddle at the top, the dark blue of the dusk turned pale and
the orange blocks bluish.

Then replace the line with `Effects.Chaos = true;` and do the task **chaos**: **edge detection on a picture shifted by
(sin(time), cos(time)) × 0.3**. Wherever the picture is flat the kernel adds up to black; thin bright lines run along
the blocks' and sprites' edges, and the stars of the sky are dots. Because the texture repeats, the shifted picture
fills the whole window, and it moves on with every frame.
:::vulkan d3d12
It moves the same way as OpenGL's – thanks to the minus in the vertex shader.
:::

## Shake

As a practical demonstration of these effects, we'll emulate the visual impact of the ball when it hits a solid
stone. By enabling the shake effect for a short period of time wherever a solid collision occurs, it'll look like the
collision had a stronger impact.

We want to enable the screen shake effect only over a small period of time. We can get this to work by creating a
variable called `ShakeTime` that manages the duration the shake effect is supposed to be active, next to `Effects`:

```cpp
float ShakeTime = 0.0f;
```

Wherever a solid collision occurs, we set this variable to a specific duration – in `DoCollisions`:

:::opengl d3d12
```cpp
if (!box.IsSolid)
    box.Destroyed = true;
else
{   // if block is solid, enable shake effect
    ShakeTime = 0.05f;
    Effects.Shake = true;
}
```
:::
:::vulkan
```cpp
if (!box.IsSolid)
    box.Destroyed = true;
else { // if block is solid, enable shake effect
    ShakeTime = 0.05f;
    Effects.Shake = true;
}
```
:::

Then, within the game's `Update`, after the particles, we decrease `ShakeTime` until it's 0.0, after which we disable
the shake effect:

:::opengl d3d12
```cpp
if (ShakeTime > 0.0f)
{
    ShakeTime -= dt;
    if (ShakeTime <= 0.0f)
        Effects.Shake = false;
}
```
:::
:::vulkan
```cpp
if (ShakeTime > 0.0f) {
    ShakeTime -= dt;
    if (ShakeTime <= 0.0f)
        Effects.Shake = false;
}
```
:::

Now do the task **shake**: remove the try-out line, and add the variable, the else branch and the countdown. Build and
run. With the course's fixed input the ball hits the stone in frame 86, so in the picture at 1.45 s – frame 87 – **the
picture is blurred and moved by about 1.4 pixels to the left and 2.9 pixels down**: the paddle's edges are soft, the
blocks' rims are smeared. Flat areas hardly change. From frame 88 on the picture is sharp again. Each time the ball hits
a solid block, the screen briefly starts to shake and blur, giving the player some visual feedback that the ball
collided with a solid object. In the next chapter, about power-ups, we'll bring the other two effects to good use.

```quiz
The ball hits the stone in frame 86. `DoCollisions` sets `ShakeTime = 0.05f`, and each `Update` subtracts dt = 1/60 s afterwards. In which frames is the picture shaken?
- [ ] Only in frame 86
- [x] In frames 86 and 87; in frame 88 `ShakeTime` falls to 0 or below and the shake is switched off before the frame is rendered
- [ ] In frames 86, 87 and 88, three frames of 1/60 s each
- [ ] From frame 86 until the ball hits the paddle
---
Frame 86: 0.05 − 1/60 ≈ 0.033 (still shaking); frame 87: ≈ 0.017; frame 88: ≈ 0.0 → `Effects.Shake = false`. `Update` runs before `Render`, so the countdown of a frame already counts for its picture.
```

```quiz
What does the screen show if both `Effects.Chaos` and `Effects.Confuse` are true?
- [ ] The confused picture, because it was switched on first
- [ ] A mix of both: inverted colours with edge detection
- [ ] A black screen: the effects cancel each other out
- [x] The chaos effect: both shaders ask for chaos first (`if (chaos) … else if (confuse) …`), so confuse is ignored
---
learnopengl says the two shouldn't be on at the same time – the next chapter's power-ups make sure of it. Shake can be combined with either: its vertex wobble is a separate `if`.
```

## Additional resources

- [Postprocessing](https://learnopengl.com/In-Practice/2D-Game/Postprocessing): learnopengl's chapter this chapter
  follows.
- [Framebuffers](https://learnopengl.com/Advanced-OpenGL/Framebuffers) and
  [Anti Aliasing](https://learnopengl.com/Advanced-OpenGL/Anti-Aliasing): the kernels, and the multisampled
  framebuffer with its blit.

:::opengl
- [glBlitFramebuffer](https://registry.khronos.org/OpenGL-Refpages/gl4/html/glBlitFramebuffer.xhtml): the copy and
  when it resolves.
:::
:::vulkan
- [Multisampling (Vulkan Tutorial)](https://vulkan-tutorial.com/Multisampling): the multisampled colour attachment
  and its resolve attachment.
:::
:::d3d12
- [ResolveSubresource](https://learn.microsoft.com/en-us/windows/win32/api/d3d12/nf-d3d12-id3d12graphicscommandlist-resolvesubresource):
  the resolve and its states.
:::
