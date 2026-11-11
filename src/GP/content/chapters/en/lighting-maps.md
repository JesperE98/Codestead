# Lighting maps

In the previous chapter we discussed the possibility of each object having a unique material of its own that reacts
differently to light. This is great for giving each object a unique look in comparison to other objects, but still
doesn't offer much flexibility on the visual output of an object.

In the previous chapter we defined a material for an entire object as a whole. Objects in the real world however
usually do not consist of a single material, but of several materials. Think of a car: its exterior consists of a
shiny fabric, it has windows that partly reflect the surrounding environment, its tires are all but shiny so they
don't have specular highlights and it has rims that are super shiny (if you actually washed your car alright). The car
also has diffuse and ambient colors that are not the same for the entire object; a car displays many different
ambient/diffuse colors. All in all, such an object has different material properties for each of its different
parts.

So the material system in the previous chapter isn't sufficient for all but the simplest models, so we need to extend
the system by introducing *diffuse* and *specular* maps. These allow us to influence the diffuse (and indirectly the
ambient component since they should be the same anyways) and the specular component of an object with much more
precision.

## Diffuse maps

What we want is some way to set the diffuse colors of an object for each individual fragment. Some sort of system
where we can retrieve a color value based on the fragment's position on the object?

This should probably all sound familiar and we've been using such a system for a while now. This sounds just like
textures we've extensively discussed in one of the earlier chapters and it basically is just that: a texture. We're
just using a different name for the same underlying principle: using an image wrapped around an object that we can
index for unique color values per fragment. In lit scenes this is usually called a *diffuse map* (this is generally
how 3D artists call them before PBR) since a texture image represents all of the object's diffuse colors.

To demonstrate diffuse maps we're going to use an image of a wooden container with a steel border: this course's
`container2.png`, wooden planks held together by a grey steel frame. (learnopengl.com uses its own picture of such a
container; the idea is the same.)

Using a diffuse map in shaders is exactly like we showed in the texture chapter. This time however the texture takes
the place of the material's `vec3` diffuse color.

:::opengl
```glsl
struct Material {
    sampler2D diffuse;
    vec3 specular;
    float shininess;
};
...
in vec2 TexCoords;
```

Keep in mind that `sampler2D` is a so called *opaque type* which means we can't instantiate these types, but only
define them as uniforms. If the struct would be instantiated other than as a uniform (like a function parameter)
GLSL could throw strange errors; the same thus applies to any struct holding such opaque types.
:::
:::vulkan
Here Vulkan differs from OpenGL. A sampler is an *opaque type*: it is not a value in a buffer but a handle to an image
and a sampler that the descriptor set provides. A uniform block cannot contain one, and Vulkan GLSL doesn't even allow
opaque types inside a struct – so the sampler can't go into the `Material` struct, which lives in the uniform block.
Instead, the diffuse map gets a binding of its own, next to the block, and the struct keeps only the
numbers:

```glsl
// The lighting maps are textures; a uniform block cannot hold a sampler, so they have bindings of their own.
layout(binding = 0) uniform sampler2D diffuseMap;

struct Material {
    vec3 specular;
    float shininess;
};
...
layout(location = 2) in vec2 fragTexCoord;
```

`diffuseMap` is learnopengl's `material.diffuse` under another name. Binding 0 is free: the uniform buffer kept
binding 2 from the earlier chapters, where bindings 0 and 1 held the two textures of the crate.
:::
:::d3d12
Here Direct3D 12 differs from OpenGL. A texture is not a value in a buffer: the shader reads it through a shader
resource view (SRV) in a register `t`, and a cbuffer – and any struct in it – cannot contain one. So the diffuse map
becomes a global `Texture2D`, next to the cbuffer, together with the sampler it is read with, and the struct keeps
only the numbers:

```hlsl
// The material's diffuse colour is a texture: register t0, in the descriptor table of
// root parameter 2. (Textures cannot be members of a cbuffer or its structs.)
Texture2D diffuseMap : register(t0);
// The sampler: register s0, the static sampler of the root signature.
SamplerState wrapSampler : register(s0);

// The rest of the material.
struct Material
{
    float3 specular;
    float shininess;
};
```

`diffuseMap` is learnopengl's `material.diffuse` under another name, and `wrapSampler` is the static sampler you
already used in the *Textures* chapter.
:::

We also removed the ambient material color vector since the ambient color is equal to the diffuse color anyways now
that we control ambient with the light. So there's no need to store it separately.

```quiz
Why does the material no longer have its own ambient colour once the diffuse map arrives?
- [ ] A texture can only replace one of the colours, and learnopengl chose diffuse
- [ ] Ambient lighting is switched off when a texture is used
- [x] The ambient colour of a surface is practically always its diffuse colour, and the light's `ambient` intensity already controls how strong it is – so the ambient term samples the diffuse map too
---
Both terms describe the surface's own colour; only the light decides how much of it shows (0.2 for ambient, 0.5 for diffuse in this project). So `ambient = light.ambient * diffuse colour` and `diffuse = light.diffuse * diff * diffuse colour`, both from the same texel.
```

Note that we are going to need texture coordinates again in the fragment shader, so it gets an extra input variable.
Then we simply sample from the texture to retrieve the fragment's diffuse color value:

:::opengl
```glsl
    vec3 diffuse = light.diffuse * diff * texture(material.diffuse, TexCoords).rgb;
```

Also, don't forget to set the ambient material's color equal to the diffuse material's color as well:

```glsl
    vec3 ambient = light.ambient * texture(material.diffuse, TexCoords).rgb;
```
:::
:::vulkan
```glsl
    vec3 diffuse = ubo.light.diffuse * diff * texture(diffuseMap, fragTexCoord).rgb;
```

Also, don't forget to set the ambient material's color equal to the diffuse material's color as well:

