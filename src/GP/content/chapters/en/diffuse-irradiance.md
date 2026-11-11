# Diffuse Irradiance

IBL, or *image based lighting*, is a collection of techniques to light objects, not by direct analytical lights as in
the previous chapter, but by treating the surrounding environment as one big light source. This is generally
accomplished by manipulating a cubemap environment map (taken from the real world or generated from a 3D scene) such
that we can directly use it in our lighting equations: treating each cubemap texel as a light emitter. This way we can
effectively capture an environment's global lighting and general feel, giving objects a better sense of belonging in
their environment.

As image based lighting algorithms capture the lighting of some (global) environment, its input is considered a more
precise form of ambient lighting, even a crude approximation of global illumination. This makes IBL interesting for PBR
as objects look significantly more physically accurate when we take the environment's lighting into account.

To start introducing IBL into our PBR system let's again take a quick look at the reflectance equation:

```text
  Lo(p, ωo) = ∫Ω  ( kd · c / π  +  (D · F · G) / (4 · (ωo · n) · (ωi · n)) ) · Li(p, ωi) · (n · ωi)  dωi
```

As described before, our main goal is to solve the integral of all incoming light directions ωi over the hemisphere Ω.
Solving the integral in the previous chapter was easy as we knew beforehand the exact few light directions ωi that
contributed to the integral. This time however, every incoming light direction ωi from the surrounding environment
could potentially have some radiance making it less trivial to solve the integral. This gives us two main requirements
for solving the integral:

- We need some way to retrieve the scene's radiance given any direction vector ωi.
- Solving the integral needs to be fast and real-time.

Now, the first requirement is relatively easy. We've already hinted it, but one way of representing an environment or
scene's irradiance is in the form of a (processed) environment cubemap. Given such a cubemap, we can visualize every
texel of the cubemap as one single emitting light source. By sampling this cubemap with any direction vector ωi, we
retrieve the scene's radiance from that direction.

Getting the scene's radiance given any direction vector ωi is then as simple as:

```glsl
vec3 radiance = texture(_cubemapEnvironment, w_i).rgb;
```

Still, solving the integral requires us to sample the environment map from not just one direction, but all possible
directions ωi over the hemisphere Ω which is far too expensive for each fragment shader invocation. To solve the
integral in a more efficient fashion we'll want to *pre-process* or *pre-compute* most of the computations. For this
we'll have to delve a bit deeper into the reflectance equation:

```text
  Lo(p, ωo) = ∫Ω  ( kd · c / π  +  (D · F · G) / (4 · (ωo · n) · (ωi · n)) ) · Li(p, ωi) · (n · ωi)  dωi
```

Taking a good look at the reflectance equation we find that the diffuse kd and specular ks term of the BRDF are
independent from each other and we can split the integral in two:

```text
  Lo(p, ωo) = ∫Ω  kd · c / π · Li(p, ωi) · (n · ωi)  dωi
            + ∫Ω  (D · F · G) / (4 · (ωo · n) · (ωi · n)) · Li(p, ωi) · (n · ωi)  dωi
```

By splitting the integral in two parts we can focus on both the diffuse and specular term individually; the focus of
this chapter being on the diffuse integral.

Taking a closer look at the diffuse integral we find that the diffuse Lambert term is a constant term (the colour c,
the refraction ratio kd, and π are constant over the integral) and not dependent on any of the integral variables.
Given this, we can move the constant term out of the diffuse integral:

```text
  Lo(p, ωo) = kd · c / π · ∫Ω  Li(p, ωi) · (n · ωi)  dωi
```

This gives us an integral that only depends on ωi (assuming p is at the centre of the environment map). With this
knowledge, we can calculate or pre-compute a new cubemap that stores in each sample direction (or texel) ωo the diffuse
integral's result by *convolution*.

Convolution is applying some computation to each entry in a data set considering all other entries in the data set;
the data set being the scene's radiance or environment map. Thus for every sample direction in the cubemap, we take all
other sample directions over the hemisphere Ω into account.

To convolute an environment map we solve the integral for each output ωo sample direction by discretely sampling a
large number of directions ωi over the hemisphere Ω and averaging their radiance. The hemisphere we build the sample
directions ωi from is oriented towards the output ωo sample direction we're convoluting.

This pre-computed cubemap, that for each sample direction ωo stores the integral result, can be thought of as the
pre-computed sum of all indirect diffuse light of the scene hitting some surface aligned along direction ωo. Such a
cubemap is known as an *irradiance map* seeing as the convoluted cubemap effectively allows us to directly sample the
scene's (pre-computed) irradiance from any direction ωo.

The radiance equation also depends on a position p, which we've assumed to be at the centre of the irradiance map. This
does mean all diffuse indirect light must come from a single environment map which may break the illusion of reality
(especially indoors). Render engines solve this by placing *reflection probes* all over the scene where each reflection
probe calculates its own irradiance map of its surroundings. This way, the irradiance (and radiance) at position p is
the interpolated irradiance between its closest reflection probes. For now, we assume we always sample the environment
map from its centre.

By storing the convoluted result in each cubemap texel (in the direction of ωo), the irradiance map displays somewhat
like an average colour or lighting display of the environment. Sampling any direction from this environment map will
give us the scene's irradiance in that particular direction.

```quiz
Why does the project convolute the environment into an irradiance map once, instead of summing up the environment's light over the hemisphere in the spheres' fragment shader?
- [ ] Because a fragment shader cannot sample a cube map with a direction
- [x] Because the diffuse integral only depends on the direction of the normal: it can be computed once for every direction, stored in a small cube map, and then read with a single lookup per fragment – summing about a thousand samples per fragment and frame would be far too slow
- [ ] Because the irradiance map is sharper than the environment map
- [ ] Because the spheres' fragment shader has no access to the environment's HDR values
---
With the Lambertian term moved out, what is left in the integral is a function of the normal alone – a function on the sphere of directions, which is exactly what a cube map stores. 32 × 32 texels per face are enough because that function changes slowly.
```

## The project

The project starts where the previous chapter's `tone-map` task left off: the 7 × 7 red spheres with the complete
reflectance equation for the four point lights, Reinhard and gamma at the end of the shader, and the constant ambient
term `0.03 * albedo * ao`. (The textured spheres come back in the next chapter's last task.) The camera is still at
(0, 0, 22). New in the project are an environment image and the shaders for three passes that are TODOs for now, and a
cube: learnopengl's `renderCube()`, the 2 × 2 × 2 cube of the earlier chapters with 36 vertices, of which only the
positions are used here.

The environment is the course's own: `environment.hdr`, a 512 × 256 equirectangular HDR image of a sky with clouds and
a bright, hazy sun, green hills on the horizon, a grey-brown ground and three coloured lamps (learnopengl uses
`newport_loft.hdr`, a photograph of a loft). The camera looks down -z, at the middle of the image's left half: pale
blue-grey sky above, dark green hills on the horizon (higher on the left of the window), the ground below. The sun –
up, to the right and *behind* the camera – and the lamps are outside the view, but they will light the spheres from the
front.

Two numbers are smaller than learnopengl's, because the course computes its checks and expected results on the CPU (a
real GPU handles learnopengl's values easily): the environment cube map has 128 × 128 texels per face instead of 512 ×
512, and the convolution samples the hemisphere with a step of 0.1 instead of 0.025 – 1008 samples per texel instead of
about 16,000.

:::opengl
`main.cpp` has the shader objects of learnopengl's IBL demo: the spheres' shader is called `pbrShader` now. The new
files are `cubemap.vs` (complete), `equirectangular_to_cubemap.fs`, `irradiance_convolution.fs`, `background.vs` and
`background.fs` (their bodies are TODOs). `loadTexture` is still there, unused.
:::
:::vulkan
`main.cpp` calls the spheres' pipeline `pbrPipeline` now. Prepared: the global `vertices` with learnopengl's cube (the
sphere's `Vertex` struct, the tangent left zero), its `vertexBuffer` and `renderCube(VkCommandBuffer)`
(`vkCmdBindVertexBuffers` + `vkCmdDraw(commandBuffer, 36, 1, 0, 0)`). In `shaders/` there are `cubemap.vert`
(complete), `equirectangular_to_cubemap.frag`, `irradiance_convolution.frag`, `background.vert` and `background.frag`
(stubs that compile but are not used yet). The TODOs in `main.cpp` mark the members, the pipelines, the images, the
capture, the background draw and the cleanup.
:::
:::d3d12
`main.cpp` has a second vertex buffer `m_cubeVertexBuffer` with learnopengl's cube (the same `Vertex` struct, tangent
zero) and the helper `RenderCube()` (`IASetPrimitiveTopology(D3D_PRIMITIVE_TOPOLOGY_TRIANGLELIST)`,
`IASetVertexBuffers`, `DrawInstanced(36, 1, 0, 0)`) – each draw sets its own topology, so the strip of the spheres and
the list of the cube can follow each other with no other change. The new shader files are `cubemap.hlsl` (complete:
the vertex shader of the capture passes), `equirectangular_to_cubemap.hlsl` and `irradiance_convolution.hlsl` (a
`PSMain` each, bodies TODO) and `background.hlsl` (`VSMain` and `PSMain`, bodies TODO). `LoadTexture` is still there,
unused.
:::

## PBR and HDR

We've briefly touched upon it in the *HDR* chapter: taking the high dynamic range of your scene's lighting into account
in a PBR pipeline is incredibly important. As PBR bases most of its inputs on real physical properties and measurements
it makes sense to closely match the incoming light values to their physical equivalents. Whether we make educated
guesses on each light's radiant flux or use their direct physical equivalent, the difference between a simple light
bulb or the sun is significant either way. Without working in an HDR render environment it's impossible to correctly
specify each light's relative intensity.

So, PBR and HDR go hand in hand, but how does it all relate to image based lighting? We've seen in the previous chapter
that it's relatively easy to get PBR working in HDR. However, seeing as for image based lighting we base the
environment's indirect light intensity on the colour values of an environment cubemap we need some way to store the
lighting's high dynamic range into an environment map.

The environment maps we've been using so far as cubemaps (used as skyboxes for instance) are in low dynamic range
(LDR). We directly used their colour values from the individual face images, ranged between 0.0 and 1.0, and processed
them as is. While this may work fine for visual output, when taking them as physical input parameters it's not going to
work.

### The radiance HDR file format

Enter the radiance file format. The radiance file format (with the `.hdr` extension) stores a full cubemap with all 6
faces as floating point data. This allows us to specify colour values outside the 0.0 to 1.0 range to give lights
their correct colour intensities. The file format also uses a clever trick to store each floating point value, not as
a 32 bit value per channel, but 8 bits per channel using the colour's alpha channel as an exponent (this does come with
a loss of precision). This works quite well, but requires the parsing program to re-convert each colour to their
floating point equivalent.

