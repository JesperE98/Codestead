# Cubemaps

We've been using 2D textures for a while now, but there are more texture types we haven't explored yet. In this
chapter we'll discuss a texture type that is a combination of multiple textures mapped into one: a *cube map*.

A cube map is a texture that contains 6 individual 2D textures that each form one side of a cube: a textured cube.
You may be wondering what the point is of such a cube? Why bother combining 6 individual textures into a single
entity instead of just using 6 individual textures? Well, cube maps have the useful property that they can be
indexed/sampled using a direction vector. Imagine we have a 1×1×1 unit cube with the origin of a direction vector
residing at its center. Sampling a texture value from the cube map with a direction vector works like this: the
vector starts in the middle of the cube, points somewhere, and where it pierces the cube's surface – on one of the six
faces – that's the texel we get.

The magnitude of the direction vector doesn't matter. As long as a direction is supplied, the GPU retrieves the
corresponding texel that the direction hits (eventually) and returns the properly sampled texture value.

If we imagine we have a cube shape that we attach such a cube map to, this direction vector would be similar to the
(interpolated) local vertex position of the cube. This way we can sample the cube map using the cube's actual position
vectors as long as the cube is centered on the origin. We thus consider all vertex positions of the cube to be its
texture coordinates when sampling a cube map. The result is a texture coordinate that accesses the proper individual
face texture of the cube map.

```quiz
A cube map is sampled with a direction instead of 2D texture coordinates. What happens if you sample it with (0, 0, -2) instead of (0, 0, -1)?
- [ ] You get a texel twice as far into the -Z face
- [ ] The sample fails: cube map directions must have length 1
- [x] You get the same texel: only the direction counts, not the length
- [ ] You get the texel of the opposite face, +Z
---
The GPU picks the face from the largest component of the vector and divides the other two by it, so any positive multiple of a direction lands on the same texel. That's why the skybox can pass its unnormalized vertex positions straight on.
```

As in the other chapters of this part, everything here exists in every API; the text shows it for {{api}}.

:::opengl
The project starts with the *Depth testing* scene without the floor – learnopengl draws only the two marble cubes in
this chapter: at (-1, 0, -1) and (2, 0, 0), with `glEnable(GL_DEPTH_TEST); glDepthFunc(GL_LESS);`, the camera at
(0, 0, 3) looking down -z, and the shaders `cubemaps.vs` / `cubemaps.fs` that sample `texture1`. The render loop
computes `model`, `view` and `projection` first and has a TODO for the skybox before the cubes are drawn. New files:
`skybox.vs` and `skybox.fs` (their `main` is a TODO), and the six images of the sky in `skybox/`.
:::
:::vulkan
The project starts with the *Depth testing* scene without the floor – learnopengl draws only the two marble cubes in
this chapter: at (-1, 0, -1) and (2, 0, 0), the camera at (0, 0, 3) looking down -z, the cube's 36 vertices (position
and texture coordinates) in the vertex buffer, one descriptor set with the marble, the model matrix in a push constant
and view and projection in the uniform buffer. `createPipeline(vert, frag, pipeline)` creates the pipeline from
`shaders/cubemaps.vert` / `.frag`. New files: `shaders/skybox.vert` and `shaders/skybox.frag` (their `main` is a TODO),
and the six images of the sky in `textures/skybox/`.
:::
:::d3d12
The project starts with the *Depth testing* scene without the floor – learnopengl draws only the two marble cubes in
this chapter: at (-1, 0, -1) and (2, 0, 0), the camera at (0, 0, 3) looking down -z, a PSO with the depth function
LESS and the shaders of `cubemaps.hlsl`. The vertex buffer holds the cube (vertices 0–35, position and texture
coordinates); the CBV/SRV heap holds the CBV (slot 0) and the marble (slot 1). New files: `skybox.hlsl`, which only
has a TODO comment, and the six images of the sky in `skybox/`.
:::

The `// TODO:` comments in the project mark where your code goes. After each task, press **Build & run**
(Ctrl+Enter) to compile the program and run it in the built-in simulator.

## Creating a cubemap

A cube map is a texture like any other texture, so to create one we generate a texture and bind it to the proper
texture target before we do any further texture operations.

:::opengl
This time binding it to `GL_TEXTURE_CUBE_MAP`:

```cpp
    unsigned int textureID;
    glGenTextures(1, &textureID);
    glBindTexture(GL_TEXTURE_CUBE_MAP, textureID);
```

Because a cube map contains 6 textures, one for each face, we have to call `glTexImage2D` six times with their
parameters set similarly to the previous chapters. This time however, we have to set the texture *target* parameter
to match a specific face of the cube map, telling OpenGL which side of the cube map we're creating a texture for.
This means we have to call `glTexImage2D` once for each face of the cube map.

Since we have 6 faces OpenGL gives us 6 special texture targets for targeting a face of the cube map:

| Texture target | Orientation |
| --- | --- |
| `GL_TEXTURE_CUBE_MAP_POSITIVE_X` | Right (+X) |
| `GL_TEXTURE_CUBE_MAP_NEGATIVE_X` | Left (-X) |
| `GL_TEXTURE_CUBE_MAP_POSITIVE_Y` | Top (+Y) |
| `GL_TEXTURE_CUBE_MAP_NEGATIVE_Y` | Bottom (-Y) |
| `GL_TEXTURE_CUBE_MAP_POSITIVE_Z` | +Z |
| `GL_TEXTURE_CUBE_MAP_NEGATIVE_Z` | -Z |

Like many of OpenGL's enums, their behind-the-scenes `int` value is linearly incremented, so if we were to have an
array or vector of texture locations we could loop over them by starting with `GL_TEXTURE_CUBE_MAP_POSITIVE_X` and
incrementing the enum by 1 each iteration, effectively looping through all the texture targets:

```cpp
    int width, height, nrComponents;
    for (unsigned int i = 0; i < faces.size(); i++)
    {
        unsigned char *data = stbi_load(faces[i].c_str(), &width, &height, &nrComponents, 0);
        if (data)
        {
            glTexImage2D(GL_TEXTURE_CUBE_MAP_POSITIVE_X + i, 0, GL_RGB, width, height, 0, GL_RGB, GL_UNSIGNED_BYTE, data);
            stbi_image_free(data);
        }
        ...
    }
```

Here we have a vector called `faces` that contains the locations of all the textures required for the cube map in
the order as given in the table. This generates a texture for each face of the currently bound cube map.

Because a cube map is a texture like any other texture, we will also specify its wrapping and filtering methods:

```cpp
    glTexParameteri(GL_TEXTURE_CUBE_MAP, GL_TEXTURE_MIN_FILTER, GL_LINEAR);
    glTexParameteri(GL_TEXTURE_CUBE_MAP, GL_TEXTURE_MAG_FILTER, GL_LINEAR);
    glTexParameteri(GL_TEXTURE_CUBE_MAP, GL_TEXTURE_WRAP_S, GL_CLAMP_TO_EDGE);
    glTexParameteri(GL_TEXTURE_CUBE_MAP, GL_TEXTURE_WRAP_T, GL_CLAMP_TO_EDGE);
    glTexParameteri(GL_TEXTURE_CUBE_MAP, GL_TEXTURE_WRAP_R, GL_CLAMP_TO_EDGE);
```

Don't be scared by the `GL_TEXTURE_WRAP_R`, this simply sets the wrapping method for the texture's R coordinate which
corresponds to the texture's 3rd dimension (like z for positions). We set the wrapping method to `GL_CLAMP_TO_EDGE`
since texture coordinates that are exactly between two faces may not hit an exact face (due to some hardware
limitations) so by using `GL_CLAMP_TO_EDGE` OpenGL always returns their edge values whenever we sample between faces.

Then before drawing the objects that will use the cube map, we activate the corresponding texture unit and bind the
cube map before rendering; not much of a difference compared to normal 2D textures.

Within the fragment shader we also have to use a different sampler of the type `samplerCube` that we sample from using
the `texture` function, but this time using a `vec3` direction vector instead of a `vec2`:

```glsl
in vec3 textureDir; // direction vector representing a 3D texture coordinate
uniform samplerCube cubemap; // cube map texture sampler

void main()
{
    FragColor = texture(cubemap, textureDir);
}
```
:::
:::vulkan
In Vulkan a cube map is not an image type of its own. It is a 2D image with **6 array layers**, one per face, created
with the flag `VK_IMAGE_CREATE_CUBE_COMPATIBLE_BIT`, and read through an image view of the type
`VK_IMAGE_VIEW_TYPE_CUBE` that covers the six layers. Array layer i is face i, in a fixed order:

| Array layer | Face | OpenGL's target |
| --- | --- | --- |
| 0 | Right (+X) | `GL_TEXTURE_CUBE_MAP_POSITIVE_X` |
| 1 | Left (-X) | `GL_TEXTURE_CUBE_MAP_NEGATIVE_X` |
| 2 | Top (+Y) | `GL_TEXTURE_CUBE_MAP_POSITIVE_Y` |
| 3 | Bottom (-Y) | `GL_TEXTURE_CUBE_MAP_NEGATIVE_Y` |
| 4 | +Z | `GL_TEXTURE_CUBE_MAP_POSITIVE_Z` |
| 5 | -Z | `GL_TEXTURE_CUBE_MAP_NEGATIVE_Z` |

The rules that pick a face and a texel for a direction are the same as OpenGL's, so the same six images give the same
sky. The flag goes into the image's create info, next to the six layers:

```cpp
        // the image: 6 array layers, and the flag that allows a cube view of them
        VkImageCreateInfo imageInfo{};
        imageInfo.sType = VK_STRUCTURE_TYPE_IMAGE_CREATE_INFO;
        imageInfo.flags = VK_IMAGE_CREATE_CUBE_COMPATIBLE_BIT;
        imageInfo.imageType = VK_IMAGE_TYPE_2D;
        imageInfo.extent.width = static_cast<uint32_t>(texWidth);
        imageInfo.extent.height = static_cast<uint32_t>(texHeight);
        imageInfo.extent.depth = 1;
        imageInfo.mipLevels = 1;
        imageInfo.arrayLayers = 6;
        imageInfo.format = VK_FORMAT_R8G8B8A8_UNORM;
        imageInfo.tiling = VK_IMAGE_TILING_OPTIMAL;
        imageInfo.initialLayout = VK_IMAGE_LAYOUT_UNDEFINED;
        imageInfo.usage = VK_IMAGE_USAGE_TRANSFER_DST_BIT | VK_IMAGE_USAGE_SAMPLED_BIT;
        imageInfo.samples = VK_SAMPLE_COUNT_1_BIT;
        imageInfo.sharingMode = VK_SHARING_MODE_EXCLUSIVE;
```

The six faces must be square and all of the same size (ours are 256 × 256). The view is what makes the shader see a
cube instead of six separate pictures:

```cpp
        // a cube view of the six layers: a shader samples it with a direction (samplerCube)
        VkImageViewCreateInfo viewInfo{};
        viewInfo.sType = VK_STRUCTURE_TYPE_IMAGE_VIEW_CREATE_INFO;
        viewInfo.image = image;
        viewInfo.viewType = VK_IMAGE_VIEW_TYPE_CUBE;
        viewInfo.format = VK_FORMAT_R8G8B8A8_UNORM;
        viewInfo.subresourceRange.aspectMask = VK_IMAGE_ASPECT_COLOR_BIT;
        viewInfo.subresourceRange.baseMipLevel = 0;
        viewInfo.subresourceRange.levelCount = 1;
        viewInfo.subresourceRange.baseArrayLayer = 0;
        viewInfo.subresourceRange.layerCount = 6;
```

A cube map is sampled with a sampler like any other texture, so it also gets wrapping and filtering modes. We use
linear filtering and `VK_SAMPLER_ADDRESS_MODE_CLAMP_TO_EDGE`, as learnopengl does with `GL_CLAMP_TO_EDGE`: texture
coordinates that are exactly between two faces may not hit an exact face, and clamping makes sure we always get edge
values there. The project's helper creates it:

```cpp
        createTextureSampler(VK_SAMPLER_ADDRESS_MODE_CLAMP_TO_EDGE, cubemapSampler); // no seams where two faces meet
```

Within the fragment shader we use a different sampler type, `samplerCube`, that we sample from using the `texture`
function, but this time using a `vec3` direction vector instead of a `vec2`:

```glsl
layout(binding = 1) uniform samplerCube skybox;

layout(location = 0) in vec3 fragTexCoord;

layout(location = 0) out vec4 outColor;

void main() {
    outColor = texture(skybox, fragTexCoord);
}
```

The descriptor set layout doesn't change: binding 1 is still a `VK_DESCRIPTOR_TYPE_COMBINED_IMAGE_SAMPLER`. What must
fit is the view: a `samplerCube` in the shader needs a view of the type `VK_IMAGE_VIEW_TYPE_CUBE` in the descriptor.
:::
:::d3d12
In Direct3D 12 a cube map is a 2D texture with **6 array slices**, one per face – `DepthOrArraySize = 6` in its
resource description – and a shader resource view with `D3D12_SRV_DIMENSION_TEXTURECUBE` that shows the six slices to
the shader as one cube. Slice i (subresource i, with one mip level) is face i, in a fixed order:

| Array slice | Face | OpenGL's target |
| --- | --- | --- |
| 0 | Right (+X) | `GL_TEXTURE_CUBE_MAP_POSITIVE_X` |
| 1 | Left (-X) | `GL_TEXTURE_CUBE_MAP_NEGATIVE_X` |
| 2 | Top (+Y) | `GL_TEXTURE_CUBE_MAP_POSITIVE_Y` |
| 3 | Bottom (-Y) | `GL_TEXTURE_CUBE_MAP_NEGATIVE_Y` |
| 4 | +Z | `GL_TEXTURE_CUBE_MAP_POSITIVE_Z` |
| 5 | -Z | `GL_TEXTURE_CUBE_MAP_NEGATIVE_Z` |

The rules that pick a face and a texel for a direction are the same as OpenGL's, so the same six images give the same
sky. The resource description is the one `LoadTexture` uses, with six slices:

```cpp
    D3D12_RESOURCE_DESC textureDesc = {};
    textureDesc.MipLevels = 1;
    textureDesc.Format = DXGI_FORMAT_R8G8B8A8_UNORM;
    textureDesc.Width = static_cast<UINT64>(width);
    textureDesc.Height = static_cast<UINT>(height);
    textureDesc.Flags = D3D12_RESOURCE_FLAG_NONE;
    textureDesc.DepthOrArraySize = 6;
    textureDesc.SampleDesc.Count = 1;
    textureDesc.SampleDesc.Quality = 0;
    textureDesc.Dimension = D3D12_RESOURCE_DIMENSION_TEXTURE2D;
```

The six faces must be square and all of the same size (ours are 256 × 256). The view is what makes the shader see a
cube instead of six separate pictures:

```cpp
    // Describe and create a SRV that sees the six slices as one cube (a TextureCube in HLSL).
    D3D12_SHADER_RESOURCE_VIEW_DESC srvDesc = {};
    srvDesc.Shader4ComponentMapping = D3D12_DEFAULT_SHADER_4_COMPONENT_MAPPING;
    srvDesc.Format = textureDesc.Format;
    srvDesc.ViewDimension = D3D12_SRV_DIMENSION_TEXTURECUBE;
    srvDesc.TextureCube.MostDetailedMip = 0;
    srvDesc.TextureCube.MipLevels = 1;
```

A cube map is sampled with a sampler like any other texture. The project's static sampler `s0` wraps (WRAP), which
is what a repeating 2D texture wants; for the cube map we add a second static sampler at register `s1` that clamps, as
learnopengl does with `GL_CLAMP_TO_EDGE`: texture coordinates that are exactly between two faces may not hit an exact
face, and clamping makes sure we always get edge values there. In `LoadAssets`, the array grows to
`D3D12_STATIC_SAMPLER_DESC samplers[2] = {};` and after `samplers[0]`:

```cpp
        // Sampler s1: the same, but texture coordinates are clamped to the edge (learnopengl's
        // GL_CLAMP_TO_EDGE for the cube map): no filtering across the seams between the faces.
        samplers[1] = samplers[0];
        samplers[1].AddressU = D3D12_TEXTURE_ADDRESS_MODE_CLAMP;
        samplers[1].AddressV = D3D12_TEXTURE_ADDRESS_MODE_CLAMP;
        samplers[1].AddressW = D3D12_TEXTURE_ADDRESS_MODE_CLAMP;
        samplers[1].ShaderRegister = 1;
```

In HLSL a cube map is a `TextureCube`, and its `Sample` method takes a `float3` direction instead of a `float2`:

```hlsl
TextureCube skybox : register(t0);
SamplerState clampSampler : register(s1);

float4 PSMain(PSInput input) : SV_TARGET
{
    return skybox.Sample(clampSampler, input.texCoords);
}
```

The root signature doesn't change: root parameter 2's table still holds one SRV at register `t0`. What must fit is the
view: a `TextureCube` in the shader needs an SRV with `D3D12_SRV_DIMENSION_TEXTURECUBE`.
:::

That is still great and all, but why bother? Well, it just so happens that there are quite a few interesting
techniques that are a lot easier to implement with a cube map. One of those techniques is creating a *skybox*.

## Skybox

A skybox is a (large) cube that encompasses the entire scene and contains 6 images of a surrounding environment,
giving the player the illusion that the environment he's in is actually much larger than it actually is. Some
examples of skyboxes used in videogames are images of mountains, of clouds, or of a starry night sky.

The course has a sky of its own, in six 256 × 256 images: `right.png`, `left.png`, `top.png`, `bottom.png`,
`front.png` and `back.png` – the faces +X, -X, +Y, -Y, +Z and -Z. It shows a blue sky with clouds and a sun, grey
mountains along the horizon, a red and white striped tower, and green chequered fields below the horizon. The images
were made with the cube map rules of the specification, so they join without seams, and their directions are the
world's: the sun lies towards -Z, in front of the default camera (just outside its view, to the top right), the tower
towards +Z, behind the camera. Don't read too much into the file names: they follow learnopengl's list of faces, in
which `front` is +Z – so with the camera looking down -z you look at `back.png`.

If you lay the six faces out flat as an unfolded cube, you get a cross-shaped image: the four horizontal faces in a
row with the top face above and the bottom face below. Seen from inside the cube, they give you the illusion of being
in a large outdoor scene.

### Loading a skybox

Since a skybox is by itself just a cube map, loading a skybox isn't too different from what we've seen at the start
of this chapter. To load the skybox we're going to use the following function that accepts a vector of 6 texture
locations:

:::opengl
```cpp
// loads a cubemap texture from 6 individual texture faces
// order:
// +X (right)
// -X (left)
// +Y (top)
// -Y (bottom)
// +Z (front)
// -Z (back)
// -------------------------------------------------------
unsigned int loadCubemap(std::vector<std::string> faces)
{
    unsigned int textureID;
    glGenTextures(1, &textureID);
    glBindTexture(GL_TEXTURE_CUBE_MAP, textureID);

    // no flip: the cube map rule puts each image's first row (its top) at the top of the face
    stbi_set_flip_vertically_on_load(false);
    int width, height, nrComponents;
    for (unsigned int i = 0; i < faces.size(); i++)
    {
        unsigned char *data = stbi_load(faces[i].c_str(), &width, &height, &nrComponents, 0);
        if (data)
        {
            glTexImage2D(GL_TEXTURE_CUBE_MAP_POSITIVE_X + i, 0, GL_RGB, width, height, 0, GL_RGB, GL_UNSIGNED_BYTE, data);
            stbi_image_free(data);
        }
        else
        {
            std::cout << "Cubemap texture failed to load at path: " << faces[i] << std::endl;
            stbi_image_free(data);
        }
    }
    glTexParameteri(GL_TEXTURE_CUBE_MAP, GL_TEXTURE_MIN_FILTER, GL_LINEAR);
    glTexParameteri(GL_TEXTURE_CUBE_MAP, GL_TEXTURE_MAG_FILTER, GL_LINEAR);
    glTexParameteri(GL_TEXTURE_CUBE_MAP, GL_TEXTURE_WRAP_S, GL_CLAMP_TO_EDGE);
    glTexParameteri(GL_TEXTURE_CUBE_MAP, GL_TEXTURE_WRAP_T, GL_CLAMP_TO_EDGE);
    glTexParameteri(GL_TEXTURE_CUBE_MAP, GL_TEXTURE_WRAP_R, GL_CLAMP_TO_EDGE);

    return textureID;
}
```

The function itself shouldn't be too surprising. It is basically all the cube map code we've seen in the previous
section, but combined in a single manageable function. It goes at the end of `main.cpp`, with its prototype
`unsigned int loadCubemap(std::vector<std::string> faces);` at the top next to `loadTexture`'s (and
`#include <string>` and `#include <vector>`).

One line deserves attention: `stbi_set_flip_vertically_on_load(false)`. Our `loadTexture` flips every image on load,
because OpenGL's v = 0 is the bottom of a 2D texture. Cube maps follow a different rule: the specification puts each
face image's first row – the top of the picture – at the top of the face, as you look at it from inside the cube. So
the faces must be loaded as they are, and since stb_image's flip setting is global, `loadCubemap` switches it off
before loading them.

Now, before we call this function we'll load the appropriate texture paths in a vector in the order as specified by
the cube map enums:

```cpp
    std::vector<std::string> faces
    {
        "skybox/right.png",
        "skybox/left.png",
        "skybox/top.png",
        "skybox/bottom.png",
        "skybox/front.png",
        "skybox/back.png"
    };
    unsigned int cubemapTexture = loadCubemap(faces);
```

At the end of `main`, `glDeleteTextures(1, &cubemapTexture);` deletes it with the marble texture.
:::
:::vulkan
In Vulkan the function loads the six images, copies them one after the other into one staging buffer, creates the
image with six layers, copies face i into layer i and creates the cube view. Its parts are those of vulkan-tutorial's
texture chapter, `createTextureImage`, `transitionImageLayout` and `copyBufferToImage`, extended to six layers:

```cpp
    // learnopengl's loadCubemap: six images -> one cube map. A cube map is an image with 6 array layers, one per face,
    // in the order +X (right), -X (left), +Y (top), -Y (bottom), +Z (front), -Z (back), read through a cube view.
    // The images are not flipped: the cube map rules put each image's first row (its top) at the top of the face.
    void loadCubemap(const std::vector<std::string>& faces, VkImage& image, VkDeviceMemory& imageMemory, VkImageView& imageView) {
        // the six images, all of the same size, as RGBA
        std::array<stbi_uc*, 6> pixels{};
        int texWidth = 0, texHeight = 0, texChannels = 0;
        for (size_t i = 0; i < faces.size(); i++) {
            pixels[i] = stbi_load(faces[i].c_str(), &texWidth, &texHeight, &texChannels, STBI_rgb_alpha);
            if (!pixels[i]) {
                throw std::runtime_error("failed to load cubemap texture " + faces[i] + "!");
            }
        }
        VkDeviceSize faceSize = texWidth * texHeight * 4;

        // one staging buffer with the six faces one after the other
        VkBuffer stagingBuffer;
        VkDeviceMemory stagingBufferMemory;
        createBuffer(faceSize * 6, VK_BUFFER_USAGE_TRANSFER_SRC_BIT, VK_MEMORY_PROPERTY_HOST_VISIBLE_BIT | VK_MEMORY_PROPERTY_HOST_COHERENT_BIT, stagingBuffer, stagingBufferMemory);

        void* data;
        vkMapMemory(device, stagingBufferMemory, 0, faceSize * 6, 0, &data);
        for (size_t i = 0; i < 6; i++) {
            memcpy(static_cast<stbi_uc*>(data) + faceSize * i, pixels[i], static_cast<size_t>(faceSize));
            stbi_image_free(pixels[i]);
        }
        vkUnmapMemory(device, stagingBufferMemory);
```

The image is created with the create info from the previous section, its memory allocated and bound as in
`createImage`. Then come the layout transitions and the copy. The barriers are the ones of `transitionImageLayout`,
but their subresource range covers all six layers – `barrier.subresourceRange.layerCount = 6;` – and the copy has one
region per face:

```cpp
        // face i of the staging buffer -> array layer i (learnopengl: GL_TEXTURE_CUBE_MAP_POSITIVE_X + i)
        std::array<VkBufferImageCopy, 6> regions{};
        for (uint32_t i = 0; i < 6; i++) {
            regions[i].bufferOffset = faceSize * i;
            regions[i].bufferRowLength = 0;
            regions[i].bufferImageHeight = 0;
            regions[i].imageSubresource.aspectMask = VK_IMAGE_ASPECT_COLOR_BIT;
            regions[i].imageSubresource.mipLevel = 0;
            regions[i].imageSubresource.baseArrayLayer = i;
            regions[i].imageSubresource.layerCount = 1;
            regions[i].imageOffset = {0, 0, 0};
            regions[i].imageExtent = {static_cast<uint32_t>(texWidth), static_cast<uint32_t>(texHeight), 1};
        }
        vkCmdCopyBufferToImage(commandBuffer, stagingBuffer, image, VK_IMAGE_LAYOUT_TRANSFER_DST_OPTIMAL, static_cast<uint32_t>(regions.size()), regions.data());
```

The loop with `bufferOffset = faceSize * i` and `baseArrayLayer = i` is learnopengl's loop over
`GL_TEXTURE_CUBE_MAP_POSITIVE_X + i`. After the second barrier (to `VK_IMAGE_LAYOUT_SHADER_READ_ONLY_OPTIMAL`) the
staging buffer is destroyed and the cube view is created. The function goes where its TODO is, next to
`loadTexture`; `faceSize` is the size of one RGBA face in bytes.

Note what the function does *not* do: flip the images. A cube map has its own rule for how a face image lies on the
cube – each image's first row, the top of the picture, at the top of the face as you look at it from inside – and
Vulkan's rule is OpenGL's. The y flip in our projection matrix doesn't change any of this: it only turns the picture
on the screen upright, the directions in the world stay the same. So the images are loaded as they are, and the sky
looks exactly like the OpenGL chapter's.

In `initVulkan()` we list the six files in the order of the layers and call the function after `createCommandPool()`
(it records commands), followed by the sampler:

```cpp
        std::vector<std::string> faces = {
            "textures/skybox/right.png",
            "textures/skybox/left.png",
            "textures/skybox/top.png",
            "textures/skybox/bottom.png",
            "textures/skybox/front.png",
            "textures/skybox/back.png"
        };
        loadCubemap(faces, cubemapImage, cubemapImageMemory, cubemapImageView);
```

The members are `VkImage cubemapImage;`, `VkDeviceMemory cubemapImageMemory;`, `VkImageView cubemapImageView;` and
`VkSampler cubemapSampler;`; `cleanup()` destroys them with the other textures (`#include <string>` for the file
names).
:::
:::d3d12
In Direct3D 12 the function loads the six images, creates the texture with six slices and an upload heap big enough
for all of them, records the copy of the six faces, a barrier, and creates the cube SRV. It is `LoadTexture` extended
to six slices:

```cpp
void D3D12App::LoadCubemap(const std::vector<std::string>& faces, ComPtr<ID3D12Resource>& texture, ComPtr<ID3D12Resource>& uploadHeap, UINT descriptorIndex)
{
    // Load the six images as RGBA. No vertical flip: a face's first row is its top
    // (learnopengl also loads its cube map without the flip).
    int width = 0, height = 0, nrChannels = 0;
    unsigned char* data[6] = {};
    for (UINT i = 0; i < 6; i++)
    {
        data[i] = stbi_load(faces[i].c_str(), &width, &height, &nrChannels, 4);
        if (data[i] == nullptr)
        {
            throw std::runtime_error("Cubemap texture failed to load at path: " + faces[i]);
        }
    }
```

Then the resource description from the previous section, `CreateCommittedResource` in the COPY_DEST state, and an
upload heap. Its size comes from `GetRequiredIntermediateSize(texture.Get(), 0, 6)` – all six subresources, laid out as
the GPU wants them. The copy itself takes one `D3D12_SUBRESOURCE_DATA` per face:

```cpp
    // One D3D12_SUBRESOURCE_DATA per face: subresource i is array slice i, the face
    // GL_TEXTURE_CUBE_MAP_POSITIVE_X + i in OpenGL. UpdateSubresources copies all six into
    // the upload heap now and schedules the copy into the texture.
    D3D12_SUBRESOURCE_DATA faceData[6] = {};
    for (UINT i = 0; i < 6; i++)
    {
        faceData[i].pData = data[i];
        faceData[i].RowPitch = width * 4;
        faceData[i].SlicePitch = faceData[i].RowPitch * height;
    }
    UpdateSubresources(m_commandList.Get(), texture.Get(), uploadHeap.Get(), 0, 0, 6, faceData);
```

`UpdateSubresources(commandList, destination, intermediate, intermediateOffset, firstSubresource, numSubresources,
data)`: subresources 0 to 5 – learnopengl's loop over `GL_TEXTURE_CUBE_MAP_POSITIVE_X + i`. After it, a barrier from
COPY_DEST to PIXEL_SHADER_RESOURCE, the cube SRV in slot `descriptorIndex` of the CBV/SRV heap, and the six images are
freed. The function goes where its TODO is, at the end of the file, and its declaration into the class:

```cpp
    void LoadCubemap(const std::vector<std::string>& faces, ComPtr<ID3D12Resource>& texture, ComPtr<ID3D12Resource>& uploadHeap, UINT descriptorIndex);
```

Note what the function does *not* do: flip the images. A cube map has its own rule for how a face image lies on the
cube – each image's first row, the top of the picture, at the top of the face as you look at it from inside – and
Direct3D's rule is OpenGL's. So the images are loaded as they are, and the sky looks exactly like the OpenGL chapter's.

In `LoadAssets`, after the marble, we list the six files in the order of the slices and load them into a new member
`ComPtr<ID3D12Resource> m_skyboxTexture;`, with the SRV in heap slot 2 (the heap grows to
`cbvSrvHeapDesc.NumDescriptors = 3;`, and `#include <vector>` goes at the top):

```cpp
    std::vector<std::string> faces
    {
        "skybox/right.png",
        "skybox/left.png",
        "skybox/top.png",
        "skybox/bottom.png",
        "skybox/front.png",
        "skybox/back.png"
    };
    ComPtr<ID3D12Resource> skyboxTextureUploadHeap;
    LoadCubemap(faces, m_skyboxTexture, skyboxTextureUploadHeap, 2);
```

The upload heap must stay alive until the command list that copies from it has executed – like the marble's, it is a
local that lives until the end of `LoadAssets`, which waits for the GPU.
:::

Now do the first task, **load-cubemap**, and press **Build & run**. Nothing changes – the cube map is loaded, but
nothing samples it yet. Let's change that.

:::opengl
```quiz
Why does `loadCubemap` call `stbi_set_flip_vertically_on_load(false)` before loading the faces?
- [x] Cube maps put each image's first row at the top of the face, so the faces must not be flipped – and `loadTexture` had switched flipping on for all following loads
- [ ] Cube map faces must be stored upside down
- [ ] `stbi_load` cannot load RGB images with flipping on
- [ ] Flipping would swap the +Y and -Y faces
---
The 2D textures are flipped because OpenGL's v = 0 is the bottom of a 2D texture. The cube map rule is different – the first row is the top of the face – and stb_image's setting is global, so it has to be switched off again.
```
:::
:::vulkan
```quiz
What turns the six layers of `cubemapImage` into a cube map that a `samplerCube` can sample?
- [ ] Copying the faces in the order +X, -X, +Y, -Y, +Z, -Z is enough
- [x] The image is created with `VK_IMAGE_CREATE_CUBE_COMPATIBLE_BIT` and read through a `VK_IMAGE_VIEW_TYPE_CUBE` view of all six layers
- [ ] A special descriptor type for cube maps in the descriptor set layout
- [ ] The sampler's `VK_SAMPLER_ADDRESS_MODE_CLAMP_TO_EDGE`
---
The image is an ordinary 2D image with six layers; the flag allows a cube view of it, and the cube view is what the shader samples with a direction. The descriptor is still a combined image sampler.
```
:::
:::d3d12
```quiz
What turns the six slices of `m_skyboxTexture` into a cube map that a `TextureCube` can sample?
- [ ] A special resource dimension for cube maps in the resource description
- [ ] The static sampler `s1` with its CLAMP address mode
- [x] Its SRV has `ViewDimension = D3D12_SRV_DIMENSION_TEXTURECUBE`: the view shows the six slices of the 2D texture to the shader as one cube
- [ ] `UpdateSubresources` with six subresources
---
The resource is a 2D texture with `DepthOrArraySize = 6`; the TEXTURECUBE view is what makes the shader see a cube it can sample with a direction. The root signature still just holds an SRV at `t0`.
```
:::

### Displaying a skybox

Because a skybox is drawn on a cube we'll need another VAO, VBO and a fresh set of vertices like any other 3D object.
The skybox is a cube from -1 to 1 around the origin; its vertices only need positions, because the position is the
direction we sample with.

:::opengl
learnopengl's `skyboxVertices` are 36 vertices with 3 floats each:

```cpp
    float skyboxVertices[] = {
        // positions
        -1.0f,  1.0f, -1.0f,
        -1.0f, -1.0f, -1.0f,
         1.0f, -1.0f, -1.0f,
         1.0f, -1.0f, -1.0f,
         1.0f,  1.0f, -1.0f,
        -1.0f,  1.0f, -1.0f,
        ...
    };
```