```glsl
    vec3 ambient = ubo.light.ambient * texture(diffuseMap, fragTexCoord).rgb;
```
:::
:::d3d12
```hlsl
    float3 diffuse = light.diffuse * diff * diffuseMap.Sample(wrapSampler, input.texCoord).rgb;
```

Also, don't forget to set the ambient material's color equal to the diffuse material's color as well:

```hlsl
    float3 ambient = light.ambient * diffuseMap.Sample(wrapSampler, input.texCoord).rgb;
```
:::

And that's all it takes to use a diffuse map. As you can see it is nothing new, but it does provide a dramatic
increase in visual quality. To get it working we do need to update the vertex data with texture coordinates, transfer
them as vertex attributes to the fragment shader, load the texture, and bind the texture to the appropriate texture
unit.

:::opengl
This chapter's project is the result of *Materials*, with the shaders of the lit cube renamed to `lighting_maps.vs`
and `lighting_maps.fs`. The light has learnopengl's fixed intensities again (ambient 0.2, diffuse 0.5, specular 1.0 –
no changing colour), and the material is still coral. A few things for textures are already there: `stb_image.h`
(with `STB_IMAGE_IMPLEMENTATION`), the three images `container2.png`, `container2_specular.png` and `matrix.png`, and
vertex data with texture coordinates – each vertex now has a position, a normal and texture coordinates, 8 floats:

```cpp
    float vertices[] = {
        // positions          // normals           // texture coords
        -0.5f, -0.5f, -0.5f,  0.0f,  0.0f, -1.0f,  0.0f,  0.0f,
         0.5f, -0.5f, -0.5f,  0.0f,  0.0f, -1.0f,  1.0f,  0.0f,
         0.5f,  0.5f, -0.5f,  0.0f,  0.0f, -1.0f,  1.0f,  1.0f,
        ...
```

The position and normal attributes already use a stride of `8 * sizeof(float)`, for the cube's VAO and the lamp's.
The `// TODO:` comments mark where your code goes: the texture coordinate attribute, loading the textures, and
binding them in the render loop.
:::
:::vulkan
This chapter's project is the result of *Materials*, with the cube's shaders renamed to
`shaders/lighting_maps.vert` and `.frag`. The light has learnopengl's fixed intensities again (ambient 0.2, diffuse
0.5, specular 1.0 – no changing colour), and the material is still coral. What textures need is already there, from
the *Textures* chapter: `stb_image.h`, the images `textures/container2.png`, `textures/container2_specular.png` and
`textures/matrix.png`, vulkan-tutorial's helpers `beginSingleTimeCommands()`, `endSingleTimeCommands()`,
`transitionImageLayout()` and `copyBufferToImage()`, and the sampler `textureSampler` (linear filtering, repeat,
anisotropy), created in `initVulkan()` and destroyed in `cleanup()`. The `Vertex` struct has a third member,
`glm::vec2 texCoord`, with learnopengl's coordinates, v flipped (`1 - v`): learnopengl flips the images when loading
them, we flip the coordinates instead, as in the *Textures* chapter.

The body of the *Textures* chapter's `createTextureImage()` is now a helper that every map can use:

```cpp
    // A texture image (device local, ready for sampling) with the pixels of an image loaded by stb_image as RGBA,
    // copied through a staging buffer. The caller frees the pixels.
    void createTextureImage(stbi_uc* pixels, int texWidth, int texHeight, VkImage& image, VkDeviceMemory& imageMemory) {
```

It creates a staging buffer, copies the pixels into it, creates a device-local `VK_FORMAT_R8G8B8A8_UNORM` image,
transitions it to `TRANSFER_DST_OPTIMAL`, copies the buffer into it and transitions it to
`SHADER_READ_ONLY_OPTIMAL`. The `// TODO:` comments mark where your code goes: the texture coordinate attribute
and loading the maps.
:::
:::d3d12
This chapter's project is the result of *Materials*, with the lit cube's shaders renamed to `lighting_maps.hlsl`. The
light has learnopengl's fixed intensities again (ambient 0.2, diffuse 0.5, specular 1.0 – no changing colour), and
the material is still coral. A few things for textures are already there: `stb_image.h` (with
`STB_IMAGE_IMPLEMENTATION`), the three images `container2.png`, `container2_specular.png` and `matrix.png`, and a
`Vertex` struct with a third member, `XMFLOAT2 texCoord`. The texture coordinates are learnopengl's with v flipped
(`1 - v`): Direct3D's v = 0 is the image's top row, and the images are loaded without a flip, as in the *Textures*
chapter. The `// TODO:` comments mark where your code goes: the texture coordinate element of the input layout,
loading the textures, and the textures' root parameter in `PopulateCommandList`.
:::

First the texture coordinates have to reach the fragment shader, exactly like the normals did in *Basic Lighting*.

:::opengl
The vertex attribute at location 2 is the 2 floats after the normal:

```cpp
    // texture coord attribute
    glVertexAttribPointer(2, 2, GL_FLOAT, GL_FALSE, 8 * sizeof(float), (void*)(6 * sizeof(float)));
    glEnableVertexAttribArray(2);
```

The vertex shader takes them in and passes them on:

```glsl
layout (location = 2) in vec2 aTexCoords;
...
out vec2 TexCoords;
...
    TexCoords = aTexCoords;
```

and the fragment shader receives them with `in vec2 TexCoords;`.
:::
:::vulkan
`getAttributeDescriptions()` returns a third attribute, location 2, for `texCoord` – two 32-bit floats:

```cpp
    static std::array<VkVertexInputAttributeDescription, 3> getAttributeDescriptions() {
        std::array<VkVertexInputAttributeDescription, 3> attributeDescriptions{};
        ...
        attributeDescriptions[2].binding = 0;
        attributeDescriptions[2].location = 2;
        attributeDescriptions[2].format = VK_FORMAT_R32G32_SFLOAT;
        attributeDescriptions[2].offset = offsetof(Vertex, texCoord);
```