There are quite a few radiance HDR environment maps freely available from sources like the sIBL archive. Most of them
are not stored as six faces but as one image, an *equirectangular map*: the sphere of directions unwrapped onto a
rectangle twice as wide as it is high, with the longitude across and the latitude up. The course's `environment.hdr`
is such an image. The sky appears to be stretched, but it contains all the information of a cube map: we'll convert it
to one later on. The bright parts are far above 1.0 – in the course's image the sun has a radiance of about 60 – and
those values are what let the environment *light* the scene rather than only show behind it.

### HDR and stb_image.h

Loading radiance HDR images directly requires some knowledge of the file format which isn't too difficult, but
cumbersome nonetheless. Lucky for us, the popular one header library `stb_image.h` supports loading radiance HDR images
directly as an array of floating point values which perfectly fits our needs. With `stb_image` added to your project,
loading an HDR image is now as simple as follows:

:::opengl
```cpp
    stbi_set_flip_vertically_on_load(true);
    int width, height, nrComponents;
    float *data = stbi_loadf("environment.hdr", &width, &height, &nrComponents, 0);
    unsigned int hdrTexture = 0;
    if (data)
    {
        glGenTextures(1, &hdrTexture);
        glBindTexture(GL_TEXTURE_2D, hdrTexture);
        glTexImage2D(GL_TEXTURE_2D, 0, GL_RGB16F, width, height, 0, GL_RGB, GL_FLOAT, data); // note how we specify the texture's data value to be float

        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_S, GL_CLAMP_TO_EDGE);
        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_T, GL_CLAMP_TO_EDGE);
        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, GL_LINEAR);
        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, GL_LINEAR);

        stbi_image_free(data);
    }
    else
    {
        std::cout << "Failed to load HDR image." << std::endl;
    }
```

`stb_image.h` automatically maps the HDR values to a list of floating point values: 32 bits per channel and 3 channels
per colour by default. This is all we need to store the equirectangular HDR environment map into a 2D floating point
texture: `GL_RGB16F` keeps the values above 1.0. With the flip, the image's top row – straight up – is v = 1.
:::
:::vulkan
```cpp
    void loadHdrTexture(const char* path, VkImage& image, VkDeviceMemory& imageMemory, VkImageView& imageView) {
        stbi_set_flip_vertically_on_load(true);
        int width, height, nrComponents;
        float* data = stbi_loadf(path, &width, &height, &nrComponents, STBI_rgb_alpha);

        if (!data) {
            throw std::runtime_error("failed to load HDR image!");
        }

        // linear filtering of 32-bit float images is optional in Vulkan (desktop GPUs have it): check before relying on it
        VkFormat format = findSupportedFormat(
            {VK_FORMAT_R32G32B32A32_SFLOAT},
            VK_IMAGE_TILING_OPTIMAL,
            VK_FORMAT_FEATURE_SAMPLED_IMAGE_BIT | VK_FORMAT_FEATURE_SAMPLED_IMAGE_FILTER_LINEAR_BIT
        );

        VkDeviceSize imageSize = width * height * 4 * sizeof(float);
        createTextureImage(data, imageSize, width, height, 1, format, image, imageMemory);
        stbi_image_free(data);

        imageView = createImageView(image, format, VK_IMAGE_ASPECT_COLOR_BIT, 1);
    }
```

`stb_image.h` maps the HDR values to a list of 32-bit floats; asking for `STBI_rgb_alpha` gives four of them per pixel,
the layout of `VK_FORMAT_R32G32B32A32_SFLOAT` (three-channel formats are rarely supported for images). The values stay
as they are – far above 1.0 for the sun. Vulkan doesn't require a device to filter 32-bit float images linearly, so
`findSupportedFormat` checks for `VK_FORMAT_FEATURE_SAMPLED_IMAGE_FILTER_LINEAR_BIT` before the project relies on it.
The image is flipped on load, like learnopengl's, so the top row – straight up – is v = 1 and learnopengl's
`SampleSphericalMap` works unchanged. `clampSampler` (linear, `CLAMP_TO_EDGE`) reads it and the cube maps.
:::
:::d3d12
`LoadHdrTexture` is `LoadTexture` for floats: `stbi_loadf(path, &width, &height, &nrComponents, 4)` (four floats per
pixel), a `DXGI_FORMAT_R32G32B32A32_FLOAT` texture, uploaded with `RowPitch = width * 4 * sizeof(float)`, its SRV in heap
slot 1. learnopengl uses `GL_RGB16F` with three floats per pixel; Direct3D's three-channel float format
`R32G32B32_FLOAT` need not be filterable, while feature level 11.0 hardware must filter `R32G32B32A32_FLOAT`, which also
takes the loader's floats as they are. The image is *not* flipped: Direct3D's v = 0 is the image's top row – straight
up. `SampleSphericalMap` turns v round instead (see below). A static sampler s0 (`MIN_MAG_MIP_LINEAR`, CLAMP:
learnopengl's `GL_LINEAR` and `GL_CLAMP_TO_EDGE`) reads it and the cube maps.
:::

```quiz
Why is the environment loaded with `stbi_loadf` into a floating point texture, and not with `stbi_load` into an 8-bit one like the earlier textures?
- [ ] Because `stbi_load` can't read `.hdr` files at all
- [ ] Because floating point textures are filtered more smoothly
- [ ] Because the cube map conversion only works with float inputs
- [x] Because the environment's radiance goes far above 1.0 – the sun is about 60 –; an 8-bit texture would clip it at 1.0, and the sun would light the spheres no more than a white cloud
---
The environment is the light source of image based lighting, so its values must be physical, unbounded radiance. Every texture on the way – the 2D image, the cube map, the irradiance map – keeps floats for that reason.
```

### From equirectangular to cubemap

It is possible to use the equirectangular map directly for environment lookups, but these operations can be relatively
expensive in which case a direct cubemap sample is more performant. Therefore, in this chapter we'll first convert the
equirectangular image to a cubemap for further processing. Note that in the process we also show how to sample an
equirectangular map as if it was a 3D environment map in which case you're free to pick whichever solution you prefer.

To convert an equirectangular image into a cubemap we need to render a (unit) cube and project the equirectangular map
on all of the cube's faces from the inside and take 6 images of each of the cube's sides as a cubemap face. The vertex
shader of this cube simply renders the cube as is and passes its local position to the fragment shader as a 3D sample
vector:

:::opengl
```glsl
#version 330 core
layout (location = 0) in vec3 aPos;

out vec3 WorldPos;

uniform mat4 projection;
uniform mat4 view;

void main()
{
    WorldPos = aPos;
    gl_Position =  projection * view * vec4(WorldPos, 1.0);
}
```
:::
:::vulkan
```glsl
layout(push_constant) uniform CapturePushConstants {
    mat4 projectionView;
} pc;

layout(location = 0) in vec3 inPosition;
layout(location = 1) in vec3 inNormal;   // not used, but in the vertex buffer
layout(location = 2) in vec2 inTexCoord; // not used, but in the vertex buffer
layout(location = 3) in vec3 inTangent;  // not used, but in the vertex buffer

layout(location = 0) out vec3 fragWorldPos;

void main() {
    fragWorldPos = inPosition;
    gl_Position = pc.projectionView * vec4(fragWorldPos, 1.0);
}
```

The capture's matrices are a push constant, not a uniform: the six faces are drawn in one command buffer, and a
uniform buffer can't change between the draws of a command buffer, while a push constant can. `CapturePushConstants`
shares the pipeline layout's one push constant range with the spheres' `PushConstants` (`pushConstantRange.size =
std::max(sizeof(PushConstants), sizeof(CapturePushConstants))`).
:::
:::d3d12
```hlsl
cbuffer CaptureConstants : register(b0)
{
    float4x4 captureView;
    float4x4 captureProjection;
};

PSInput VSMain(float3 position : POSITION)
{
    PSInput result;

    result.worldPos = position;
    result.position = mul(mul(float4(position, 1.0f), captureView), captureProjection);

    return result;
}
```

The capture's matrices are root constants at b0 – the same root parameter 0 through which the spheres get their
`ModelConstants`: every pipeline's shaders read their own cbuffer there. (The 38 values of `ModelConstants` are more
than the 32 of `CaptureConstants`, so the root parameter is large enough for both.)
:::

For the fragment shader, we colour each part of the cube as if we neatly folded the equirectangular map onto each side
of the cube. To accomplish this, we take the fragment's sample direction as interpolated from the cube's local position
and then use this direction vector and some trigonometry magic (spherical to cartesian) to sample the equirectangular
map as if it's a cubemap itself. We directly store the result onto the cube-face's fragment which should be all we
need to do:

:::opengl
```glsl
const vec2 invAtan = vec2(0.1591, 0.3183);
vec2 SampleSphericalMap(vec3 v)
{
    vec2 uv = vec2(atan(v.z, v.x), asin(v.y));
    uv *= invAtan;
    uv += 0.5;
    return uv;
}

void main()
{
    vec2 uv = SampleSphericalMap(normalize(WorldPos));
    vec3 color = texture(equirectangularMap, uv).rgb;

    FragColor = vec4(color, 1.0);
}
```
:::
:::vulkan
```glsl
const vec2 invAtan = vec2(0.1591, 0.3183);
vec2 SampleSphericalMap(vec3 v) {
    vec2 uv = vec2(atan(v.z, v.x), asin(v.y));
    uv *= invAtan;
    uv += 0.5;
    return uv;
}

void main() {
    vec2 uv = SampleSphericalMap(normalize(fragWorldPos));
    vec3 color = texture(equirectangularMap, uv).rgb;

    outColor = vec4(color, 1.0);
}
```
:::
:::d3d12
```hlsl
static const float2 invAtan = float2(0.1591f, 0.3183f);
float2 SampleSphericalMap(float3 v)
{
    float2 uv = float2(atan2(v.z, v.x), asin(v.y));
    uv *= invAtan;
    uv += 0.5f;
    // Direct3D's v = 0 is the image's top row, where the sky is (learnopengl flips the
    // image when loading it instead: its v = 0 is the bottom row)
    uv.y = 1.0f - uv.y;
    return uv;
}

float4 PSMain(PSInput input) : SV_TARGET
{
    float2 uv = SampleSphericalMap(normalize(input.worldPos));
    float3 color = equirectangularMap.Sample(clampSampler, uv).rgb;
    return float4(color, 1.0f);
}
```

GLSL's two-argument `atan(y, x)` is HLSL's `atan2(y, x)`.
:::

`atan(z, x)` is the direction's longitude, between -π and π; `asin(y)` its latitude, between -π/2 and π/2. Multiplied
by (1/2π, 1/π) – the 0.1591 and 0.3183 – and shifted by 0.5, both become texture coordinates between 0 and 1.

If you render a cube at the centre of the scene given an HDR equirectangular map you'll get something that looks like
the sky folded onto a box. This demonstrates that we effectively mapped an equirectangular image onto a cubic shape,
but doesn't yet help us in converting the source HDR image to a cubemap texture. To accomplish this we have to render
the same cube 6 times, looking at each individual face of the cube, while recording its visual result with a
framebuffer object:

:::opengl
```cpp
    unsigned int captureFBO;
    unsigned int captureRBO;
    glGenFramebuffers(1, &captureFBO);
    glGenRenderbuffers(1, &captureRBO);

    glBindFramebuffer(GL_FRAMEBUFFER, captureFBO);
    glBindRenderbuffer(GL_RENDERBUFFER, captureRBO);
    glRenderbufferStorage(GL_RENDERBUFFER, GL_DEPTH_COMPONENT24, 128, 128);
    glFramebufferRenderbuffer(GL_FRAMEBUFFER, GL_DEPTH_ATTACHMENT, GL_RENDERBUFFER, captureRBO);
```

Of course, we then also generate the corresponding cubemap colour textures, pre-allocating memory for each of its 6
faces:

```cpp
    unsigned int envCubemap;
    glGenTextures(1, &envCubemap);
    glBindTexture(GL_TEXTURE_CUBE_MAP, envCubemap);
    for (unsigned int i = 0; i < 6; ++i)
    {
        glTexImage2D(GL_TEXTURE_CUBE_MAP_POSITIVE_X + i, 0, GL_RGB16F, 128, 128, 0, GL_RGB, GL_FLOAT, nullptr);
    }
    glTexParameteri(GL_TEXTURE_CUBE_MAP, GL_TEXTURE_WRAP_S, GL_CLAMP_TO_EDGE);
    glTexParameteri(GL_TEXTURE_CUBE_MAP, GL_TEXTURE_WRAP_T, GL_CLAMP_TO_EDGE);
    glTexParameteri(GL_TEXTURE_CUBE_MAP, GL_TEXTURE_WRAP_R, GL_CLAMP_TO_EDGE);
    glTexParameteri(GL_TEXTURE_CUBE_MAP, GL_TEXTURE_MIN_FILTER, GL_LINEAR);
    glTexParameteri(GL_TEXTURE_CUBE_MAP, GL_TEXTURE_MAG_FILTER, GL_LINEAR);
```
:::
:::vulkan
The counterpart of learnopengl's capture framebuffer is a render pass for one face, a cube map image, and a view plus a
framebuffer per face. `createCaptureRenderPass(format, renderPass)` makes a render pass with a single colour attachment
of the given format (`VK_FORMAT_R16G16B16A16_SFLOAT` for the cube maps) and no depth attachment:

```cpp
        colorAttachment.loadOp = VK_ATTACHMENT_LOAD_OP_DONT_CARE; // every pixel is written: no need to clear
        colorAttachment.storeOp = VK_ATTACHMENT_STORE_OP_STORE;
        ...
        colorAttachment.initialLayout = VK_IMAGE_LAYOUT_UNDEFINED;
        colorAttachment.finalLayout = VK_IMAGE_LAYOUT_SHADER_READ_ONLY_OPTIMAL; // ready to be sampled after the pass
```

The cube is seen from its centre, so nothing can hide anything and every pixel of the face is covered: no depth buffer
and no clear are needed (learnopengl attaches a depth renderbuffer and clears it anyway). The pass ends with the face
ready to be sampled, and two subpass dependencies order the writes against earlier and later shader reads.

`createCubemap(size, mipLevels, image, memory, view)` makes the cube map – one image with **six array layers**, the
faces +X, -X, +Y, -Y, +Z, -Z:

```cpp
        imageInfo.flags = VK_IMAGE_CREATE_CUBE_COMPATIBLE_BIT; // its six layers can be viewed as a cube map
        ...
        imageInfo.arrayLayers = 6; // one layer per face
        imageInfo.format = VK_FORMAT_R16G16B16A16_SFLOAT;
        ...
        imageInfo.usage = VK_IMAGE_USAGE_COLOR_ATTACHMENT_BIT | VK_IMAGE_USAGE_SAMPLED_BIT;
```

and its view with `viewInfo.viewType = VK_IMAGE_VIEW_TYPE_CUBE` over the six layers, through which the shaders sample
it with a direction – the *Point Shadows* chapter's depth cube map was made the same way.
:::
:::d3d12
The counterpart of learnopengl's capture framebuffer is a render target view of one face. The cube map itself is a 2D
texture with six array slices, the faces +X, -X, +Y, -Y, +Z, -Z, that may be a render target, created in the
`RENDER_TARGET` state because it is drawn into first:

```cpp
        CD3DX12_RESOURCE_DESC textureDesc = CD3DX12_RESOURCE_DESC::Tex2D(DXGI_FORMAT_R16G16B16A16_FLOAT, 128, 128, 6, 1, 1, 0, D3D12_RESOURCE_FLAG_ALLOW_RENDER_TARGET);
```

Its SRV in heap slot 2 has `ViewDimension = D3D12_SRV_DIMENSION_TEXTURECUBE`, so shaders read it as a `TextureCube`
with a direction. To draw into one face, `SetCaptureTarget` writes a view of that face into the one spare RTV
descriptor (slot `FrameCount` of the RTV heap, which grows to `FrameCount + 1`) and binds it:

```cpp
void D3D12App::SetCaptureTarget(ID3D12Resource* cubemap, UINT face, UINT mip)
{
    // The view covers one array slice (the face) of one mip level of the cube map.
    D3D12_RENDER_TARGET_VIEW_DESC rtvDesc = {};
    rtvDesc.Format = DXGI_FORMAT_R16G16B16A16_FLOAT;
    rtvDesc.ViewDimension = D3D12_RTV_DIMENSION_TEXTURE2DARRAY;
    rtvDesc.Texture2DArray.MipSlice = mip;
    rtvDesc.Texture2DArray.FirstArraySlice = face;
    rtvDesc.Texture2DArray.ArraySize = 1;

    CD3DX12_CPU_DESCRIPTOR_HANDLE rtvHandle(m_rtvHeap->GetCPUDescriptorHandleForHeapStart(), FrameCount, m_rtvDescriptorSize);
    m_device->CreateRenderTargetView(cubemap, &rtvDesc, rtvHandle);
    m_commandList->OMSetRenderTargets(1, &rtvHandle, FALSE, nullptr);
}
```

That is learnopengl's `glFramebufferTexture2D(…, GL_TEXTURE_CUBE_MAP_POSITIVE_X + i, cubemap, mip)` on its one
`captureFBO`. Reusing one descriptor for all faces works because `OMSetRenderTargets` copies the descriptor's contents
into the command list when it is recorded – RTV heaps are not shader visible –, so the slot is free again right after
the call. No depth buffer and no clear: the cube is seen from its centre, nothing can hide anything, and every pixel of
the face is covered. The capture pipeline states have `DepthEnable = FALSE` and `DSVFormat = DXGI_FORMAT_UNKNOWN`, and
`RTVFormats[0] = DXGI_FORMAT_R16G16B16A16_FLOAT`.
:::

What's left to do is capture the equirectangular 2D texture onto the cubemap faces.

I won't go over the details as the code details topics previously discussed in the *Framebuffers* and *Point Shadows*
chapters, but it effectively boils down to setting up 6 different view matrices (facing each side of the cube), set up
a projection matrix with a fov of 90 degrees to capture the entire face, and render a cube 6 times storing the results
in a floating point framebuffer:

:::opengl
```cpp
    glm::mat4 captureProjection = glm::perspective(glm::radians(90.0f), 1.0f, 0.1f, 10.0f);
    glm::mat4 captureViews[] =
    {
        glm::lookAt(glm::vec3(0.0f, 0.0f, 0.0f), glm::vec3( 1.0f,  0.0f,  0.0f), glm::vec3(0.0f, -1.0f,  0.0f)),
        glm::lookAt(glm::vec3(0.0f, 0.0f, 0.0f), glm::vec3(-1.0f,  0.0f,  0.0f), glm::vec3(0.0f, -1.0f,  0.0f)),
        glm::lookAt(glm::vec3(0.0f, 0.0f, 0.0f), glm::vec3( 0.0f,  1.0f,  0.0f), glm::vec3(0.0f,  0.0f,  1.0f)),
        glm::lookAt(glm::vec3(0.0f, 0.0f, 0.0f), glm::vec3( 0.0f, -1.0f,  0.0f), glm::vec3(0.0f,  0.0f, -1.0f)),
        glm::lookAt(glm::vec3(0.0f, 0.0f, 0.0f), glm::vec3( 0.0f,  0.0f,  1.0f), glm::vec3(0.0f, -1.0f,  0.0f)),
        glm::lookAt(glm::vec3(0.0f, 0.0f, 0.0f), glm::vec3( 0.0f,  0.0f, -1.0f), glm::vec3(0.0f, -1.0f,  0.0f))
    };

    // pbr: convert HDR equirectangular environment map to cubemap equivalent
    // ----------------------------------------------------------------------
    equirectangularToCubemapShader.use();
    equirectangularToCubemapShader.setInt("equirectangularMap", 0);
    equirectangularToCubemapShader.setMat4("projection", captureProjection);
    glActiveTexture(GL_TEXTURE0);
    glBindTexture(GL_TEXTURE_2D, hdrTexture);

    glViewport(0, 0, 128, 128); // don't forget to configure the viewport to the capture dimensions.
    glBindFramebuffer(GL_FRAMEBUFFER, captureFBO);
    for (unsigned int i = 0; i < 6; ++i)
    {
        equirectangularToCubemapShader.setMat4("view", captureViews[i]);
        glFramebufferTexture2D(GL_FRAMEBUFFER, GL_COLOR_ATTACHMENT0, GL_TEXTURE_CUBE_MAP_POSITIVE_X + i, envCubemap, 0);
        glClear(GL_COLOR_BUFFER_BIT | GL_DEPTH_BUFFER_BIT);

        renderCube();
    }
    glBindFramebuffer(GL_FRAMEBUFFER, 0);
```

We take the colour attachment of the framebuffer and switch its texture target around for every face of the cubemap,
directly rendering the scene into one of the cubemap's faces. Once this routine has finished (which we only have to do
once), the cubemap `envCubemap` should be the cubemapped environment version of our original HDR image. Before the
render loop starts, the viewport is set back to the window's size (`glfwGetFramebufferSize` and `glViewport`) – the
capture changed it.

Why the ups of (0, -1, 0) for the four side faces? OpenGL's cube map faces are addressed with the image's origin at the
top left – a convention taken over from RenderMan –, unlike every other OpenGL texture. learnopengl's views render each
picture "upside down" into its face, so that sampling the cube map with a direction gives the right texel.
:::
:::vulkan
`renderToCubemap(pipeline, descriptorSet, cubemapImage, size)` holds learnopengl's matrices and does the six passes:

```cpp
        glm::mat4 captureProjection = glm::perspective(glm::radians(90.0f), 1.0f, 0.1f, 10.0f);
        glm::mat4 captureViews[] = {
            glm::lookAt(glm::vec3(0.0f, 0.0f, 0.0f), glm::vec3( 1.0f,  0.0f,  0.0f), glm::vec3(0.0f, -1.0f,  0.0f)),
            glm::lookAt(glm::vec3(0.0f, 0.0f, 0.0f), glm::vec3(-1.0f,  0.0f,  0.0f), glm::vec3(0.0f, -1.0f,  0.0f)),
            glm::lookAt(glm::vec3(0.0f, 0.0f, 0.0f), glm::vec3( 0.0f,  1.0f,  0.0f), glm::vec3(0.0f,  0.0f,  1.0f)),
            glm::lookAt(glm::vec3(0.0f, 0.0f, 0.0f), glm::vec3( 0.0f, -1.0f,  0.0f), glm::vec3(0.0f,  0.0f, -1.0f)),
            glm::lookAt(glm::vec3(0.0f, 0.0f, 0.0f), glm::vec3( 0.0f,  0.0f,  1.0f), glm::vec3(0.0f, -1.0f,  0.0f)),
            glm::lookAt(glm::vec3(0.0f, 0.0f, 0.0f), glm::vec3( 0.0f,  0.0f, -1.0f), glm::vec3(0.0f, -1.0f,  0.0f))
        };
```

For every face it creates a 2D view of that one layer (`viewInfo.viewType = VK_IMAGE_VIEW_TYPE_2D`,
`subresourceRange.baseArrayLayer = i`, `layerCount = 1`) and a framebuffer with that view as its colour attachment –
the counterpart of `glFramebufferTexture2D(…, GL_TEXTURE_CUBE_MAP_POSITIVE_X + i, …)`. Then it records the six passes
into a one-time command buffer:

```cpp
        VkCommandBuffer commandBuffer = beginSingleTimeCommands();
        ...
        for (uint32_t i = 0; i < 6; ++i) {
            ...
            vkCmdBeginRenderPass(commandBuffer, &renderPassInfo, VK_SUBPASS_CONTENTS_INLINE);

            vkCmdBindPipeline(commandBuffer, VK_PIPELINE_BIND_POINT_GRAPHICS, pipeline);
            vkCmdBindDescriptorSets(commandBuffer, VK_PIPELINE_BIND_POINT_GRAPHICS, pipelineLayout, 0, 1, &descriptorSet, 0, nullptr);

            CapturePushConstants constants{};
            constants.projectionView = captureProjection * captureViews[i];
            vkCmdPushConstants(commandBuffer, pipelineLayout, VK_SHADER_STAGE_VERTEX_BIT | VK_SHADER_STAGE_FRAGMENT_BIT, 0, sizeof(CapturePushConstants), &constants);

            renderCube(commandBuffer);

            vkCmdEndRenderPass(commandBuffer); // face i is now in VK_IMAGE_LAYOUT_SHADER_READ_ONLY_OPTIMAL
        }

        endSingleTimeCommands(commandBuffer); // submits the command buffer and waits until it has run
```

with a viewport and scissor of `size` × `size` before the loop. Afterwards the face views and framebuffers are
destroyed again – they were only needed for these passes. `initVulkan()` calls
`renderToCubemap(equirectangularToCubemapPipeline, hdrDescriptorSet, envCubemapImage, 128)` after the images and
descriptor sets exist and before the command buffer of the frames is created: like learnopengl's capture before its
render loop, it runs once.

A pipeline is made for one render pass and one kind of primitive, so `createPipeline` gets two parameters, the render
pass and the topology: the spheres are a triangle strip in the window's pass, the cube a triangle list in the capture
pass (`equirectangularToCubemapPipeline`) and in the window's pass (`backgroundPipeline`). The images are bound
through descriptor sets: the layout gets one combined image sampler at binding 1, and
`createTextureDescriptorSet(imageView, sampler, descriptorSet)` makes a set with the uniform buffer and one image –
`hdrDescriptorSet` for the HDR image, `envDescriptorSet` for the cube map. Binding one before a draw is Vulkan's
`glBindTexture`. The pool grows to 3 sets.