(the full list is in the task's hint and the solution), with a VAO that has just one attribute:

```cpp
    // skybox VAO
    unsigned int skyboxVAO, skyboxVBO;
    glGenVertexArrays(1, &skyboxVAO);
    glGenBuffers(1, &skyboxVBO);
    glBindVertexArray(skyboxVAO);
    glBindBuffer(GL_ARRAY_BUFFER, skyboxVBO);
    glBufferData(GL_ARRAY_BUFFER, sizeof(skyboxVertices), &skyboxVertices, GL_STATIC_DRAW);
    glEnableVertexAttribArray(0);
    glVertexAttribPointer(0, 3, GL_FLOAT, GL_FALSE, 3 * sizeof(float), (void*)0);
    glBindVertexArray(0);
```
:::
:::vulkan
All vertices live in one vertex buffer, so learnopengl's `skyboxVertices` are appended to `vertices`, after the cube –
they become vertices 36..71. A `Vertex` has a position and texture coordinates; the skybox only needs the position, so
each vertex gives just that, and the texture coordinates are value-initialized to zero:

```cpp
    // skybox: vertices 36..71, learnopengl's skyboxVertices - a cube from -1 to 1 around the origin, positions only
    // (the texture coordinates stay 0: the skybox's shader does not read them)
    {{-1.0f,  1.0f, -1.0f}},
    {{-1.0f, -1.0f, -1.0f}},
    {{ 1.0f, -1.0f, -1.0f}},
    {{ 1.0f, -1.0f, -1.0f}},
    {{ 1.0f,  1.0f, -1.0f}},
    {{-1.0f,  1.0f, -1.0f}},
    ...
```

(the full list is in the solution.)
:::
:::d3d12
All vertices live in one vertex buffer, so learnopengl's `skyboxVertices` go at the end of `vertices[]`, after the
cube – they become vertices 36 to 71. A `Vertex` has a position and texture coordinates; the skybox only needs the
position, and `{}` leaves the other attribute at zero:

```cpp
            // the skybox: vertices 36 to 71 - a cube from -1 to 1 around the origin. Only the
            // positions matter: they are the directions the skybox shader samples the cube
            // map in. {} leaves the other attribute at zero (the skybox shader does not read it).
            { { -1.0f,  1.0f, -1.0f }, {} },
            { { -1.0f, -1.0f, -1.0f }, {} },
            { {  1.0f, -1.0f, -1.0f }, {} },
            { {  1.0f, -1.0f, -1.0f }, {} },
            { {  1.0f,  1.0f, -1.0f }, {} },
            { { -1.0f,  1.0f, -1.0f }, {} },
            ...
```

(the full list is in the solution.)
:::

A cube map used to texture a 3D cube can be sampled using the local positions of the cube as its texture coordinates.
When a cube is centered on the origin (0,0,0) each of its position vectors is also a direction vector from the
origin. This direction vector is exactly what we need to get the corresponding texture value at that specific cube's
position. For this reason we only need to supply position vectors and don't need texture coordinates.

To render the skybox we'll need a new set of shaders which aren't too complicated. Because we only have one vertex
attribute the vertex shader is quite simple:

:::opengl
```glsl
#version 330 core
layout (location = 0) in vec3 aPos;

out vec3 TexCoords;

uniform mat4 projection;
uniform mat4 view;

void main()
{
    TexCoords = aPos; // the direction from the centre of the cube to the vertex
    gl_Position = projection * view * vec4(aPos, 1.0);
}
```

The interesting part of this vertex shader is that we set the incoming local position vector as the outcoming texture
coordinate for (interpolated) use in the fragment shader. The fragment shader then takes these as input to sample a
`samplerCube`:

```glsl
#version 330 core
out vec4 FragColor;

in vec3 TexCoords;

uniform samplerCube skybox;

void main()
{
    FragColor = texture(skybox, TexCoords);
}
```
:::
:::vulkan
```glsl
void main() {
    fragTexCoord = inPosition; // the direction from the centre of the cube to the vertex
    mat4 view = mat4(mat3(ubo.view)); // remove translation from the view matrix: the sky never comes nearer
    gl_Position = ubo.proj * view * vec4(inPosition, 1.0);
}
```

The interesting part of this vertex shader is that we set the incoming local position vector as the outcoming texture
coordinate for (interpolated) use in the fragment shader. The fragment shader then takes these as input to sample the
`samplerCube`, as shown above: `outColor = texture(skybox, fragTexCoord);`. (The `mat3` line follows in a moment.)
:::
:::d3d12
The skybox's shaders go into `skybox.hlsl`. They declare the cube map, the clamping sampler and the scene's constant
buffer with the two matrices:

```hlsl
// The cube map: register t0, in the descriptor table of root parameter 2.
TextureCube skybox : register(t0);
// The sampler: register s1, the static sampler that clamps to the edge.
SamplerState clampSampler : register(s1);

// The constant buffer at register b1 (the CBV in root parameter 1's table): the
// view and projection matrices, the same for every draw of a frame.
cbuffer SceneConstantBuffer : register(b1)
{
    float4x4 view;
    float4x4 projection;
};

// What the vertex shader hands on to the rasterizer and the pixel shader.
struct PSInput
{
    float4 position : SV_POSITION;
    float3 texCoords : TEXCOORD;    // a direction, not a point on a 2D image
};

// The vertex shader: the skybox stays around the camera, however far it moves.
PSInput VSMain(float3 position : POSITION)
{
    PSInput result;

    // The direction from the centre of the cube to the vertex.
    result.texCoords = position;
    // (float3x3)view is the view matrix without its translation (learnopengl:
    // mat4(mat3(view))): the camera turns, but never gets nearer to the sky.
    float3 viewPosition = mul(position, (float3x3)view);
    result.position = mul(float4(viewPosition, 1.0f), projection);

    return result;
}
```

The interesting part of this vertex shader is that we set the incoming local position vector as the outcoming texture
coordinate for (interpolated) use in the pixel shader. The pixel shader then takes these as input to sample the
`TextureCube`, as shown above: `return skybox.Sample(clampSampler, input.texCoords);`. The vertex shader reads only
the `POSITION` element of the input layout; the `TEXCOORD` element is still in the layout, but a vertex shader may
ignore elements it doesn't declare. (The `float3x3` line follows in a moment.)
:::

The fragment shader is relatively straightforward. We take the vertex attribute's interpolated position vector as the
texture's direction vector and use it to sample the texture values from the cube map.

Rendering the skybox is easy now that we have a cube map texture: we simply bind the cube map texture and the skybox
sampler is automatically filled with the skybox cube map. To draw the skybox we're going to draw it as the first
object in the scene and disable depth writing. This way the skybox will always be drawn at the background of all the
other objects since the unit cube is most likely smaller than the rest of the scene.

:::opengl
```cpp
        // skybox: drawn first and without writing to the depth buffer, so everything else is drawn in front of it
        glDepthMask(GL_FALSE);
        skyboxShader.use();
        skyboxShader.setMat4("view", glm::mat4(glm::mat3(view))); // remove translation from the view matrix
        skyboxShader.setMat4("projection", projection);
        glBindVertexArray(skyboxVAO);
        glBindTexture(GL_TEXTURE_CUBE_MAP, cubemapTexture);
        glDrawArrays(GL_TRIANGLES, 0, 36);
        glBindVertexArray(0);
        glDepthMask(GL_TRUE);
```

The shader program is `Shader skyboxShader("skybox.vs", "skybox.fs");`, and in the shader configuration its sampler
is set to texture unit 0 (`skyboxShader.use(); skyboxShader.setInt("skybox", 0);`). The VAO and VBO are deleted at the
end of `main`.
:::
:::vulkan
In Vulkan, "disable depth writing" is part of the pipeline: `depthStencil.depthWriteEnable = VK_FALSE`. The skybox
therefore needs a pipeline of its own, `skyboxPipeline`, and `createPipeline` gets three new parameters – how many
vertex attributes the pipeline describes, whether it writes depth, and its compare op (needed in the next section):

```cpp
    void createPipeline(const std::string& vertShaderFile, const std::string& fragShaderFile, uint32_t attributeCount, VkBool32 depthWriteEnable, VkCompareOp depthCompareOp, VkPipeline& pipeline) {
```

Inside, `vertexInputInfo.vertexAttributeDescriptionCount = attributeCount;` describes only the first `attributeCount`
attributes of a `Vertex`, and the depth state uses the parameters:

```cpp
        depthStencil.depthWriteEnable = depthWriteEnable;
        depthStencil.depthCompareOp = depthCompareOp;
```

The skybox's shader reads only the position, so its pipeline describes only attribute 0 (a described attribute the
shader doesn't read would earn a performance warning from the validation layer). In `initVulkan()`:

```cpp
        createPipeline("shaders/cubemaps.vert.spv", "shaders/cubemaps.frag.spv", 2, VK_TRUE, VK_COMPARE_OP_LESS, graphicsPipeline); // position and texture coordinates
        // the skybox only needs the position, and it does not write to the depth buffer: everything drawn after it is
        // drawn in front of it
        createPipeline("shaders/skybox.vert.spv", "shaders/skybox.frag.spv", 1, VK_FALSE, VK_COMPARE_OP_LESS, skyboxPipeline);
```

The cube map reaches the shader through a descriptor set of its own, `skyboxDescriptorSet`, made with the project's
helper (the pool now needs room for 2 sets: `maxSets = 2` and a `descriptorCount` of 2 for both pool sizes):

```cpp
        createDescriptorSet(cubemapImageView, cubemapSampler, skyboxDescriptorSet);
```

In `recordCommandBuffer()`, after the vertex buffer is bound and before the cubes, the skybox is drawn first:

```cpp
        // skybox: drawn first and without writing to the depth buffer, so everything else is drawn in front of it
        vkCmdBindPipeline(commandBuffer, VK_PIPELINE_BIND_POINT_GRAPHICS, skyboxPipeline);
        vkCmdBindDescriptorSets(commandBuffer, VK_PIPELINE_BIND_POINT_GRAPHICS, pipelineLayout, 0, 1, &skyboxDescriptorSet, 0, nullptr);
        vkCmdDraw(commandBuffer, 36, 1, 36, 0); // the skybox's 36 vertices start at vertex 36
```

The cubes then bind `graphicsPipeline` and their own descriptor set as before. `skyboxPipeline` is destroyed in
`cleanup()` with the other pipeline.
:::
:::d3d12
In Direct3D 12, "disable depth writing" is part of the pipeline state object's depth stencil state:
`DepthWriteMask = D3D12_DEPTH_WRITE_MASK_ZERO` keeps the depth test, but writes nothing. The skybox therefore needs a
PSO of its own, `m_skyboxPipelineState` – the scene's description with the shaders of `skybox.hlsl`, created right
after `m_pipelineState`:

```cpp
        // The skybox's pipeline state: the same description with the shaders of skybox.hlsl,
        // and the depth test on but no depth writes (learnopengl: glDepthMask(GL_FALSE)).
        ComPtr<ID3DBlob> skyboxVertexShader;
        ComPtr<ID3DBlob> skyboxPixelShader;
        ThrowIfFailed(D3DCompileFromFile(L"skybox.hlsl", nullptr, nullptr, "VSMain", "vs_5_0", compileFlags, 0, &skyboxVertexShader, nullptr));
        ThrowIfFailed(D3DCompileFromFile(L"skybox.hlsl", nullptr, nullptr, "PSMain", "ps_5_0", compileFlags, 0, &skyboxPixelShader, nullptr));
        psoDesc.VS = CD3DX12_SHADER_BYTECODE(skyboxVertexShader.Get());
        psoDesc.PS = CD3DX12_SHADER_BYTECODE(skyboxPixelShader.Get());
        psoDesc.DepthStencilState.DepthWriteMask = D3D12_DEPTH_WRITE_MASK_ZERO;
        ThrowIfFailed(m_device->CreateGraphicsPipelineState(&psoDesc, IID_PPV_ARGS(&m_skyboxPipelineState)));
```

In `PopulateCommandList` we need the GPU handle of the cube map's SRV next to the marble's:

```cpp
    CD3DX12_GPU_DESCRIPTOR_HANDLE skyboxTexture(m_cbvSrvHeap->GetGPUDescriptorHandleForHeapStart(), 2, m_cbvSrvDescriptorSize);
```

and before the cubes, the skybox is drawn first:

```cpp
    // skybox: drawn first and without writing to the depth buffer, so everything else is
    // drawn in front of it. Its own pipeline state, the cube map, 36 vertices from vertex 36 on.
    m_commandList->SetPipelineState(m_skyboxPipelineState.Get());
    m_commandList->SetGraphicsRootDescriptorTable(2, skyboxTexture);
    m_commandList->DrawInstanced(36, 1, 36, 0);
    m_commandList->SetPipelineState(m_pipelineState.Get());    // back to the scene's pipeline state
```

The last line matters: the pipeline state is set on the command list and stays until the next `SetPipelineState`, so
the cubes would otherwise be drawn with the skybox's shaders.
:::

If you were to run this, you would get into difficulties though. We want the skybox to be centered around the player
so that no matter how far the player moves, the skybox won't get any closer, giving the impression the surrounding
environment is extremely large. The current view matrix however transforms all the skybox's positions by rotating,
scaling and translating them, so if the player moves, the cube map moves as well! We want to remove the translation
part of the view matrix so only rotation will affect the skybox's position vectors.

You may remember from the basic lighting chapter that we can remove the translation section of transformation
matrices by taking the upper-left 3×3 matrix of the 4×4 matrix. We can achieve this by converting the view matrix to a
3×3 matrix (removing translation) and converting it back to a 4×4 matrix:

:::opengl
```cpp
        skyboxShader.setMat4("view", glm::mat4(glm::mat3(view))); // remove translation from the view matrix
```

This removes any translation, but keeps all rotation transformations so the user can still look around the scene. It
is the line in the code above: the skybox gets its own view matrix, without the translation, while the cubes keep
using the full one.
:::
:::vulkan
```glsl
    mat4 view = mat4(mat3(ubo.view)); // remove translation from the view matrix: the sky never comes nearer
```

This removes any translation, but keeps all rotation transformations so the user can still look around the scene.
learnopengl does this in C++ and hands the skybox shader a view matrix of its own; our project has one uniform buffer
for all pipelines, so the skybox's vertex shader does it itself.
:::
:::d3d12
```hlsl
    float3 viewPosition = mul(position, (float3x3)view);
```

This removes any translation, but keeps all rotation transformations so the user can still look around the scene.
learnopengl does this in C++ and hands the skybox shader a view matrix of its own; our project has one constant buffer
for all draws, so the skybox's vertex shader does it itself. The cast `(float3x3)view` keeps the upper-left 3×3 part
of the matrix – the rotation – and drops the translation; multiplying the result with the projection then needs a
`float4` again, with w = 1.
:::

```quiz
Why does the skybox use the view matrix without its translation?
- [ ] The translation would turn the skybox inside out
- [ ] Without it the skybox is drawn faster
- [ ] A cube map cannot be sampled with translated positions
- [x] The sky must stay centered on the camera: turning the camera should change what you see of it, moving it should not bring any side of the sky closer
---
With the translation removed, the skybox cube moves with the camera, so the sky seems infinitely far away. The rotation stays, so looking around still shows other parts of the sky.
```

Now do the task **skybox** and press **Build & run**. The dark grey background is gone: behind the cubes there is a
blue sky with clouds, grey mountains along the horizon in the middle of the window, a light haze along the horizon
and green chequered fields below it. In the top right corner the sky is brighter – the sun is just outside the
view. The cubes are unchanged and stand in front of the sky. Move the camera around with the mouse and the WASD keys:
the sky turns with you when you look around, but you never get any closer to the mountains.

## An optimization

Right now we've rendered the skybox first before we rendered all the other objects in the scene. This works great,
but isn't too efficient. If we render the skybox first we're running the fragment shader for each pixel on the
screen even though only a small part of the skybox will eventually be visible; fragments that could have easily been
discarded using *early depth testing* saving us valuable bandwidth.

So to give us a slight performance boost we're going to render the skybox last. This way, the depth buffer is
completely filled with all the scene's depth values so we only have to render the skybox's fragments wherever the
early depth test passes, greatly reducing the number of fragment shader calls. The problem is that the skybox will
most likely render on top of all other objects since it's only a small cube around the camera (from -1 to 1),
succeeding most depth tests. Simply
rendering it without depth testing is not a solution since the skybox will then still overwrite all the other objects
in the scene as it's rendered last. We need to trick the depth buffer into believing that the skybox has the maximum
depth value of 1.0 so that it fails the depth test wherever there's a different object in front of it.

In the coordinate systems chapter we said that *perspective division* is performed after the vertex shader has run,
dividing the `gl_Position`'s xyz coordinates by its w component. We also know from the depth testing chapter that
the z component of the resulting division is equal to that vertex's depth value. Using this information we can set
the z component of the output position equal to its w component which will result in a z component that is always
equal to `1.0`, because when the perspective division is applied its z component translates to w / w = 1.0:

:::opengl
```glsl
void main()
{
    TexCoords = aPos; // the direction from the centre of the cube to the vertex
    vec4 pos = projection * view * vec4(aPos, 1.0);
    gl_Position = pos.xyww; // z = w: after the perspective divide the depth is 1.0, the largest depth value
}
```
:::
:::vulkan
```glsl
void main() {
    fragTexCoord = inPosition; // the direction from the centre of the cube to the vertex
    mat4 view = mat4(mat3(ubo.view)); // remove translation from the view matrix: the sky never comes nearer
    vec4 pos = ubo.proj * view * vec4(inPosition, 1.0);
    gl_Position = pos.xyww; // z = w: after the perspective divide the depth is 1.0, the largest depth value
}
```

In Vulkan the depth range after the perspective division is 0..1 (OpenGL's is -1..1, mapped to 0..1 afterwards), but
the far end is 1.0 in both, so the trick works unchanged.
:::
:::d3d12
```hlsl
    float3 viewPosition = mul(position, (float3x3)view);
    float4 pos = mul(float4(viewPosition, 1.0f), projection);
    // z = w: after the perspective divide the depth is 1.0, the largest depth value.
    result.position = pos.xyww;
```

In Direct3D the depth range after the perspective division is 0..1 (OpenGL's is -1..1, mapped to 0..1 afterwards),
but the far end is 1.0 in both, so the trick works unchanged.
:::

The resulting normalized device coordinates will then always have a z value equal to `1.0`: the maximum depth value.
The skybox will as a result only be rendered wherever there are no objects visible (only then it will pass the depth
test, everything else is in front of the skybox).

We do have to change the depth function a little by setting it to "less or equal" instead of the default "less". The
depth buffer will be filled with values of `1.0` for the skybox, so we need to make sure the skybox passes the depth
tests with values *less than or equal* to the depth buffer instead of *less than*:

:::opengl
```cpp
        // draw skybox as last
        glDepthFunc(GL_LEQUAL);  // change depth function so depth test passes when values are equal to depth buffer's content
        skyboxShader.use();
        skyboxShader.setMat4("view", glm::mat4(glm::mat3(view))); // remove translation from the view matrix
        skyboxShader.setMat4("projection", projection);
        glBindVertexArray(skyboxVAO);
        glBindTexture(GL_TEXTURE_CUBE_MAP, cubemapTexture);
        glDrawArrays(GL_TRIANGLES, 0, 36);
        glBindVertexArray(0);
        glDepthFunc(GL_LESS); // set depth function back to default
```

This block replaces the old skybox block and goes after the cubes. The `glDepthMask` calls are gone: the skybox may
write its depth now – it is the last thing drawn, and 1.0 is what the depth buffer held there anyway.
:::
:::vulkan
In Vulkan the compare op is part of the pipeline, so the skybox's pipeline is created with
`VK_COMPARE_OP_LESS_OR_EQUAL`:

```cpp
        // the skybox only needs the position; drawn last at depth 1.0, it passes the test where the depth buffer still
        // holds 1.0 (LESS_OR_EQUAL), and it never needs to write depth
        createPipeline("shaders/skybox.vert.spv", "shaders/skybox.frag.spv", 1, VK_FALSE, VK_COMPARE_OP_LESS_OR_EQUAL, skyboxPipeline);
```

and its three commands move from before the cubes to after them, right before `vkCmdEndRenderPass`:

```cpp
        // draw skybox as last: its pipeline passes the depth test when the depth equals the buffer's content (1.0),
        // so the sky is only drawn where nothing else was
        vkCmdBindPipeline(commandBuffer, VK_PIPELINE_BIND_POINT_GRAPHICS, skyboxPipeline);
        vkCmdBindDescriptorSets(commandBuffer, VK_PIPELINE_BIND_POINT_GRAPHICS, pipelineLayout, 0, 1, &skyboxDescriptorSet, 0, nullptr);
        vkCmdDraw(commandBuffer, 36, 1, 36, 0); // the skybox's 36 vertices start at vertex 36
```

There's no need to "set the depth function back" afterwards as in OpenGL: the compare op belongs to `skyboxPipeline`,
and the cubes' pipeline keeps `VK_COMPARE_OP_LESS`.
:::
:::d3d12
In Direct3D 12 the depth function is part of the PSO, so the skybox's PSO gets `D3D12_COMPARISON_FUNC_LESS_EQUAL` – the
line with `DepthWriteMask` becomes:

```cpp
        psoDesc.DepthStencilState.DepthFunc = D3D12_COMPARISON_FUNC_LESS_EQUAL;
```

The skybox may write its depth now – it is the last thing drawn, and 1.0 is what the depth buffer held there anyway.
Its three calls move from before the cubes to after them, before the barrier that ends the frame:

```cpp
    // skybox: drawn last, only where nothing else has been drawn (the depth test with
    // LESS_EQUAL against the cleared 1.0) - the pixels the cubes cover are not shaded twice.
    m_commandList->SetPipelineState(m_skyboxPipelineState.Get());
    m_commandList->SetGraphicsRootDescriptorTable(2, skyboxTexture);
    m_commandList->DrawInstanced(36, 1, 36, 0);
```

`SetPipelineState(m_pipelineState.Get())` is no longer needed: the command list starts with `m_pipelineState` (it is
passed to `Reset`), and the skybox is now the last draw. There's no need to "set the depth function back" either, as
in OpenGL: it belongs to the skybox's PSO.
:::

```quiz
The skybox is drawn last with its depth forced to 1.0. Why does it need the "less or equal" depth function instead of "less"?
- [ ] "Less" would let the skybox overwrite the cubes
- [x] Where nothing was drawn, the depth buffer still holds its cleared value 1.0, and 1.0 < 1.0 is false – with "less" the sky would never be drawn
- [ ] "Less or equal" makes the GPU skip the fragment shader for the skybox
- [ ] With "less" the skybox would be drawn twice
---
The depth buffer is cleared to 1.0 and the skybox's fragments all have depth 1.0. Only "equal" lets them pass on the empty pixels, while anything nearer – the cubes – keeps them out.
```

Now do the task **skybox-last** and press **Build & run**. Nothing visible changes – which is the point: the picture
is the same, but the fragment shader of the skybox no longer runs for the pixels the cubes cover.

## Environment mapping

We now have the entire surrounding environment mapped in a single texture object and we could use that information
for more than just a skybox. Using a cube map with an environment, we could give objects reflective or refractive
properties. Techniques that use an environment cube map like this are called *environment mapping* techniques and the
two most popular ones are *reflection* and *refraction*.

### Reflection

Reflection is the property that an object (or part of an object) reflects its surrounding environment e.g. the
object's colours are more or less equal to its environment based on the angle of the viewer. A mirror for example is
a reflective object: it reflects its surroundings based on the viewer's angle.

The basics of reflection are not that difficult. We calculate a reflection vector R around the object's normal vector
N based on the view direction vector I – the vector from the camera to the fragment. We can calculate this reflection
vector using {{shaderLanguage}}'s built-in `reflect` function. The resulting vector R is then used as a direction
vector to index/sample the cube map, returning a colour value of the environment. The resulting effect is that the
object seems to reflect the skybox.

Since we already have a skybox setup in our scene, creating reflections isn't too difficult. We'll change the fragment
shader used by the cubes to give the cubes reflective properties. To calculate the reflection vector we need the
fragment's position, the camera's position and the normal at the fragment. So the cube's vertices get normals instead
of texture coordinates, and the camera position goes to the fragment shader.

:::opengl
```glsl
#version 330 core
out vec4 FragColor;

in vec3 Normal;
in vec3 Position;

uniform vec3 cameraPos;
uniform samplerCube skybox;

void main()
{
    vec3 I = normalize(Position - cameraPos);
    vec3 R = reflect(I, normalize(Normal));
    FragColor = vec4(texture(skybox, R).rgb, 1.0);
}
```

We first calculate the view/camera direction vector `I` and use this to calculate the reflect vector `R` which we then
use to sample from the skybox cube map. Note that we have the fragment's interpolated `Normal` and `Position`
variables again so we'll need to adjust the vertex shader as well:

```glsl
#version 330 core
layout (location = 0) in vec3 aPos;
layout (location = 1) in vec3 aNormal;

out vec3 Normal;
out vec3 Position;

uniform mat4 model;
uniform mat4 view;
uniform mat4 projection;

void main()
{
    Normal = mat3(transpose(inverse(model))) * aNormal;
    Position = vec3(model * vec4(aPos, 1.0));
    gl_Position = projection * view * model * vec4(aPos, 1.0);
}
```

We're using normal vectors so we'll want to transform them with a normal matrix again. The `Position` output vector
is a world-space position vector. This `Position` output of the vertex shader is used to calculate the view direction
vector in the fragment shader.

Because we're using normals you'll want to update the vertex data with normals and update the attribute pointers as
well. `cubeVertices` becomes learnopengl's cube with positions and normals:

```cpp
    float cubeVertices[] = {
        // positions          // normals
        -0.5f, -0.5f, -0.5f,  0.0f,  0.0f, -1.0f,
         0.5f, -0.5f, -0.5f,  0.0f,  0.0f, -1.0f,
         0.5f,  0.5f, -0.5f,  0.0f,  0.0f, -1.0f,
        ...
    };
```

and attribute 1 now has 3 floats, with a stride of 6:

```cpp
    glVertexAttribPointer(0, 3, GL_FLOAT, GL_FALSE, 6 * sizeof(float), (void*)0);
    glEnableVertexAttribArray(1);
    glVertexAttribPointer(1, 3, GL_FLOAT, GL_FALSE, 6 * sizeof(float), (void*)(3 * sizeof(float)));
```

Also make sure to set the `cameraPos` uniform, next to the projection in the render loop:

```cpp
        shader.setVec3("cameraPos", cameraPos);
```

Then we also want to bind the cube map texture before rendering the cubes:

```cpp
        glBindTexture(GL_TEXTURE_CUBE_MAP, cubemapTexture); // the cubes reflect the sky
```

The marble is no longer needed: its `loadTexture` call and its `glDeleteTextures` go, and the shader configuration
sets the new sampler, `shader.setInt("skybox", 0);`, instead of `texture1`.
:::
:::vulkan
In `shaders/cubemaps.frag`:

```glsl
#version 450

layout(binding = 0) uniform UniformBufferObject {
    mat4 view;
    mat4 proj;
    vec3 cameraPos;
} ubo;

layout(binding = 1) uniform samplerCube skybox;

layout(location = 0) in vec3 fragNormal;
layout(location = 1) in vec3 fragPosition;

layout(location = 0) out vec4 outColor;

void main() {
    vec3 I = normalize(fragPosition - ubo.cameraPos); // from the camera to the fragment
    vec3 R = reflect(I, normalize(fragNormal));       // mirrored at the surface
    outColor = vec4(texture(skybox, R).rgb, 1.0);
}
```

We first calculate the view/camera direction vector `I` and use this to calculate the reflect vector `R` which we then
use to sample from the skybox cube map. Note that we have the fragment's interpolated normal and position again so
we'll need to adjust the vertex shader, `shaders/cubemaps.vert`, as well:

```glsl
layout(location = 0) in vec3 inPosition;
layout(location = 1) in vec3 inNormal;

layout(location = 0) out vec3 fragNormal;
layout(location = 1) out vec3 fragPosition;

void main() {
    fragNormal = mat3(transpose(inverse(pc.model))) * inNormal;
    fragPosition = vec3(pc.model * vec4(inPosition, 1.0));
    gl_Position = ubo.proj * ubo.view * pc.model * vec4(inPosition, 1.0);
}
```

(its uniform block gets the same `vec3 cameraPos;` member, so both shaders describe the buffer alike). We're using
normal vectors so we'll want to transform them with a normal matrix again. `fragPosition` is a world-space position
vector, used to calculate the view direction vector in the fragment shader.

Because we're using normals, `Vertex` gets `glm::vec3 normal;` instead of `glm::vec2 texCoord;`, and attribute 1
describes it:

```cpp
        attributeDescriptions[1].format = VK_FORMAT_R32G32B32_SFLOAT;
        attributeDescriptions[1].offset = offsetof(Vertex, normal);
```

The cube's 36 vertices become learnopengl's cube with positions and normals, e.g.
`{{-0.5f, -0.5f, -0.5f}, { 0.0f,  0.0f, -1.0f}},` (the skybox's vertices don't change – their normals are now the
ones that stay zero).

The camera position travels in the uniform buffer, after `proj`:

```cpp
struct UniformBufferObject {
    glm::mat4 view;
    glm::mat4 proj;
    glm::vec3 cameraPos; // the fragment shader needs it for the view direction
};
```

In the std140 layout of the uniform block, a `vec3` must start at a multiple of 16 bytes; `cameraPos` follows two
matrices, at offset 128, so the C++ struct and the block agree without padding. `updateUniformBuffer()` sets it,
`ubo.cameraPos = cameraPos;`. Since the fragment shader now reads the uniform buffer too, its binding must be visible
to that stage:

```cpp
        uboLayoutBinding.stageFlags = VK_SHADER_STAGE_VERTEX_BIT | VK_SHADER_STAGE_FRAGMENT_BIT; // cameraPos for the fragment shader
```

Finally the cubes are drawn with the cube map: they bind `skyboxDescriptorSet` instead of `cubeDescriptorSet`. The
marble is no longer needed – its image, view, memory, `textureSampler` and `cubeDescriptorSet` go, and the pool shrinks
back to one set.
:::
:::d3d12
In `cubemaps.hlsl`, the pixel shader:

```hlsl
float4 PSMain(PSInput input) : SV_TARGET
{
    // The direction from the camera to the pixel, mirrored at the surface: the cube map
    // is sampled in the reflected direction.
    float3 I = normalize(input.fragPos - cameraPos);
    float3 R = reflect(I, normalize(input.normal));
    return float4(skybox.Sample(clampSampler, R).rgb, 1.0f);
}
```

We first calculate the view/camera direction vector `I` and use this to calculate the reflect vector `R` which we then
use to sample from the skybox cube map. Note that we have the pixel's interpolated normal and position again so we'll
need to adjust the vertex shader as well:

```hlsl
// What the vertex shader hands on to the rasterizer and the pixel shader.
struct PSInput
{
    float4 position : SV_POSITION;
    float3 normal : NORMAL;
    float3 fragPos : POSITION;    // the position in world space
};

// The vertex shader: runs once per vertex.
PSInput VSMain(float4 position : POSITION, float3 normal : NORMAL)
{
    PSInput result;

    float4 worldPosition = mul(position, model);
    result.position = mul(mul(worldPosition, view), projection);
    result.fragPos = worldPosition.xyz;
    result.normal = mul(float4(normal, 0.0f), normalMatrix).xyz;

    return result;
}
```

The shader file's declarations change with it: `TextureCube skybox : register(t0);` and
`SamplerState clampSampler : register(s1);` instead of the 2D texture and `wrapSampler`, `float4x4 normalMatrix;` in
`ModelConstants` after `model`, and `float3 cameraPos;` in `SceneConstantBuffer` after `projection`.

We're using normal vectors so we'll want to transform them with a normal matrix again. As in the lighting chapters,
the normal matrix is computed in C++ and passed with the model matrix in the root constants:

```cpp
    XMMATRIX normalMatrix = XMMatrixTranspose(XMMatrixInverse(nullptr, model));
    XMStoreFloat4x4(&modelConstants.normalMatrix, XMMatrixTranspose(normalMatrix));
```

(with `XMFLOAT4X4 normalMatrix;` in the C++ `ModelConstants`). `fragPos` is a world-space position vector, used to
calculate the view direction vector in the pixel shader.

Because we're using normals, `Vertex` gets `XMFLOAT3 normal;` instead of `XMFLOAT2 texCoord;`, and the input layout's
second element becomes a normal:

```cpp
            { "NORMAL", 0, DXGI_FORMAT_R32G32B32_FLOAT, 0, 12, D3D12_INPUT_CLASSIFICATION_PER_VERTEX_DATA, 0 }
```

The cube's 36 vertices become learnopengl's cube with positions and normals, e.g.
`{ { -0.5f, -0.5f, -0.5f }, {  0.0f,  0.0f, -1.0f } },` – the skybox's `{}` fits a normal just as well.

The camera position travels in the constant buffer, after `projection`:

```cpp
        XMFLOAT3 cameraPos;
        float padding;    // the size of a constant buffer is a multiple of 16 bytes
```

`OnUpdate` stores it with `XMStoreFloat3(&constantBufferData.cameraPos, cameraPos);`. Since the pixel shader now reads
the constant buffer too, root parameter 1 must be visible to all stages:

```cpp
        rootParameters[1].InitAsDescriptorTable(1, &ranges[0], D3D12_SHADER_VISIBILITY_ALL);
```

Finally the cubes are drawn with the cube map: `SetGraphicsRootDescriptorTable(2, skyboxTexture)` instead of the
marble. The marble is no longer needed – `m_cubeTexture` and its `LoadTexture` call go, the cube map moves to heap slot
1 (`LoadCubemap(faces, m_skyboxTexture, skyboxTextureUploadHeap, 1);`, the heap shrinks to 2 descriptors) and the GPU
handle `skyboxTexture` points at slot 1.
:::

```quiz
In the reflection shader, what is `I`, and why must the camera position be known for it?
- [ ] The incoming light direction; the camera position is needed for the light's attenuation
- [ ] The normal in view space; the camera position turns it from world space into view space
- [ ] The direction from the fragment to the skybox's centre
- [x] The view direction, from the camera to the fragment in world space; `reflect` mirrors it about the normal to find where the mirror "looks" in the sky
---
A mirror shows what lies in the reflected viewing direction, so the result depends on where you look from. That's why the cube's fragment position (in world space) and the camera position are both needed.
```

Now do the task **reflection** and press **Build & run**. The marble is gone, and the cubes have become mirrors. With
the camera looking straight at them, their front faces mirror the sky behind the camera – which looks much like the
sky behind the cubes: sky above, a band of mountains, the ground below. The cubes almost disappear into the
background; you only see them where the reflected horizon, clouds and fields don't line up with the sky around them.
Move the camera to see the reflections change. Press A until you stand right in front of the left cube, at
x = -1, and look straight at it: its front face now mirrors what is behind you – the red and white tower that stands
towards +Z, behind the default camera.

When reflection is applied to an entire object (like a cube) the object looks as if it has a high reflective
material like steel or chrome. If we were to load a more interesting model, it would look like it's entirely made out
of chrome. This looks quite awesome, but in reality most models aren't all completely reflective. We could for
instance introduce *reflection maps* that give the models another extra level of detail. Just like diffuse and
specular maps, reflection maps are texture images that we can sample to determine the reflectivity of a fragment.
Using these reflection maps we can determine which parts of the model show reflection and by what intensity.

### Refraction

Another form of environment mapping is called *refraction* and is similar to reflection. Refraction is the change in
direction of light due to the change of the material the light flows through. Refraction is what we commonly see with
water-like surfaces where the light doesn't enter straight through, but bends a little. It's like looking at your arm
when it's halfway in the water.

Refraction is described by Snell's law. With environment maps it works like this: we have a view vector I, a normal
vector N and this time a resulting refraction vector R: the direction of the view vector, slightly bent where it
enters the surface. This resulting bent vector R is then used to sample from the cube map.

Refraction is fairly easy to implement using {{shaderLanguage}}'s built-in `refract` function that expects a normal
vector, a view direction, and a ratio between both materials' refractive indices.

The refractive index determines the amount light distorts/bends in a material where each material has its own
refractive index. A list of the most common refractive indices are given in the following table:

| Material | Refractive index |
| --- | --- |
| Air | 1.00 |
| Water | 1.33 |
| Ice | 1.309 |
| Glass | 1.52 |
| Diamond | 2.42 |

We use these refractive indices to calculate the ratio between both materials the light passes through. In our case,
the light/view ray goes from air to glass (if we assume the object is made of glass) so the ratio becomes
1.00 / 1.52 = 0.658.

We already have the cube map bound, supplied the vertex data with normals, and set the camera position as a uniform.
The only thing we have to change is the fragment shader:

:::opengl
```glsl
void main()
{
    float ratio = 1.00 / 1.52; // from air (1.00) into glass (1.52)
    vec3 I = normalize(Position - cameraPos);
    vec3 R = refract(I, normalize(Normal), ratio);
    FragColor = vec4(texture(skybox, R).rgb, 1.0);
}
```
:::
:::vulkan
```glsl
void main() {
    float ratio = 1.00 / 1.52; // from air (1.00) into glass (1.52)
    vec3 I = normalize(fragPosition - ubo.cameraPos); // from the camera to the fragment
    vec3 R = refract(I, normalize(fragNormal), ratio); // bent at the surface
    outColor = vec4(texture(skybox, R).rgb, 1.0);
}
```
:::
:::d3d12
```hlsl
float4 PSMain(PSInput input) : SV_TARGET
{
    // The direction from the camera to the pixel, bent where it enters the glass: the
    // cube map is sampled in the refracted direction.
    float ratio = 1.00f / 1.52f;    // from air (1.00) into glass (1.52)
    float3 I = normalize(input.fragPos - cameraPos);
    float3 R = refract(I, normalize(input.normal), ratio);
    return float4(skybox.Sample(clampSampler, R).rgb, 1.0f);
}
```
:::

By changing the refractive indices you can create completely different visual results.

```quiz
The shader uses `ratio = 1.00 / 1.52`. What does that number describe?
- [ ] How much of the sky is reflected and how much is refracted
- [x] The ratio of the refractive indices of the two materials: the view ray passes from air (1.00) into glass (1.52)
- [ ] The thickness of the glass cube in world units
- [ ] The cube's size relative to the skybox
---
`refract` bends the ray according to Snell's law, which depends on the ratio of the refractive indices on both sides of the surface. For water instead of glass it would be 1.00 / 1.33.
```

Do the last task, **refraction**, and press **Build & run**. The cubes now look like blocks of glass: you see the sky
behind them through them, but bent – magnified and shifted, so that through the left cube the mountains look taller
than around it, and its outline shows as a slightly different square against the sky. The effect is much clearer when
you move the camera; try walking around the cubes.

Note that for physically accurate results we should refract the light again when it leaves the object; now we simply
used single-sided refraction which is fine for most purposes.

### Dynamic environment maps

Right now we've been using a static combination of images as the skybox, which looks great, but it doesn't include
the actual 3D scene with possibly moving objects. We didn't really notice this so far, because we only used a single
object. If we had a mirror-like object with multiple surrounding objects, only the skybox would be visible in the
mirror as if it was the only object in the scene.

Using framebuffers it is possible to create a texture of the scene for all 6 different angles from the object in
question and store those in a cube map each frame. We can then use this (dynamically generated) cube map to create
realistic reflection and refractive surfaces that include all other objects. This is called *dynamic environment
mapping*, because we dynamically create a cube map of an object's surroundings and use that as its environment map.

:::opengl
In OpenGL, each face of the cube map can be attached to a framebuffer as its colour attachment with
`glFramebufferTexture2D(GL_FRAMEBUFFER, GL_COLOR_ATTACHMENT0, GL_TEXTURE_CUBE_MAP_POSITIVE_X + i, cubemap, 0)`, and the
scene is drawn six times with a 90 degree field of view, once looking along each axis.
:::
:::vulkan
In Vulkan, the cube map image gets `VK_IMAGE_USAGE_COLOR_ATTACHMENT_BIT` next to `VK_IMAGE_USAGE_SAMPLED_BIT`, each of
its six layers gets a 2D image view and a framebuffer of its own, and the scene is drawn six times with a 90 degree
field of view, once looking along each axis – the offscreen render pass of the previous chapter, six times.
:::
:::d3d12
In Direct3D 12, the cube map texture gets `D3D12_RESOURCE_FLAG_ALLOW_RENDER_TARGET` and one RTV per face (a
`D3D12_RTV_DIMENSION_TEXTURE2DARRAY` view of one slice each), and the scene is drawn six times with a 90 degree field
of view, once looking along each axis – the off-screen render target of the previous chapter, six times.
:::

While it looks great, it has one enormous disadvantage: we have to render the scene 6 times per object using an
environment map, which is an enormous performance penalty on your application. Modern applications try to use the
skybox as much as possible and where possible pre-render cube maps wherever they can to still sort-of create dynamic
environment maps. While dynamic environment mapping is a great technique, it requires a lot of clever tricks and hacks
to get it working in an actual rendering application without too many performance drops.