Our `createPipeline()` uses only the first `attributeCount` attributes, so the cube's pipeline must now read 3 (the
lamp's still reads only the position):

```cpp
        createPipeline("shaders/lighting_maps.vert.spv", "shaders/lighting_maps.frag.spv", 3, lightingPipeline); // position, normal and texture coordinates
```

The vertex shader passes them on:

```glsl
layout(location = 2) in vec2 inTexCoord;
...
layout(location = 2) out vec2 fragTexCoord;
...
    fragTexCoord = inTexCoord;
```

and the fragment shader receives them with `layout(location = 2) in vec2 fragTexCoord;`.
:::
:::d3d12
The input layout gets a third element: two floats with the semantic `TEXCOORD`, 24 bytes into the vertex, after the
3 + 3 floats of the position and the normal:

```cpp
            { "NORMAL", 0, DXGI_FORMAT_R32G32B32_FLOAT, 0, 12, D3D12_INPUT_CLASSIFICATION_PER_VERTEX_DATA, 0 },
            { "TEXCOORD", 0, DXGI_FORMAT_R32G32_FLOAT, 0, 24, D3D12_INPUT_CLASSIFICATION_PER_VERTEX_DATA, 0 }
```

`VSMain` takes them as a third input and passes them on in `PSInput`:

```hlsl
struct PSInput
{
    float4 position : SV_POSITION;
    float3 fragPos : POSITION;    // the position in world space
    float3 normal : NORMAL;
    float2 texCoord : TEXCOORD;
};

PSInput VSMain(float4 position : POSITION, float3 normal : NORMAL, float2 texCoord : TEXCOORD)
{
    ...
    result.texCoord = texCoord;
```

The lamp's pipeline uses the same input layout; its vertex shader simply ignores the elements it doesn't read.
:::

Now do the first task, **texcoords**, then build and run. Nothing changes yet – the cube is still coral – but the
coordinates are now on their way to the fragment shader.

Next comes the texture itself.

:::opengl
The project uses learnopengl's utility function `loadTexture`, at the end of `main.cpp`, so we don't have to repeat
the texture code of the *Textures* chapter for every map:

```cpp
// utility function for loading a 2D texture from file
// ---------------------------------------------------
unsigned int loadTexture(const char *path)
{
    unsigned int textureID;
    glGenTextures(1, &textureID);

    int width, height, nrComponents;
    stbi_set_flip_vertically_on_load(true); // tell stb_image.h to flip loaded textures on the y-axis (the image's first row is its top, OpenGL's v = 0 is the bottom)
    unsigned char *data = stbi_load(path, &width, &height, &nrComponents, 0);
    if (data)
    {
        GLenum format = GL_RGB;
        if (nrComponents == 1)
            format = GL_RED;
        else if (nrComponents == 3)
            format = GL_RGB;
        else if (nrComponents == 4)
            format = GL_RGBA;

        glBindTexture(GL_TEXTURE_2D, textureID);
        glTexImage2D(GL_TEXTURE_2D, 0, format, width, height, 0, format, GL_UNSIGNED_BYTE, data);
        glGenerateMipmap(GL_TEXTURE_2D);

        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_S, GL_REPEAT);
        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_T, GL_REPEAT);
        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, GL_LINEAR_MIPMAP_LINEAR);
        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, GL_LINEAR);

        stbi_image_free(data);
    }
    else
    {
        std::cout << "Texture failed to load at path: " << path << std::endl;
        stbi_image_free(data);
    }

    return textureID;
}
```

It picks the format from the number of channels in the file, so it works for greyscale, RGB and RGBA images alike.
Unlike learnopengl's version it flips the image when loading, as the *Textures* chapter did, so that the images
appear upright. With it, loading the diffuse map and telling the shader which texture unit `material.diffuse` reads
from takes a few lines, before the render loop:

```cpp
    // load textures (we now use a utility function to keep the code more organized)
    // -----------------------------------------------------------------------------
    unsigned int diffuseMap = loadTexture("container2.png");

    // shader configuration
    // --------------------
    lightingShader.use();
    lightingShader.setInt("material.diffuse", 0);
```

Note that a sampler inside a struct is set exactly like any other struct field, by its full name. In the render loop
we bind the texture to unit 0 before drawing the cube:

```cpp
        // bind diffuse map
        glActiveTexture(GL_TEXTURE0);
        glBindTexture(GL_TEXTURE_2D, diffuseMap);
```

The two `setVec3` calls for `material.ambient` and `material.diffuse` go away – those uniforms don't exist any more.
We keep the specular colour at 0.5 and, like learnopengl, use a shininess of 64:

```cpp
        // material properties
        lightingShader.setVec3("material.specular", 0.5f, 0.5f, 0.5f);
        lightingShader.setFloat("material.shininess", 64.0f);
```

Finally, delete the texture with the other objects at the end of `main`: `glDeleteTextures(1, &diffuseMap);`.
:::
:::vulkan
Each map gets a function of its own that loads its image and makes the image and its image view – vulkan-tutorial's
`createTextureImage()` and `createTextureImageView()` in one, for one file. The image, its memory and the view are
new members of the application:

```cpp
    VkImage diffuseMapImage;
    VkDeviceMemory diffuseMapImageMemory;
    VkImageView diffuseMapImageView;
```