**No y flip in `captureProjection`.** The window's projection has `proj[1][1] *= -1`, as in every chapter, but the
capture's doesn't. A cube map lookup picks the face and the texel by the same table in OpenGL and Vulkan, so the layers
must hold exactly the texels OpenGL's faces hold. In a capture pass NDC y = -1 lands on a layer's row 0 in Vulkan,
whose framebuffer y points down – and OpenGL writes NDC y = -1 to row 0 as well, because its row 0 is the bottom. So
with learnopengl's matrices unchanged the layers hold the same texels in both APIs. learnopengl's ups of (0, -1, 0) for
the side faces come from the cube map convention (the faces' images have their origin at the top left).
:::
:::d3d12
`LoadAssets` holds learnopengl's matrices, written with DirectXMath:

```cpp
    XMMATRIX captureProjection = XMMatrixPerspectiveFovRH(XMConvertToRadians(90.0f), 1.0f, 0.1f, 10.0f) * XMMatrixScaling(1.0f, -1.0f, 1.0f);
    XMVECTOR eye = XMVectorSet(0.0f, 0.0f, 0.0f, 0.0f);
    XMMATRIX captureViews[] =
    {
        XMMatrixLookAtRH(eye, XMVectorSet( 1.0f,  0.0f,  0.0f, 0.0f), XMVectorSet(0.0f, -1.0f,  0.0f, 0.0f)),
        XMMatrixLookAtRH(eye, XMVectorSet(-1.0f,  0.0f,  0.0f, 0.0f), XMVectorSet(0.0f, -1.0f,  0.0f, 0.0f)),
        XMMatrixLookAtRH(eye, XMVectorSet( 0.0f,  1.0f,  0.0f, 0.0f), XMVectorSet(0.0f,  0.0f,  1.0f, 0.0f)),
        XMMatrixLookAtRH(eye, XMVectorSet( 0.0f, -1.0f,  0.0f, 0.0f), XMVectorSet(0.0f,  0.0f, -1.0f, 0.0f)),
        XMMatrixLookAtRH(eye, XMVectorSet( 0.0f,  0.0f,  1.0f, 0.0f), XMVectorSet(0.0f, -1.0f,  0.0f, 0.0f)),
        XMMatrixLookAtRH(eye, XMVectorSet( 0.0f,  0.0f, -1.0f, 0.0f), XMVectorSet(0.0f, -1.0f,  0.0f, 0.0f))
    };
```

and records the six passes into the command list – the one that also carries the texture uploads and is executed at
the end of `LoadAssets`, before the first frame (learnopengl does its capture before the render loop):

```cpp
        m_commandList->SetPipelineState(m_equirectangularToCubemapPipelineState.Get());
        // The texture the pass reads (root parameter 2): the HDR texture, heap slot 1.
        CD3DX12_GPU_DESCRIPTOR_HANDLE hdrTexture(m_cbvSrvHeap->GetGPUDescriptorHandleForHeapStart(), 1, m_cbvSrvDescriptorSize);
        m_commandList->SetGraphicsRootDescriptorTable(2, hdrTexture);

        CD3DX12_VIEWPORT viewport(0.0f, 0.0f, 128.0f, 128.0f); // don't forget to configure the viewport to the capture dimensions.
        CD3DX12_RECT scissorRect(0, 0, 128, 128);
        m_commandList->RSSetViewports(1, &viewport);
        m_commandList->RSSetScissorRects(1, &scissorRect);

        CaptureConstants captureConstants = {};
        XMStoreFloat4x4(&captureConstants.captureProjection, XMMatrixTranspose(captureProjection));
        for (unsigned int i = 0; i < 6; ++i)
        {
            XMStoreFloat4x4(&captureConstants.captureView, XMMatrixTranspose(captureViews[i]));
            m_commandList->SetGraphicsRoot32BitConstants(0, sizeof(CaptureConstants) / 4, &captureConstants, 0);
            SetCaptureTarget(m_envCubemap.Get(), i, 0);

            // No clear: the cube covers every pixel of the face.
            RenderCube();
        }

        // The cube map is complete: from now on shaders read it.
        CD3DX12_RESOURCE_BARRIER barrier = CD3DX12_RESOURCE_BARRIER::Transition(m_envCubemap.Get(), D3D12_RESOURCE_STATE_RENDER_TARGET, D3D12_RESOURCE_STATE_PIXEL_SHADER_RESOURCE);
        m_commandList->ResourceBarrier(1, &barrier);
```

Like a frame, the passes first need `SetGraphicsRootSignature`, `SetDescriptorHeaps` and the CBV's table. The root
signature now has a third parameter – a table with **one SRV (t0)**, the texture the current pass reads: the HDR image
for the conversion – and the static CLAMP sampler. The barrier turns all six faces into shader resources at once
(`Transition` covers all subresources by default). The viewport needs no restoring: `PopulateCommandList` sets the
window's viewport every frame.

**The y flip in `captureProjection`.** Cube map faces are addressed the same way in OpenGL and Direct3D, but a render
target's first row is the *top* of the picture in Direct3D (NDC y = +1) and the bottom in OpenGL. With learnopengl's
views and ups every face would be stored upside down; the scaling by (1, -1, 1) after the projection puts them right –
the *Point Shadows* chapter's shadow projection did the same. Nothing is culled, so the reversed winding doesn't matter.
learnopengl's ups of (0, -1, 0) for the side faces come from the cube map convention (the faces' images have their
origin at the top left).
:::

:::opengl
```quiz
How does the OpenGL project render into the six faces of `envCubemap`?
- [x] With one framebuffer, `captureFBO`: for each face `glFramebufferTexture2D(GL_FRAMEBUFFER, GL_COLOR_ATTACHMENT0, GL_TEXTURE_CUBE_MAP_POSITIVE_X + i, envCubemap, 0)` attaches that face, then the cube is drawn with that face's view matrix
- [ ] With six framebuffers, each with its own depth renderbuffer, drawn in parallel
- [ ] With one draw call into a layered framebuffer, a geometry shader choosing the face
- [ ] By drawing the cube into the window six times and copying each picture with `glCopyTexImage2D`
---
`GL_TEXTURE_CUBE_MAP_POSITIVE_X + i` are consecutive enum values for +X, -X, +Y, -Y, +Z, -Z, and so are learnopengl's six capture views. (The Point Shadows chapter did use a geometry shader to draw all six faces at once; for a capture done once, six simple passes are fine.)
```
:::
:::vulkan
```quiz
How does the Vulkan project render into the six faces of the environment cube map?
- [ ] With one framebuffer whose attachment is the cube view, and `vkCmdSetViewport` choosing the face
- [ ] With a geometry shader that writes `gl_Layer`, in a single render pass
- [x] For each face a 2D image view of one array layer (`baseArrayLayer = i`) and a framebuffer with it, and six render passes recorded into a one-time command buffer that `initVulkan()` submits and waits for
- [ ] By drawing the cube into the swap chain image six times and copying each picture with `vkCmdCopyImage`
---
A framebuffer's attachments are image views, so a view of one layer is how one face becomes a render target. The cube view over all six layers is a different view of the same image, used for sampling.
```
:::
:::d3d12
```quiz
How does the Direct3D 12 project render into the six faces of `m_envCubemap`?
- [ ] With six separate 2D textures, one per face, combined into a cube map afterwards with `CopyTextureRegion`
- [x] With a render target view of one array slice per face (`D3D12_RTV_DIMENSION_TEXTURE2DARRAY`, `FirstArraySlice = face`, `ArraySize = 1`), written into the one spare RTV descriptor before each draw and bound with `OMSetRenderTargets`
- [ ] With the cube map's `TEXTURECUBE` SRV bound as a render target
- [ ] With a geometry shader that writes `SV_RenderTargetArrayIndex`, in a single draw
---
A render target view names exactly one mip level and the slices it covers. Because `OMSetRenderTargets` reads the descriptor when it is recorded, one descriptor slot can be rewritten for every face.
```
:::

:::opengl
```quiz
learnopengl's capture views use the up vector (0, -1, 0) for the four side faces. Why?
- [ ] Because the camera of the capture stands on its head in every OpenGL program
- [ ] Because OpenGL's NDC y points down
- [x] Because OpenGL's cube map faces are addressed with the image's origin at the top left, unlike other OpenGL textures; with these ups the pictures land in the faces so that a lookup with a direction gives the right texel
- [ ] It has no effect: any up vector gives the same cube map
---
The cube map convention comes from RenderMan. Turn an up vector round and the face's picture is stored upside down – the background would show the sky at the bottom of each side face.
```
:::
:::vulkan
```quiz
The window's projection has `proj[1][1] *= -1`, but the capture projection in `renderToCubemap` doesn't. Why does the cube map still come out right?
- [x] Because a cube map lookup picks the texel by the same table in both APIs, and in both a capture pass writes NDC y = -1 into row 0 of the layer (in Vulkan row 0 is the top of a framebuffer, in OpenGL the bottom – but it is row 0 either way); so learnopengl's unchanged matrices fill the layers with the same texels as OpenGL's faces
- [ ] Because `GLM_FORCE_DEPTH_ZERO_TO_ONE` flips y as well
- [ ] Because the cube is not culled, so a flipped picture is as good as an upright one
- [ ] It doesn't: the background is upside down until the irradiance task flips it back
---
The window needs the flip because there a human looks at the rows; a cube map is never looked at directly, only sampled. What matters is that each texel of each layer is the one the lookup table expects.
```
:::
:::d3d12
```quiz
Why does `captureProjection` end with `* XMMatrixScaling(1.0f, -1.0f, 1.0f)` in the Direct3D 12 project?
- [ ] Because `XMMatrixPerspectiveFovRH` is a left-handed projection that must be mirrored
- [ ] To turn the winding of the cube's triangles round, so that the inside faces are not culled
- [ ] Because Direct3D's cube map faces are stored in a different order than OpenGL's
- [x] Because Direct3D writes the top of the picture (NDC y = +1) into a render target's first row, OpenGL the bottom; cube map faces are addressed the same in both, so without the flip every face would be stored upside down
---
With row vectors the scaling after the projection flips clip-space y. The Point Shadows chapter's shadow projection did the same for the depth cube map; nothing is culled, so the reversed winding doesn't matter.
```
:::

Now do the first task, **environment-map**: load the HDR image, convert it into the cube map once, and draw the cube
map as the background (described next).

### The background

To show the cubemap behind the spheres – it is called a background here, as it is drawn on a cube around the camera –
we need a separate shader, learnopengl's `background` shaders. The vertex shader takes the view matrix without its
translation, so the cube stays around the camera however far it moves, and writes `xyww`: after the perspective divide
the depth is 1.0, the largest value:

:::opengl
```glsl
void main()
{
    WorldPos = aPos;

    mat4 rotView = mat4(mat3(view));
    vec4 clipPos = projection * rotView * vec4(WorldPos, 1.0);

    gl_Position = clipPos.xyww;
}
```
:::
:::vulkan
```glsl
void main() {
    fragWorldPos = inPosition;

    mat4 rotView = mat4(mat3(ubo.view));
    vec4 clipPos = ubo.proj * rotView * vec4(fragWorldPos, 1.0);

    gl_Position = clipPos.xyww;
}
```
:::
:::d3d12
```hlsl
PSInput VSMain(float3 position : POSITION)
{
    PSInput result;

    result.worldPos = position;
    // (float3x3)view is the view matrix without its translation (learnopengl:
    // mat4(mat3(view))): the camera turns, but never gets nearer to the sky.
    float3 viewPosition = mul(position, (float3x3)view);
    float4 clipPos = mul(float4(viewPosition, 1.0f), projection);
    // z = w: after the perspective divide the depth is 1.0, the largest depth value.
    result.position = clipPos.xyww;

    return result;
}
```
:::

The fragment shader samples the cube map with the direction from the cube's centre, at mip level 0 – the environment
map has no others yet – and, as the environment is in HDR, tone-maps and gamma-corrects it like the spheres:

:::opengl
```glsl
void main()
{
    vec3 envColor = textureLod(environmentMap, WorldPos, 0.0).rgb;

    // HDR tonemap and gamma correct
    envColor = envColor / (envColor + vec3(1.0));
    envColor = pow(envColor, vec3(1.0/2.2));

    FragColor = vec4(envColor, 1.0);
}
```

`main.cpp` sets `glDepthFunc(GL_LEQUAL)` once at the start and draws the background last, after the spheres, with
`backgroundShader`, its `projection` and `view`, and `envCubemap` bound:

```cpp
        // render skybox (render as last to prevent overdraw)
        backgroundShader.use();
        backgroundShader.setMat4("projection", projection);
        backgroundShader.setMat4("view", view);
        glActiveTexture(GL_TEXTURE0);
        glBindTexture(GL_TEXTURE_CUBE_MAP, envCubemap);
        renderCube();
```
:::
:::vulkan
```glsl
void main() {
    vec3 envColor = textureLod(environmentMap, fragWorldPos, 0.0).rgb;

    // HDR tonemap and gamma correct
    envColor = envColor / (envColor + vec3(1.0));
    envColor = pow(envColor, vec3(1.0 / 2.2));

    outColor = vec4(envColor, 1.0);
}
```

`createPipeline` sets `depthCompareOp = VK_COMPARE_OP_LESS_OR_EQUAL` (learnopengl's `glDepthFunc(GL_LEQUAL)`) for all
pipelines – it changes nothing for the spheres. `recordCommandBuffer()` draws the background last, after the spheres:

```cpp
        // render skybox (render as last to prevent overdraw)
        vkCmdBindPipeline(commandBuffer, VK_PIPELINE_BIND_POINT_GRAPHICS, backgroundPipeline);
        vkCmdBindDescriptorSets(commandBuffer, VK_PIPELINE_BIND_POINT_GRAPHICS, pipelineLayout, 0, 1, &envDescriptorSet, 0, nullptr);
        renderCube(commandBuffer);
```
:::
:::d3d12
```hlsl
float4 PSMain(PSInput input) : SV_TARGET
{
    float3 envColor = environmentMap.SampleLevel(clampSampler, input.worldPos, 0.0f).rgb;

    // HDR tonemap and gamma correct
    envColor = envColor / (envColor + float3(1.0f, 1.0f, 1.0f));
    envColor = pow(envColor, 1.0f / 2.2f);

    return float4(envColor, 1.0f);
}
```

`m_backgroundPipelineState` is made from the same `psoDesc` as the others, with `background.hlsl`, `RTVFormats[0] =
DXGI_FORMAT_R8G8B8A8_UNORM`, `DepthEnable = TRUE`, `DepthFunc = D3D12_COMPARISON_FUNC_LESS_EQUAL` and `DSVFormat =
DXGI_FORMAT_D32_FLOAT`. `PopulateCommandList` draws the background last, after `RenderScene()`:

```cpp
    m_commandList->SetPipelineState(m_backgroundPipelineState.Get());
    CD3DX12_GPU_DESCRIPTOR_HANDLE envCubemap(m_cbvSrvHeap->GetGPUDescriptorHandleForHeapStart(), 2, m_cbvSrvDescriptorSize);
    m_commandList->SetGraphicsRootDescriptorTable(2, envCubemap);
    RenderCube();
```
:::

The depth test passes for the background only where its depth of 1.0 is less than *or equal to* what the depth buffer
holds – the cleared 1.0 where no sphere is, so the background fills everything around the spheres and nothing in front
of them. Drawing it last means every pixel that a sphere covers fails the depth test early, and the expensive
environment lookup isn't done for it.

```quiz
The background cube is drawn last with `gl_Position = clipPos.xyww` (`xyww` in HLSL) and the depth function less-or-equal. What does that achieve?
- [x] After the perspective divide its depth is w / w = 1.0, the farthest value: it passes the test only where the depth buffer still holds the cleared 1.0, so it appears behind every sphere, and pixels covered by spheres are rejected before its fragment shader runs
- [ ] It moves the cube to the near plane, so that it is drawn in front of the spheres with blending
- [ ] It makes the cube infinitely large, so the depth test is not needed
- [ ] It turns off perspective for the background, so the sky doesn't move when the camera turns
---
With the default less-than test, 1.0 < 1.0 would fail everywhere and the background would vanish. The Cubemaps chapter introduced the same trick for its skybox.
```

Build and run: **the sky appears behind the spheres**. Pale blue-grey at the top, a band of dark green hills on the
horizon – higher on the left of the window –, the grey-brown ground below; it is the right way up. The 128 × 128 faces
are magnified about ten times, so the background is soft. The spheres haven't changed: their ambient term is still the
constant.

Converting an equirectangular HDR image into a cubemap was the first step; a cube map is also what the convolution
needs, and with it the environment shows up properly behind the scene. Now let's get to the actual convolution.

## Cubemap convolution

As described at the start of the chapter, our main goal is to solve the integral for all diffuse indirect lighting
given the scene's irradiance in the form of a cubemap environment map. We know that we can get the radiance of the scene
L(p, ωi) in a particular direction by sampling an HDR environment map in direction ωi. To solve the integral, we have to
sample the scene's radiance from all possible directions within the hemisphere Ω for each fragment.

It is however computationally impossible to sample the environment's lighting from every possible direction in Ω, the
number of possible directions is theoretically infinite. We can however, approximate the number of directions by taking
a finite number of directions or samples, spaced uniformly or taken randomly from within the hemisphere, to get a
fairly accurate approximation of the irradiance; effectively solving the integral discretely.

It is however still too expensive to do this for every fragment in real-time as the number of samples needs to be
significantly large for decent results, so we want to pre-compute this. Since the orientation of the hemisphere decides
where we capture the irradiance, we can pre-calculate the irradiance for every possible hemisphere orientation oriented
around all outgoing directions ωo:

```text
  Lo(p, ωo) = kd · c / π · ∫Ω  Li(p, ωi) · (n · ωi)  dωi
```

Given any direction vector ωi in the lighting pass, we can then sample the pre-computed irradiance map to retrieve the
total diffuse irradiance from direction ωi. To determine the amount of indirect diffuse (irradiant) light at a fragment
surface, we retrieve the total irradiance from the hemisphere oriented around its surface normal. Obtaining the scene's
irradiance is then as simple as:

```glsl
vec3 irradiance = texture(irradianceMap, N).rgb;
```

Now, to generate the irradiance map, we need to convolute the environment's lighting as converted to a cubemap. Given
that for each fragment the surface's hemisphere is oriented along the normal vector N, convoluting a cubemap equals
calculating the total averaged radiance of each direction ωi in the hemisphere Ω oriented along N.

Thankfully, all of the cumbersome setup of this chapter isn't all for nothing as we can now directly take the converted
cubemap, convolute it in a fragment shader, and capture its result in a new cubemap using a framebuffer that renders to
all 6 face directions. As we've already set this up for converting the equirectangular environment map to a cubemap,
we can take the exact same approach but use a different fragment shader.

As the cube we render the cubemap's faces with is centred around the origin, the cube's local position is the sample
direction ωo for each output texel. We take ωo as the normal N of a surface, and sum up the environment over the
hemisphere around it. There are many ways to convolute the environment map, but for this chapter we're going to
generate a fixed amount of sample vectors for each cubemap texel along a hemisphere Ω oriented around the sample
direction and average the results.

The fixed amount of sample vectors will be uniformly spread inside the hemisphere. Note that an integral is a
continuous function and discretely sampling its function given a fixed amount of sample vectors will be an
approximation. The more sample vectors we use, the better we approximate the integral.

The integral ∫ of the reflectance equation revolves around the solid angle dω which is rather difficult to work with.
Instead of integrating over the solid angle dω we'll integrate over its equivalent spherical coordinates θ and φ. We
use the polar azimuth φ angle to sample around the ring of the hemisphere between 0 and 2π, and use the inclination
zenith θ angle between 0 and π/2 to sample the increasing rings of the hemisphere. This will give us the updated
reflectance integral:

```text
  Lo(p, φo, θo) = kd · c / π · ∫(φ = 0..2π) ∫(θ = 0..π/2)  Li(p, φi, θi) · cos(θ) · sin(θ)  dθ dφ
```

Solving the integral requires us to take a fixed number of discrete samples within the hemisphere Ω and averaging their
results. This translates the integral to the following discrete version as based on the Riemann sum given n1 and n2
discrete samples on each spherical coordinate respectively:

```text
  Lo(p, φo, θo) ≈ kd · c / π · (2π / n1) · ((π/2) / n2) · Σφ Σθ  Li(p, φi, θj) · cos(θj) · sin(θj)

                = kd · c · π · (1 / n) · Σ  Li · cos θ · sin θ          (n = n1 · n2 samples)
```

As we sample both spherical values discretely, each sample will approximate or average an area on the hemisphere. Note
that (due to the general properties of a spherical shape) the hemisphere's discrete sample area gets smaller the higher
the zenith angle θ as the sample regions converge towards the centre top. To compensate for the smaller areas, we weigh
its contribution by scaling the area by sin θ.

Discretely sampling the hemisphere given the integral's spherical coordinates translates to the following fragment
code:

:::opengl vulkan
```glsl
    vec3 irradiance = vec3(0.0);

    // tangent space calculation from origin point
    vec3 up    = vec3(0.0, 1.0, 0.0);
    vec3 right = normalize(cross(up, N));
    up         = normalize(cross(N, right));

    float sampleDelta = 0.1;
    float nrSamples = 0.0;
    for(float phi = 0.0; phi < 2.0 * PI; phi += sampleDelta)
    {
        for(float theta = 0.0; theta < 0.5 * PI; theta += sampleDelta)
        {
            // spherical to cartesian (in tangent space)
            vec3 tangentSample = vec3(sin(theta) * cos(phi),  sin(theta) * sin(phi), cos(theta));
            // tangent space to world
            vec3 sampleVec = tangentSample.x * right + tangentSample.y * up + tangentSample.z * N;

            irradiance += texture(environmentMap, sampleVec).rgb * cos(theta) * sin(theta);
            nrSamples++;
        }
    }
    irradiance = PI * irradiance * (1.0 / float(nrSamples));
```

with `vec3 N = normalize(WorldPos);` before (`fragWorldPos` in Vulkan) and the result written as the colour.
:::
:::d3d12
```hlsl
    float3 irradiance = float3(0.0f, 0.0f, 0.0f);

    // tangent space calculation from origin point
    float3 up    = float3(0.0f, 1.0f, 0.0f);
    float3 right = normalize(cross(up, N));
    up           = normalize(cross(N, right));

    float sampleDelta = 0.1f;
    float nrSamples = 0.0f;
    for (float phi = 0.0f; phi < 2.0f * PI; phi += sampleDelta)
    {
        for (float theta = 0.0f; theta < 0.5f * PI; theta += sampleDelta)
        {
            // spherical to cartesian (in tangent space)
            float3 tangentSample = float3(sin(theta) * cos(phi), sin(theta) * sin(phi), cos(theta));
            // tangent space to world
            float3 sampleVec = tangentSample.x * right + tangentSample.y * up + tangentSample.z * N;

            // SampleLevel: inside a loop HLSL wants the mip level spelled out (level 0)
            irradiance += environmentMap.SampleLevel(clampSampler, sampleVec, 0.0f).rgb * cos(theta) * sin(theta);
            nrSamples++;
        }
    }
    irradiance = PI * irradiance * (1.0f / float(nrSamples));
```

with `float3 N = normalize(input.worldPos);` before and the result returned as the colour. learnopengl's `texture(…)`
becomes `SampleLevel(…, 0.0f)`: a plain `Sample` needs screen-space derivatives to choose the mip level, and HLSL does
not allow them in a loop whose number of iterations isn't fixed at compile time; the environment map has only one mip
level here anyway.
:::

We specify a fixed `sampleDelta` delta value to traverse the hemisphere; decreasing or increasing the sample delta will
increase or decrease the accuracy respectively. learnopengl uses 0.025; the course uses **0.1**, which gives 63 × 16 =
1008 samples per texel – 16 times fewer, and still smooth for an environment whose brightest parts are a few degrees
wide.

From within both loops, we take both spherical coordinates to convert them to a 3D Cartesian sample vector, convert the
sample from tangent to world space oriented around the normal, and use this sample vector to directly sample the HDR
environment map. We add each sample result to `irradiance` which at the end we divide by the total number of samples
taken, giving us the average sampled irradiance. Note that we scale the sampled colour value by cos(θ) due to the light
being weaker at larger angles and by sin(θ) to account for the smaller sample areas in the higher hemisphere areas. And
the π in front? It comes from the Riemann sum's step sizes: (2π / n1) · (π/2 / n2) = π² / n, and one π cancels against
the Lambertian 1/π – so the map stores π times the average, and the PBR shader multiplies it by the albedo alone.

Now what's left to do is to set up the capture code such that we can generate this irradiance map: a second cube map,
**32 × 32** per face – the irradiance changes slowly with the direction, so a small map is enough –, and the same six
passes with the convolution's fragment shader reading the environment cube map.

:::opengl
```cpp
    unsigned int irradianceMap;
    glGenTextures(1, &irradianceMap);
    glBindTexture(GL_TEXTURE_CUBE_MAP, irradianceMap);
    for (unsigned int i = 0; i < 6; ++i)
    {
        glTexImage2D(GL_TEXTURE_CUBE_MAP_POSITIVE_X + i, 0, GL_RGB16F, 32, 32, 0, GL_RGB, GL_FLOAT, nullptr);
    }
    glTexParameteri(GL_TEXTURE_CUBE_MAP, GL_TEXTURE_WRAP_S, GL_CLAMP_TO_EDGE);
    glTexParameteri(GL_TEXTURE_CUBE_MAP, GL_TEXTURE_WRAP_T, GL_CLAMP_TO_EDGE);
    glTexParameteri(GL_TEXTURE_CUBE_MAP, GL_TEXTURE_WRAP_R, GL_CLAMP_TO_EDGE);
    glTexParameteri(GL_TEXTURE_CUBE_MAP, GL_TEXTURE_MIN_FILTER, GL_LINEAR);
    glTexParameteri(GL_TEXTURE_CUBE_MAP, GL_TEXTURE_MAG_FILTER, GL_LINEAR);

    glBindFramebuffer(GL_FRAMEBUFFER, captureFBO);
    glBindRenderbuffer(GL_RENDERBUFFER, captureRBO);
    glRenderbufferStorage(GL_RENDERBUFFER, GL_DEPTH_COMPONENT24, 32, 32);
```

As the irradiance map averages all surrounding radiance uniformly it doesn't have a lot of high frequency details, so
we can store the map at a low resolution and let OpenGL's linear filtering do most of the work. Next, we re-scale the
capture framebuffer to the new resolution (the renderbuffer above) and convolute with `irradianceShader`:

```cpp
    irradianceShader.use();
    irradianceShader.setInt("environmentMap", 0);
    irradianceShader.setMat4("projection", captureProjection);
    glActiveTexture(GL_TEXTURE0);
    glBindTexture(GL_TEXTURE_CUBE_MAP, envCubemap);

    glViewport(0, 0, 32, 32); // don't forget to configure the viewport to the capture dimensions.
    glBindFramebuffer(GL_FRAMEBUFFER, captureFBO);
    for (unsigned int i = 0; i < 6; ++i)
    {
        irradianceShader.setMat4("view", captureViews[i]);
        glFramebufferTexture2D(GL_FRAMEBUFFER, GL_COLOR_ATTACHMENT0, GL_TEXTURE_CUBE_MAP_POSITIVE_X + i, irradianceMap, 0);
        glClear(GL_COLOR_BUFFER_BIT | GL_DEPTH_BUFFER_BIT);

        renderCube();
    }
    glBindFramebuffer(GL_FRAMEBUFFER, 0);
```

The code is similar to capturing the environment cubemap. The difference being the different shader
(`Shader irradianceShader("cubemap.vs", "irradiance_convolution.fs");`) and the texture it reads: the environment
cube map instead of the 2D HDR image.
:::
:::vulkan
Everything is there already: the cube map is `createCubemap(32, 1, irradianceImage, irradianceImageMemory,
irradianceImageView)`, the pipeline is `createPipeline("shaders/cubemap.vert.spv",
"shaders/irradiance_convolution.frag.spv", captureRenderPass, VK_PRIMITIVE_TOPOLOGY_TRIANGLE_LIST, irradiancePipeline)`
(the capture render pass fits: the format is the same), and the passes are one more call after the conversion:

```cpp
        // pbr: convert HDR equirectangular environment map to cubemap equivalent
        renderToCubemap(equirectangularToCubemapPipeline, hdrDescriptorSet, envCubemapImage, 128);
        // pbr: solve diffuse integral by convolution to create an irradiance (cube)map.
        renderToCubemap(irradiancePipeline, envDescriptorSet, irradianceImage, 32);
```

The convolution reads the environment cube map, so it gets `envDescriptorSet`. The irradiance map gets its own
`irradianceDescriptorSet` (`createTextureDescriptorSet(irradianceImageView, clampSampler, irradianceDescriptorSet)`; the
pool grows to 4 sets). The first `renderToCubemap` has submitted its command buffer and waited before the second is
recorded, so the environment map is complete when the convolution reads it.
:::
:::d3d12
The cube map `m_irradianceMap` is created like `m_envCubemap` but 32 × 32 (`Tex2D(DXGI_FORMAT_R16G16B16A16_FLOAT, 32, 32,
6, 1, 1, 0, D3D12_RESOURCE_FLAG_ALLOW_RENDER_TARGET)`), its `TEXTURECUBE` SRV in heap slot 3 (the heap grows to 4).
`m_irradiancePipelineState` is the conversion's `psoDesc` with `psoDesc.PS` = `irradiance_convolution.hlsl`'s `PSMain`.
The passes follow the conversion in `LoadAssets`: `SetPipelineState(m_irradiancePipelineState.Get())`, table 2 = heap
slot 2 (the environment cube map, which the barrier has just made a shader resource), a 32 × 32 viewport and scissor
rectangle, the same six-face loop with `SetCaptureTarget(m_irradianceMap.Get(), i, 0)` and `RenderCube()`, and the
barrier to `PIXEL_SHADER_RESOURCE`. The barrier between the two passes is what makes the convolution wait for the
conversion's writes – both are in the same command list.
:::

For now, show the irradiance map as the background: bind it instead of the environment map for the background draw –
the background's shader stays as it is. Now do the task **irradiance-map**.

Build and run: the background is **a very soft blur** with no detail – the hills and the horizon are gone; a pale
grey-violet everywhere, slightly bluer at the top and warmer at the bottom. It is bright even below the horizon: every
direction's hemisphere reaches part of the sky or the sun. This is the light a matt surface facing that direction
receives from the whole environment.

```quiz
In the convolution loop each sample is multiplied by `cos(theta) * sin(theta)`. What is the `sin(theta)` for?
- [ ] It is the Lambertian cosine term n · ωi
- [ ] It makes the irradiance map smoother at the edges of the faces
- [x] The samples are spaced evenly in θ and φ, and such a sample covers a smaller part of the hemisphere the closer it is to the top (θ = 0); sin θ weighs each sample by the area it stands for
- [ ] It converts the radiance from sRGB to linear
---
The solid angle in spherical coordinates is dω = sin θ dθ dφ. The cos θ is the n · ωi of the reflectance equation; the sin θ belongs to the change of variables.
```

## PBR and indirect irradiance lighting

The irradiance map represents the diffuse part of the reflectance integral as accumulated from all surrounding
indirect light. Seeing as the light doesn't come from direct light sources, but from the surrounding environment, we
treat both the diffuse and specular indirect lighting as the ambient lighting, replacing our previously set constant
term.

First, be sure to add the pre-calculated irradiance map as a cube sampler:

:::opengl
```glsl
uniform samplerCube irradianceMap;
```

on texture unit 0 (`pbrShader.setInt("irradianceMap", 0);` once, and in the loop `glActiveTexture(GL_TEXTURE0);
glBindTexture(GL_TEXTURE_CUBE_MAP, irradianceMap);` before the spheres).
:::
:::vulkan
```glsl
layout(binding = 1) uniform samplerCube irradianceMap;
```

The spheres' own `descriptorSet` gets the irradiance map at binding 1: `createDescriptorSet()` adds a
`VkDescriptorImageInfo` (`irradianceImageView`, `clampSampler`, `VK_IMAGE_LAYOUT_SHADER_READ_ONLY_OPTIMAL`) and a second
write with `dstBinding = 1`.
:::
:::d3d12
```hlsl
TextureCube irradianceMap : register(t0);
SamplerState clampSampler : register(s0);
```

t0 is the one SRV of root parameter 2 – for the spheres it is set to the irradiance map before `RenderScene()`:

```cpp
    CD3DX12_GPU_DESCRIPTOR_HANDLE irradianceMap(m_cbvSrvHeap->GetGPUDescriptorHandleForHeapStart(), 3, m_cbvSrvDescriptorSize);
    m_commandList->SetGraphicsRootDescriptorTable(2, irradianceMap);
```

and the background sets it to the environment map (slot 2) again after them.
:::

Given the irradiance map that holds all of the scene's indirect diffuse light, retrieving the irradiance influencing
the fragment is as simple as a single texture sample given the surface normal:

```glsl
// vec3 ambient = vec3(0.03);
vec3 ambient = texture(irradianceMap, N).rgb;
```

However, as the indirect lighting contains both a diffuse and specular part (as we've seen from the split version of
the reflectance equation) we need to weigh the diffuse part accordingly. Similar to what we did in the previous
chapter, we use the Fresnel equation to determine the surface's indirect reflectance ratio from which we derive the
refractive (or diffuse) ratio:

```glsl
vec3 kS = fresnelSchlick(max(dot(N, V), 0.0), F0);
vec3 kD = 1.0 - kS;
vec3 irradiance = texture(irradianceMap, N).rgb;
vec3 diffuse    = irradiance * albedo;
vec3 ambient    = (kD * diffuse) * ao;
```

As the ambient light comes from all directions within the hemisphere oriented around the normal N, there's no single
halfway vector to determine the Fresnel response. To still simulate Fresnel, we calculate the Fresnel from the angle
between the normal and view vector. However, earlier we used the micro-surface halfway vector, influenced by the
roughness of the surface, as input to the Fresnel equation. As we currently don't take roughness into account, the
surface's reflective ratio will always end up relatively high. Indirect light follows the same properties of direct
light so we expect rougher surfaces to reflect less strongly on the surface edges. Because of this, the indirect
Fresnel reflection strength looks off on rough non-metal surfaces.

We can alleviate the issue by injecting a roughness term in the Fresnel-Schlick equation as described by Sébastien
Lagarde:

:::opengl vulkan
```glsl
vec3 fresnelSchlickRoughness(float cosTheta, vec3 F0, float roughness)
{
    return F0 + (max(vec3(1.0 - roughness), F0) - F0) * pow(clamp(1.0 - cosTheta, 0.0, 1.0), 5.0);
}
```
:::
:::d3d12
```hlsl
float3 fresnelSchlickRoughness(float cosTheta, float3 F0, float roughness)
{
    float invRoughness = 1.0f - roughness;
    return F0 + (max(float3(invRoughness, invRoughness, invRoughness), F0) - F0) * pow(clamp(1.0f - cosTheta, 0.0f, 1.0f), 5.0f);
}
```
:::

The grazing-angle reflectance no longer goes up to 1.0 but to `max(1 − roughness, F0)`: a rough surface's edges reflect
less. By taking account of the surface's roughness when calculating the Fresnel response, the ambient code ends up as
(learnopengl's 2.1.2 source file still calls `fresnelSchlick` here; its text introduces `fresnelSchlickRoughness`,
which the course uses):

:::opengl vulkan
```glsl
    // ambient lighting (we now use IBL as the ambient term)
    vec3 kS = fresnelSchlickRoughness(max(dot(N, V), 0.0), F0, roughness);
    vec3 kD = 1.0 - kS;
    kD *= 1.0 - metallic;
    vec3 irradiance = texture(irradianceMap, N).rgb;
    vec3 diffuse    = irradiance * albedo;
    vec3 ambient    = (kD * diffuse) * ao;
```
:::
:::d3d12
```hlsl
    // ambient lighting (we now use IBL as the ambient term)
    float3 kS = fresnelSchlickRoughness(max(dot(N, V), 0.0f), F0, roughness);
    float3 kD = 1.0f - kS;
    kD *= 1.0f - metallic;
    float3 irradiance = irradianceMap.Sample(clampSampler, N).rgb;
    float3 diffuse    = irradiance * albedo;
    float3 ambient    = (kD * diffuse) * ao;
```
:::

As you can see, the actual image based lighting computation is quite simple and only requires a single cubemap texture
lookup; most of the work is in pre-computing or convoluting the irradiance map. Like the direct light's kD, the
ambient kD is multiplied by `1.0 - metallic`: metals have no diffuse reflection, from lamps or from the sky.

```quiz
The ambient term weighs the irradiance with `kD` from `fresnelSchlickRoughness(max(dot(N, V), 0.0), F0, roughness)`. Why with N · V and the roughness, and not with H · V as for the point lights?
- [ ] Because the irradiance map stores the halfway vectors of the environment
- [x] The ambient light comes from the whole hemisphere, so there is no single halfway vector; the angle between normal and view stands in for it, and the roughness term keeps rough surfaces from reflecting as strongly at grazing angles as smooth ones would
- [ ] Because N · V is always 1 for the ambient light
- [ ] Because the roughness makes the irradiance map blurrier
---
Without the roughness term, F rises to 1 at the rims of every sphere and kD falls to 0 there: rough non-metals would get bright, reflective-looking edges and lose their diffuse light. `max(1 − roughness, F0)` caps the rise.
```

Now do the last task, **ambient**: use the irradiance map as the ambient light, and show the environment map as the
background again. Build and run: **the non-metal spheres are lit by the sky**. The bottom rows are clearly brighter and
evenly lit, their upper halves – which face the bright sky – brighter than the lower ones, which face the darker ground;
there are no black sides any more. The metal rows at the top hardly change: metals have no diffuse reflection, and their
reflection of the environment is the next chapter's subject. Only the red channel grows, because the albedo is (0.5, 0,
0). This is learnopengl's `2.1.2.ibl_irradiance`.