```cpp
    // the diffuse map: the colour of the surface (for the ambient and the diffuse light)
    void createDiffuseMap() {
        int texWidth, texHeight, texChannels;
        stbi_uc* pixels = stbi_load("textures/container2.png", &texWidth, &texHeight, &texChannels, STBI_rgb_alpha);

        if (!pixels) {
            throw std::runtime_error("failed to load texture image!");
        }

        createTextureImage(pixels, texWidth, texHeight, diffuseMapImage, diffuseMapImageMemory);
        stbi_image_free(pixels);

        diffuseMapImageView = createImageView(diffuseMapImage, VK_FORMAT_R8G8B8A8_UNORM, VK_IMAGE_ASPECT_COLOR_BIT);
    }
```

`initVulkan()` calls `createDiffuseMap();` where the TODO is, after `createCommandPool()` (the copy needs a command
buffer) and before `createTextureSampler()`, and `cleanup()` destroys the three objects after the sampler:

```cpp
        vkDestroyImageView(device, diffuseMapImageView, nullptr);
        vkDestroyImage(device, diffuseMapImage, nullptr);
        vkFreeMemory(device, diffuseMapImageMemory, nullptr);
```

The image has a single mip level: vulkan-tutorial only adds mipmaps in a later chapter. OpenGL's `loadTexture`
generates them, so the crate's finest details can look a little sharper here than in OpenGL.

Then the shader needs the map. In OpenGL we would bind the texture to a texture unit; in Vulkan the descriptor set
says which image and sampler binding 0 of the shader reads. That takes the same three steps as in the *Textures*
chapter. The layout gets a combined image sampler at binding 0, for the fragment stage:

```cpp
        // The uniform buffer keeps binding 2; the lighting maps take the bindings 0, 1 and 3.
        VkDescriptorSetLayoutBinding diffuseMapLayoutBinding{};
        diffuseMapLayoutBinding.binding = 0;
        diffuseMapLayoutBinding.descriptorCount = 1;
        diffuseMapLayoutBinding.descriptorType = VK_DESCRIPTOR_TYPE_COMBINED_IMAGE_SAMPLER;
        diffuseMapLayoutBinding.pImmutableSamplers = nullptr;
        diffuseMapLayoutBinding.stageFlags = VK_SHADER_STAGE_FRAGMENT_BIT;
        ...
        std::array<VkDescriptorSetLayoutBinding, 2> bindings = {diffuseMapLayoutBinding, uboLayoutBinding};
```

The pool must have room for one combined image sampler:

```cpp
        std::array<VkDescriptorPoolSize, 2> poolSizes{};
        poolSizes[0].type = VK_DESCRIPTOR_TYPE_UNIFORM_BUFFER;
        poolSizes[0].descriptorCount = 1; // the set has one uniform buffer
        poolSizes[1].type = VK_DESCRIPTOR_TYPE_COMBINED_IMAGE_SAMPLER;
        poolSizes[1].descriptorCount = 1; // and a combined image sampler for each lighting map
```

And `createDescriptorSets()` writes the image view and the sampler into binding 0:

```cpp
        VkDescriptorImageInfo diffuseMapInfo{};
        diffuseMapInfo.imageLayout = VK_IMAGE_LAYOUT_SHADER_READ_ONLY_OPTIMAL;
        diffuseMapInfo.imageView = diffuseMapImageView;
        diffuseMapInfo.sampler = textureSampler;

        std::array<VkWriteDescriptorSet, 2> descriptorWrites{};
        ...
        descriptorWrites[1].sType = VK_STRUCTURE_TYPE_WRITE_DESCRIPTOR_SET;
        descriptorWrites[1].dstSet = descriptorSet;
        descriptorWrites[1].dstBinding = 0;
        descriptorWrites[1].dstArrayElement = 0;
        descriptorWrites[1].descriptorType = VK_DESCRIPTOR_TYPE_COMBINED_IMAGE_SAMPLER;
        descriptorWrites[1].descriptorCount = 1;
        descriptorWrites[1].pImageInfo = &diffuseMapInfo;
```

Since the descriptor set is bound once in `recordCommandBuffer()`, as before, nothing changes there: the map is
bound together with the uniform buffer. The C++ `Material` loses `ambient` and `diffuse` like the shader's – it is
now `glm::vec3 specular; float shininess;`, 16 bytes – and `updateUniformBuffer()` keeps the specular colour at 0.5
and, like learnopengl, uses a shininess of 64:

```cpp
        ubo.material.specular  = glm::vec3(0.5f, 0.5f, 0.5f);
        ubo.material.shininess = 64.0f;
```
:::
:::d3d12
The project has learnopengl's utility `loadTexture` as a member function, `LoadTexture`, at the end of `main.cpp`. It
does the steps of the *Textures* chapter for one file, so we don't have to repeat them for every map:

```cpp
void D3D12App::LoadTexture(const char* path, ComPtr<ID3D12Resource>& texture, ComPtr<ID3D12Resource>& uploadHeap, UINT descriptorIndex)
```

It loads the image as RGBA with `stbi_load(path, …, 4)`, creates a `DXGI_FORMAT_R8G8B8A8_UNORM` texture with one
mip level in a default heap, creates an upload buffer of `GetRequiredIntermediateSize` bytes, records the copy with
`UpdateSubresources` into the command list, adds the barrier to `PIXEL_SHADER_RESOURCE`, and creates the SRV in slot
`descriptorIndex` of the CBV/SRV heap. The command list is still open at that point; `LoadAssets` executes it at the
end and waits for the GPU. That's why the upload buffer is an output parameter: the caller keeps it alive until then.

The texture has a single mip level, as in the *Textures* chapter. OpenGL's `loadTexture` generates mipmaps, so the
crate's finest details can look a little sharper here than in OpenGL.

Loading the diffuse map goes where the TODO is, after the vertex buffer. The texture is a new member,
`ComPtr<ID3D12Resource> m_diffuseMap;`, and its SRV goes into heap slot 1, right after the CBV in slot 0:

```cpp
    // Load the textures: the SRVs go into the heap after the CBV (slot 0), in the order of
    // their registers t0, t1 ... Their upload buffers must stay alive until the command list
    // that copies from them has executed (the end of this method waits for it).
    ComPtr<ID3D12Resource> diffuseMapUploadHeap;
    LoadTexture("container2.png", m_diffuseMap, diffuseMapUploadHeap, 1);
```

So the heap needs room for two descriptors: `cbvSrvHeapDesc.NumDescriptors = 2;    // one CBV + one SRV per texture`.

The root signature tells the shaders where to find the texture: a second descriptor range, of SRVs from register
`t0` on, in a new root parameter 2, visible to the pixel shader – and the static sampler of the *Textures* chapter
at `s0`:

```cpp
        // Descriptor ranges: 1 CBV at register b1, for the table of root parameter 1, and
        // the SRVs of the textures from register t0 on (1 SRV: t0), for root parameter 2.
        CD3DX12_DESCRIPTOR_RANGE ranges[2];
        ranges[0].Init(D3D12_DESCRIPTOR_RANGE_TYPE_CBV, 1, 1);
        ranges[1].Init(D3D12_DESCRIPTOR_RANGE_TYPE_SRV, 1, 0);

        // Root parameter 2: a descriptor table with the textures' SRVs, for the pixel shader.
        CD3DX12_ROOT_PARAMETER rootParameters[3];
        rootParameters[0].InitAsConstants(sizeof(ModelConstants) / 4, 0, 0, D3D12_SHADER_VISIBILITY_VERTEX);
        rootParameters[1].InitAsDescriptorTable(1, &ranges[0], D3D12_SHADER_VISIBILITY_ALL);
        rootParameters[2].InitAsDescriptorTable(1, &ranges[1], D3D12_SHADER_VISIBILITY_PIXEL);

        // A static sampler is part of the root signature itself (no descriptor needed).
        // Sampler s0: linear filtering; texture coordinates outside 0..1 wrap around.
        D3D12_STATIC_SAMPLER_DESC samplers[1] = {};
        samplers[0].Filter = D3D12_FILTER_MIN_MAG_MIP_LINEAR;
        samplers[0].AddressU = D3D12_TEXTURE_ADDRESS_MODE_WRAP;
        samplers[0].AddressV = D3D12_TEXTURE_ADDRESS_MODE_WRAP;
        samplers[0].AddressW = D3D12_TEXTURE_ADDRESS_MODE_WRAP;
        ...
        samplers[0].ShaderRegister = 0;
        samplers[0].RegisterSpace = 0;
        samplers[0].ShaderVisibility = D3D12_SHADER_VISIBILITY_PIXEL;

        CD3DX12_ROOT_SIGNATURE_DESC rootSignatureDesc;
        rootSignatureDesc.Init(_countof(rootParameters), rootParameters, _countof(samplers), samplers, D3D12_ROOT_SIGNATURE_FLAG_ALLOW_INPUT_ASSEMBLER_INPUT_LAYOUT);
```

In OpenGL we would bind the texture to a texture unit before drawing; in Direct3D 12 we point root parameter 2 at the
heap slot where the SRV is, in `PopulateCommandList`, after root parameter 1:

```cpp
    // Root parameter 2: the textures' table, starting at the heap's second descriptor (slot 1).
    CD3DX12_GPU_DESCRIPTOR_HANDLE srvHandle(m_cbvSrvHeap->GetGPUDescriptorHandleForHeapStart(), 1, m_cbvSrvDescriptorSize);
    m_commandList->SetGraphicsRootDescriptorTable(2, srvHandle);
```

The C++ `Material` loses `ambient` and `diffuse` like the shader's – it is now `XMFLOAT3 specular; float shininess;`,
one 16-byte row – and `OnUpdate` keeps the specular colour at 0.5 and, like learnopengl, uses a shininess of 64:

```cpp
    // material properties
    constantBufferData.material.specular = XMFLOAT3(0.5f, 0.5f, 0.5f);
    constantBufferData.material.shininess = 64.0f;
```
:::

:::opengl
```quiz
`lightingShader.setInt("material.diffuse", 0);` runs once, before the render loop. What does it do?
- [ ] It binds `diffuseMap` to texture unit 0 for the rest of the program
- [ ] It uploads the diffuse map's pixels to the shader
- [x] It tells the sampler `material.diffuse` to read from texture unit 0 – whatever texture is bound to `GL_TEXTURE0` when the cube is drawn
---
A sampler uniform holds a texture unit number, not a texture. The texture itself is attached to the unit with `glActiveTexture(GL_TEXTURE0)` and `glBindTexture` in the render loop; the shader reads whatever is bound there at draw time.
```
:::
:::vulkan
```quiz
How does the fragment shader's `layout(binding = 0) uniform sampler2D diffuseMap;` end up reading `container2.png`?
- [ ] `createDiffuseMap()` binds the image to texture unit 0
- [x] The descriptor set's binding 0 is a combined image sampler, and `vkUpdateDescriptorSets` writes `diffuseMapImageView` and `textureSampler` into it; the set is bound before drawing
- [ ] The shader loads the file itself when the pipeline is created
---
The layout declares binding 0 as a combined image sampler for the fragment stage, the pool has room for it, and the write (`dstBinding = 0`, `pImageInfo = &diffuseMapInfo`) puts the image view and the sampler there. `vkCmdBindDescriptorSets` in `recordCommandBuffer()` makes it visible to the draw.
```
:::
:::d3d12
```quiz
How does the pixel shader's `Texture2D diffuseMap : register(t0);` end up reading `container2.png`?
- [ ] `LoadTexture` binds the texture to register t0 directly
- [ ] The static sampler s0 holds the texture
- [x] `LoadTexture` puts its SRV in heap slot 1; root parameter 2 is a table whose SRV range starts at t0, and `SetGraphicsRootDescriptorTable(2, …)` points it at slot 1
---
Registers are reached through the root signature: the range `SRV, 1, 0` says "the table's first descriptor is t0", and the GPU handle given to `SetGraphicsRootDescriptorTable` says where the table starts in the heap – slot 1, where the SRV is. The static sampler only says *how* to read the texture.
```
:::