It may seem odd at first that the metal spheres look so dark in an environment this bright, but that is what the
diffuse part alone can do: a metal sphere should mirror the sky, and so far nothing in the shader reflects the
environment. The next chapter adds that specular part of the indirect light, and with it the second half of the
reflectance integral.

## Further reading

- *Coding Labs: Physically based rendering*, linked by learnopengl, introduces PBR and the irradiance map and why it is
  built this way.
- Sébastien Lagarde's articles on PBR in the Frostbite engine, which learnopengl credits for the roughness term in the
  Fresnel equation of the indirect light.

:::opengl
- [PBR / IBL / Diffuse irradiance](https://learnopengl.com/PBR/IBL/Diffuse-irradiance): learnopengl's chapter this
  chapter follows, with pictures of the equirectangular map and the irradiance map.
- [ibl_irradiance.cpp](https://github.com/JoeyDeVries/LearnOpenGL/blob/master/src/6.pbr/2.1.2.ibl_irradiance/ibl_irradiance.cpp):
  learnopengl's program.
- [glFramebufferTexture2D](https://registry.khronos.org/OpenGL-Refpages/gl4/html/glFramebufferTexture.xhtml): attaching
  one face (and one mip level) of a cube map.
:::
:::vulkan
- [PBR / IBL / Diffuse irradiance](https://learnopengl.com/PBR/IBL/Diffuse-irradiance): learnopengl's chapter this
  chapter follows, with pictures of the equirectangular map and the irradiance map.
- [VkImageCreateFlagBits](https://registry.khronos.org/vulkan/specs/latest/man/html/VkImageCreateFlagBits.html):
  `VK_IMAGE_CREATE_CUBE_COMPATIBLE_BIT`.
- [Textures (Vulkan specification)](https://docs.vulkan.org/spec/latest/chapters/textures.html): how a cube map lookup
  chooses the face and the texel.
:::
:::d3d12
- [PBR / IBL / Diffuse irradiance](https://learnopengl.com/PBR/IBL/Diffuse-irradiance): learnopengl's chapter this
  chapter follows, with pictures of the equirectangular map and the irradiance map.
- [D3D12_TEX2D_ARRAY_RTV](https://learn.microsoft.com/en-us/windows/win32/api/d3d12/ns-d3d12-d3d12_tex2d_array_rtv): the
  render target view of one face.
- [Format support for Direct3D feature level 11.0 hardware](https://learn.microsoft.com/en-us/windows/win32/direct3ddxgi/format-support-for-direct3d-11-0-feature-level-hardware):
  which formats can be filtered, among them `R32G32B32A32_FLOAT`.
:::