Now do the task **diffuse-map**, then build and run. The coral cube is now a wooden crate in a steel frame, lit like
before: the front face bright, the left face dark. As you can see the container now looks like a proper container: a
dramatic increase in visual quality. Look closely at the specular highlight in the upper-left corner of the front face,
though: it is a grey-white sheen that covers the steel and the wood alike.

## Specular maps

You probably noticed that the specular highlight looks a bit odd since the object is a container that mostly consists
of wood and wood doesn't have specular highlights like that. We can fix this by setting the specular material of the
object to zero, but that would mean that the steel borders of the container would no longer show specular highlights
as well and steel *should* show specular highlights. We would like to control what parts of the object should show a
specular highlight with varying intensity. This is a problem that sounds familiar. Coincidence? I think not.

We can also use a texture map just for specular highlights. This means we need to generate a black and white (or
colors if you feel like it) texture that defines the specular intensities of each part of the object. The course's
`container2_specular.png` is such a specular map: the steel frame is bright, the wooden planks are almost black.

The intensity of the specular highlight comes from the brightness of each pixel in the image. Each pixel of the
specular map can be displayed as a color vector where black represents the color vector (0, 0, 0) and gray the color
vector (0.5, 0.5, 0.5) for example. In the fragment shader we then sample the corresponding color value and multiply
this value with the light's specular intensity. The more 'white' a pixel is, the higher the result of the
multiplication and thus the brighter the specular component of an object becomes.

Because the container mostly consists of wood, and wood as a material should have no specular highlights, the entire
wooden section of the diffuse texture was converted to black: black sections do not have any specular highlight. The
steel border has varying specular intensities with the steel itself being relatively susceptible to specular
highlights while the cracks are not.

Technically wood also has specular highlights although with a much lower shininess value (more light scattering) and
less impact, but for learning purposes we can just pretend wood doesn't have any reaction to specular light.

Using tools like Photoshop or Gimp it is relatively easy to transform a diffuse texture to a specular image like this
by cutting out some parts, transforming it to black and white and increasing the brightness/contrast.

```quiz
In the specular map, the wooden planks are almost black and the steel frame is bright. What does that mean for the lighting?
- [x] The specular term is multiplied by the map: on the wood it becomes almost 0 (no highlight), on the steel it keeps nearly the light's full specular intensity
- [ ] The wood gets a higher shininess and the steel a lower one
- [ ] The wood is drawn black and the steel white
---
The specular map only scales the specular component; the colour of the surface still comes from the diffuse map. Black (0, 0, 0) removes the highlight, white (1, 1, 1) lets it through at full strength, grey values lie in between.
```

## Sampling specular maps

A specular map is just like any other texture so the code is similar to the diffuse map code.

:::opengl
Make sure to properly load the image and generate a texture object. Since we're using another texture sampler in the
same fragment shader we have to use a different texture unit for the specular map and bind it to the appropriate
texture unit before rendering:

```cpp
    unsigned int specularMap = loadTexture("container2_specular.png");
    ...
    lightingShader.setInt("material.specular", 1);
    ...
        // bind specular map
        glActiveTexture(GL_TEXTURE1);
        glBindTexture(GL_TEXTURE_2D, specularMap);
```

The `setInt` goes under the diffuse map's, before the render loop, and the binding after the diffuse map's, in the
loop. Then update the material properties of the fragment shader to accept a `sampler2D` as its specular component
instead of a `vec3`:

```glsl
struct Material {
    sampler2D diffuse;
    sampler2D specular;
    float shininess;
};
```

And lastly we want to sample the specular map to retrieve the fragment's corresponding specular intensity:

```glsl
    vec3 specular = light.specular * spec * texture(material.specular, TexCoords).rgb;
```

`material.specular` is a sampler now, so the `setVec3("material.specular", …)` call in the render loop must go: only
the shininess remains under `// material properties`. And don't forget `glDeleteTextures(1, &specularMap);` at the
end.
:::
:::vulkan
In Vulkan there are no texture units: the specular map gets binding 1 of the descriptor set, through the same steps
as the diffuse map. New members `specularMapImage`, `specularMapImageMemory` and `specularMapImageView`, destroyed in
`cleanup()`, and a function that loads the image:

```cpp
    // the specular map: how strong the specular highlight is on each part of the surface (the steel shines, the wood does not)
    void createSpecularMap() {
        int texWidth, texHeight, texChannels;
        stbi_uc* pixels = stbi_load("textures/container2_specular.png", &texWidth, &texHeight, &texChannels, STBI_rgb_alpha);

        if (!pixels) {
            throw std::runtime_error("failed to load texture image!");
        }

        createTextureImage(pixels, texWidth, texHeight, specularMapImage, specularMapImageMemory);
        stbi_image_free(pixels);

        specularMapImageView = createImageView(specularMapImage, VK_FORMAT_R8G8B8A8_UNORM, VK_IMAGE_ASPECT_COLOR_BIT);
    }
```

called with `createSpecularMap();` after `createDiffuseMap();`. In `createDescriptorSetLayout()`, a
`specularMapLayoutBinding` like the diffuse map's, with `binding = 1`, and the array of bindings grows to three:

```cpp
        std::array<VkDescriptorSetLayoutBinding, 3> bindings = {diffuseMapLayoutBinding, specularMapLayoutBinding, uboLayoutBinding};
```

The pool size for combined image samplers becomes 2 (`poolSizes[1].descriptorCount = 2;`), and
`createDescriptorSets()` gets a `VkDescriptorImageInfo specularMapInfo` (`specularMapImageView`, the same
`textureSampler`) and a third write, `descriptorWrites[2]`, with `dstBinding = 1` and `pImageInfo =
&specularMapInfo`. Both maps share one sampler: a combined image sampler descriptor is a pair of an image view and a
sampler, and nothing stops two pairs from using the same sampler.

In the fragment shader the map is declared next to the diffuse map, and the struct keeps only the shininess:

```glsl
layout(binding = 0) uniform sampler2D diffuseMap;
layout(binding = 1) uniform sampler2D specularMap;

struct Material {
    float shininess;
};
```

And lastly we want to sample the specular map to retrieve the fragment's corresponding specular intensity:

```glsl
    vec3 specular = ubo.light.specular * spec * texture(specularMap, fragTexCoord).rgb;
```

The C++ `Material` must again match the block. A struct with a single `float` still takes 16 bytes in a uniform
block – its size is rounded up to a multiple of 16 – so it needs three padding floats:

```cpp
struct Material {
    float shininess;
    float pad1; // a struct in a uniform block takes a multiple of 16 bytes
    float pad2;
    float pad3;
};
```

`ubo.material.specular` no longer exists, so its line in `updateUniformBuffer()` goes: only
`ubo.material.shininess = 64.0f;` remains.
:::
:::d3d12
In Direct3D 12 there are no texture units: the specular map gets register `t1`, and its SRV goes into heap slot 2,
right after the diffuse map's. A new member `ComPtr<ID3D12Resource> m_specularMap;`, and after the diffuse map:

```cpp
    ComPtr<ID3D12Resource> specularMapUploadHeap;
    LoadTexture("container2_specular.png", m_specularMap, specularMapUploadHeap, 2);
```

The heap needs room for three descriptors (`NumDescriptors = 3`), and the SRV range of root parameter 2 grows to two
descriptors, t0 and t1:

```cpp
        ranges[1].Init(D3D12_DESCRIPTOR_RANGE_TYPE_SRV, 2, 0);
```

`PopulateCommandList` doesn't change: the table still starts at slot 1, and with two descriptors it now covers slots 1
and 2 – the diffuse map as t0 and the specular map as t1. This is why the textures are loaded in register order: a
descriptor table is a run of consecutive heap slots.

In the shader the map is declared next to the diffuse map, and the struct keeps only the shininess:

```hlsl
Texture2D diffuseMap : register(t0);
Texture2D specularMap : register(t1);
...
struct Material
{
    float shininess;
};
```

And lastly we want to sample the specular map to retrieve the fragment's corresponding specular intensity:

```hlsl
    float3 specular = light.specular * spec * specularMap.Sample(wrapSampler, input.texCoord).rgb;
```

The C++ `Material` must again match the cbuffer. The next member, `Light light`, is a struct and starts a new 16-byte
row, so the row of `shininess` has to be filled up in C++:

```cpp
    // The material: what the shaders see as struct Material. Laid out as HLSL does: the
    // next member (a struct) starts a new 16-byte row, so the row is padded to 16 bytes.
    struct Material
    {
        float shininess;
        float padding0[3];
    };
```

`material.specular` no longer exists, so its line in `OnUpdate` goes: only `constantBufferData.material.shininess =
64.0f;` remains.
:::

:::opengl
```quiz
Both maps are bound with `glBindTexture(GL_TEXTURE_2D, …)`. Why doesn't the second call replace the first?
- [x] `glActiveTexture(GL_TEXTURE1)` selects texture unit 1 first, so the specular map is bound to unit 1 while the diffuse map stays on unit 0
- [ ] Because the two textures have different sizes
- [ ] `glBindTexture` adds textures to a list; the shader takes them in order
---
`glBindTexture` binds to the *active* texture unit. With `glActiveTexture(GL_TEXTURE0)` before the first bind and `GL_TEXTURE1` before the second, each sampler (`material.diffuse` = 0, `material.specular` = 1) finds its own texture.
```
:::
:::vulkan
```quiz
Why are the maps `layout(binding = N) uniform sampler2D` declarations next to the uniform block instead of members of `Material`, as in learnopengl?
- [ ] Because samplers must always use binding numbers below the uniform buffer's
- [ ] Because Vulkan allows only one texture per struct
- [x] A uniform block cannot contain samplers, and `Material` lives in the uniform block; samplers are opaque types that the descriptor set provides, each through a binding of its own
---
The block is plain memory read at fixed offsets; a sampler is a handle to an image view and a sampler object, provided by a combined image sampler descriptor – and Vulkan GLSL doesn't allow opaque types in structs at all. So each map gets its own binding (0, 1 and later 3), and the struct keeps only the numbers.
```
:::
:::d3d12
```quiz
The SRV range grows from 1 to 2 descriptors and the specular map's SRV goes into heap slot 2. Why slot 2?
- [ ] Because register t1 always means heap slot 2
- [x] Root parameter 2's table starts at slot 1 and covers consecutive slots: the first is t0 (the diffuse map), the next one, slot 2, is t1
- [ ] Any free slot works; the root signature looks the SRV up by its texture
---
A descriptor table is a starting handle plus a run of consecutive descriptors. The range `SRV, 2, 0` maps the table's descriptors to t0 and t1 in order, so the specular map's SRV must sit right after the diffuse map's.
```
:::

Now do the task **specular-map**, then build and run. Only the steel shines now: the highlight on the frame in the
upper-left corner is bright white, while the wooden planks right next to it lost their sheen and only show their diffuse
colour.

By using a specular map we can specify with enormous detail what parts of an object have shiny properties and we can
even control the corresponding intensity. Specular maps give us an added layer of control over lighting on top of the
diffuse map.

> If you don't want to be too mainstream you could also use actual colors in the specular map to not only set the
> specular intensity of each fragment, but also the color of the specular highlight. Realistically however, the color
> of the specular highlight is mostly determined by the light source itself so it wouldn't generate realistic visuals
> (that's why the images are usually black and white: we only care about the intensity).

If you would now run the application you can clearly see that the container's material now closely resembles that of
an actual wooden container with steel frames.

Using diffuse and specular maps we can really add an enormous amount of detail into relatively simple objects. We can
even add more detail into the objects using other texture maps like normal/bump maps and/or reflection maps, but
that is something we'll reserve for later chapters. Show your container to all your friends and family and be
content with the fact that our container can one day become even prettier than our current container!

## Exercises

- Fool around with the light source's ambient, diffuse and specular vectors and see how they affect the visual output
  of the container.
- Try inverting the color values of the specular map in the fragment shader so that the wood shows specular highlights
  and the steel borders do not (note that due to the cracks in the steel border the borders still show some specular
  highlight, although with less intensity).
- Try creating a specular map from the diffuse texture that uses actual colors instead of black and white and see
  that the result doesn't look too realistic.
- Also add something they call an *emission map* which is a texture that stores emission values per fragment.
  Emission values are colors an object may *emit* as if it contains a light source itself; this way an object can
  glow regardless of the light conditions. Emission maps are often what you see when objects in a game glow (like
  the eyes of a robot, or light strips on a container). Add `matrix.png` – green glyphs on black – as an emission map
  onto the container as if the letters emit light.

The first three exercises are for you to try on your own. For the second, only the specular term changes:

:::opengl
```glsl
    vec3 specular = light.specular * spec * (vec3(1.0) - texture(material.specular, TexCoords).rgb);
```
:::
:::vulkan
```glsl
    vec3 specular = ubo.light.specular * spec * (vec3(1.0) - texture(specularMap, fragTexCoord).rgb);
```
:::
:::d3d12
```hlsl
    float3 specular = light.specular * spec * (1.0f - specularMap.Sample(wrapSampler, input.texCoord).rgb);
```
:::

```quiz
You invert the specular map in the shader (1 minus the sampled value). What do you see?
- [ ] Nothing changes, because the specular map is black and white
- [x] The wood gets a highlight and the steel frame loses most of it – only the dark cracks in the steel still shine a little
- [ ] The whole crate turns into its photographic negative
---
Only the specular factor is inverted, not the colour: the almost-black wood becomes almost white in the map, so it now lets the highlight through, while the bright steel blocks it. The diffuse map – the crate's colour – is untouched.
```

The fourth exercise, the emission map, is the last task of this chapter. It works exactly like the other maps, with a
third texture:

:::opengl
```cpp
    unsigned int emissionMap = loadTexture("matrix.png");
    ...
    lightingShader.setInt("material.emission", 2);
    ...
        // bind emission map
        glActiveTexture(GL_TEXTURE2);
        glBindTexture(GL_TEXTURE_2D, emissionMap);
```

plus `glDeleteTextures(1, &emissionMap);` at the end. In the shader, `sampler2D emission;` joins the material after
`specular`, and the emitted colour is added to the result:

```glsl
    // emission
    vec3 emission = texture(material.emission, TexCoords).rgb;

    vec3 result = ambient + diffuse + specular + emission;
```
:::
:::vulkan
Members `emissionMapImage`, `emissionMapImageMemory` and `emissionMapImageView`, a `createEmissionMap()` that loads
`"textures/matrix.png"` (called after `createSpecularMap()`, destroyed in `cleanup()`), and a combined image sampler at
**binding 3** – binding 2 is the uniform buffer. The bindings array grows to four (`{diffuseMapLayoutBinding,
specularMapLayoutBinding, uboLayoutBinding, emissionMapLayoutBinding}`), the pool size to 3, and the set gets a fourth
write with `dstBinding = 3` and `pImageInfo = &emissionMapInfo`. In the shader:

```glsl
layout(binding = 3) uniform sampler2D emissionMap; // binding 2 is the uniform buffer
...
    // emission
    vec3 emission = texture(emissionMap, fragTexCoord).rgb;

    vec3 result = ambient + diffuse + specular + emission;
```
:::
:::d3d12
A member `ComPtr<ID3D12Resource> m_emissionMap;`, loaded into heap slot 3 after the specular map:

```cpp
    ComPtr<ID3D12Resource> emissionMapUploadHeap;
    LoadTexture("matrix.png", m_emissionMap, emissionMapUploadHeap, 3);
```

`NumDescriptors = 4`, and the SRV range grows to three descriptors (`ranges[1].Init(D3D12_DESCRIPTOR_RANGE_TYPE_SRV,
3, 0);`): t0, t1 and t2. In the shader:

```hlsl
Texture2D emissionMap : register(t2);
...
    // emission
    float3 emission = emissionMap.Sample(wrapSampler, input.texCoord).rgb;

    float3 result = ambient + diffuse + specular + emission;
```
:::

Now do the task **emission**, then build and run. Green glyphs glow over both visible faces of the crate – also on the
left face, which the light doesn't reach. Between the glyphs, where the emission map is black, the crate looks exactly
as before.

```quiz
Why do the green glyphs glow just as brightly on the left face, which gets no diffuse light?
- [ ] The emission map is sampled with a different sampler that ignores the normals
- [x] The emission is added to the result on its own, without being multiplied by any of the light's components or by `diff`
- [ ] The left face gets diffuse light from the emission of the front face
---
Ambient, diffuse and specular are all scaled by the light (and by the angle to it); the emission term is the texture's colour as it is. That's what makes it look like light coming from the object itself – it glows regardless of the light conditions.
```

The next chapter starts again without the emission map, from the crate with its diffuse and specular maps, and looks
at different kinds of light sources.
