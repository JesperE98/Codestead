# Textures

We learned that to add more detail to our objects we can use colors for each vertex to create some interesting
images. However, to get a fair bit of realism we'd have to have many vertices so we could specify a lot of colors.
This takes up a considerable amount of extra overhead, since each model needs a lot more vertices and for each
vertex a color attribute as well.

What artists and programmers generally prefer is to use a *texture*. A texture is a 2D image (even 1D and 3D
textures exist) used to add detail to an object; think of a texture as a piece of paper with a nice brick image on
it, neatly folded over your 3D house so it looks like your house has a stone exterior. Because we can insert a lot
of detail in a single image, we can give the illusion the object is extremely detailed without having to specify
extra vertices.

> Next to images, textures can also be used to store a large collection of arbitrary data to send to the shaders,
> but we'll leave that for a different topic.

In this chapter you put two images on the rectangle from the previous chapters: a wooden crate, `container.png`, and a
smiley, `awesomeface.png`. Both are 256×256 pixels and both are part of the project – **Copy start files** puts them
into your project folder. `container.png` has three channels (RGB). `awesomeface.png` has four (RGBA): around the face
it is transparent, and those transparent pixels are stored as **black** with an alpha of 0. Keep that in mind; it will
explain something you see later.

:::opengl
This chapter's project is the indexed rectangle of *Hello Triangle* with the `Shader` class of the *Shaders*
chapter (`shader_s.h`, `shader.vs`, `shader.fs`) and a colour per vertex: each vertex has a position and a colour
(stride `6 * sizeof(float)`), the top right corner is red, the bottom right green, the bottom left blue and the top
left yellow, and the colours are interpolated across the rectangle. The two images lie next to `main.cpp` and are
loaded by their file names.
:::
:::vulkan
This chapter's project is the indexed rectangle of *Hello Triangle* with a colour per vertex:
`struct Vertex { glm::vec3 pos; glm::vec3 color; }` with two attribute descriptions, the corners top left yellow,
top right red, bottom right green and bottom left blue. The two images are in `textures/container.png` and
`textures/awesomeface.png`.

Adding a texture to a Vulkan program takes several new functions, so the project already contains empty stubs for
them, called from `initVulkan()` in the order vulkan-tutorial uses: `createDescriptorSetLayout()` after
`createRenderPass()`; `createTextureImage()`, `createTextureImageView()` and `createTextureSampler()` after
`createCommandPool()`; `createDescriptorPool()` and `createDescriptorSets()` after `createIndexBuffer()`.
:::
:::d3d12
This chapter's project is the indexed rectangle of *Hello Triangle* with a colour per vertex:
`struct Vertex { XMFLOAT3 position; XMFLOAT3 color; };` with a `COLOR` input element at offset 12, the corners top
right red, bottom right green, bottom left blue and top left yellow. The root signature is still empty. The two
images lie next to `main.cpp` and `shaders.hlsl` and are loaded by their file names. The texture code follows
Microsoft's D3D12HelloTexture sample – except that the sample generates a black-and-white checkerboard in code,
while we load real images.
:::

The `// TODO:` comments in the project mark where your code goes. After each task, build and run the program in your
IDE.

## Texture coordinates

In order to map a texture to the rectangle we need to tell each vertex of the rectangle which part of the texture
it corresponds to. Each vertex should thus have a *texture coordinate* associated with it that specifies what part
of the texture image to sample from. Fragment interpolation then does the rest for the other fragments.

Texture coordinates range from `0` to `1` on the x and y axis of the texture image (remember that we use 2D
texture images). Retrieving the texture color using texture coordinates is called *sampling*. A texture coordinate
of (0.5, 0.5) is always the centre of the image, (1, 1) and (0, 0) are two opposite corners – but *which* corners
depends on the API:

:::opengl
In OpenGL, texture coordinates start at (0, 0) for the **lower left** corner of a texture image and go to (1, 1)
for the upper right corner. OpenGL calls the two axes *s* and *t* (and *r* for 3D textures). To put a texture on a
triangle we would give its bottom-left corner the texture coordinate (0, 0), its bottom-right corner (1, 0) and its
top corner (0.5, 1.0): the top of the image, halfway across.
:::
:::vulkan
In Vulkan, texture coordinates start at (0, 0) for the **upper left** corner of a texture image – the first texel
in memory – and go to (1, 1) for the lower right corner. The two axes are usually called *u* and *v* (and *w* for
3D textures). To put a texture on a triangle we would give its bottom-left corner the texture coordinate (0, 1),
its bottom-right corner (1, 1) and its top corner (0.5, 0.0): the top of the image, halfway across.
:::
:::d3d12
In Direct3D, texture coordinates start at (0, 0) for the **upper left** corner of a texture image – the first texel
in memory – and go to (1, 1) for the lower right corner. The two axes are called *u* and *v* (and *w* for 3D
textures). To put a texture on a triangle we would give its bottom-left corner the texture coordinate (0, 1), its
bottom-right corner (1, 1) and its top corner (0.5, 0.0): the top of the image, halfway across.
:::

We only have to pass texture coordinates for the corners to the vertex shader, which then passes them on to the
fragment shader that neatly interpolates all the texture coordinates for each fragment.

Texture sampling has a loose interpretation and can be done in many different ways. It is thus our job to tell
{{api}} how it should sample its textures.

## Texture Wrapping

Texture coordinates usually range from (0, 0) to (1, 1), but what happens if we specify coordinates outside this
range? The default behavior of OpenGL, and the most common choice in every API, is to repeat the texture images
(we basically ignore the integer part of the floating point texture coordinate), but there are more options:

:::opengl
- `GL_REPEAT`: The default behavior for textures. Repeats the texture image.
- `GL_MIRRORED_REPEAT`: Same as `GL_REPEAT` but mirrors the image with each repeat.
- `GL_CLAMP_TO_EDGE`: Clamps the coordinates between `0` and `1`. The result is that higher coordinates become
  clamped to the edge, resulting in a stretched edge pattern.
- `GL_CLAMP_TO_BORDER`: Coordinates outside the range are now given a user-specified border color.

Each of the options can be set per coordinate axis (`s`, `t` and `r` if you're using 3D textures) with the
`glTexParameter*` function:

```cpp
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_S, GL_REPEAT); // set texture wrapping to GL_REPEAT (default wrapping method)
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_T, GL_REPEAT);
```

The first argument specifies the texture target; we're working with 2D textures so the texture target is
`GL_TEXTURE_2D`. The second argument requires us to tell what option we want to set and for which texture axis;
we want to configure it for both the `S` and `T` axis. The last argument requires us to pass in the texture
wrapping mode we'd like. The parameters are stored in the texture object that is currently bound to
`GL_TEXTURE_2D` – you'll create and bind one in a moment.

If we choose the `GL_CLAMP_TO_BORDER` option we should also specify a border color. This is done using the `fv`
equivalent of the `glTexParameter` function with `GL_TEXTURE_BORDER_COLOR` as its option where we pass in a float
array of the border's color value, for example
`glTexParameterfv(GL_TEXTURE_2D, GL_TEXTURE_BORDER_COLOR, borderColor);` with
`float borderColor[] = { 1.0f, 1.0f, 0.0f, 1.0f };` for yellow.
:::
:::vulkan
In Vulkan these are *address modes*, of the type `VkSamplerAddressMode`:

- `VK_SAMPLER_ADDRESS_MODE_REPEAT`: Repeats the texture image.
- `VK_SAMPLER_ADDRESS_MODE_MIRRORED_REPEAT`: Same as repeat but mirrors the image with each repeat.
- `VK_SAMPLER_ADDRESS_MODE_CLAMP_TO_EDGE`: Clamps the coordinates between `0` and `1`. Higher coordinates become
  clamped to the edge, resulting in a stretched edge pattern.
- `VK_SAMPLER_ADDRESS_MODE_CLAMP_TO_BORDER`: Coordinates outside the range return a border color.

(There is also `VK_SAMPLER_ADDRESS_MODE_MIRROR_CLAMP_TO_EDGE`, which mirrors the image once and then clamps; it
needs a device feature.)

The big difference to OpenGL is *where* these settings live. In OpenGL they are parameters of the texture object.
In Vulkan they belong to a separate object, the **sampler** (`VkSampler`), which knows nothing about any image: a
sampler is a set of rules for reading *some* image. You'll create one later in this chapter, and set the address
mode per axis (`U`, `V` and `W`) like this:

```cpp
        samplerInfo.addressModeU = VK_SAMPLER_ADDRESS_MODE_REPEAT;
        samplerInfo.addressModeV = VK_SAMPLER_ADDRESS_MODE_REPEAT;
        samplerInfo.addressModeW = VK_SAMPLER_ADDRESS_MODE_REPEAT;
```

The border color for clamp-to-border is not an arbitrary color in core Vulkan: `borderColor` picks one of a few
predefined values, such as `VK_BORDER_COLOR_INT_OPAQUE_BLACK`, `VK_BORDER_COLOR_FLOAT_TRANSPARENT_BLACK` or
`VK_BORDER_COLOR_INT_OPAQUE_WHITE`.
:::
:::d3d12
In Direct3D these are *texture address modes*, of the type `D3D12_TEXTURE_ADDRESS_MODE`:

- `D3D12_TEXTURE_ADDRESS_MODE_WRAP`: Repeats the texture image.
- `D3D12_TEXTURE_ADDRESS_MODE_MIRROR`: Same as wrap but mirrors the image with each repeat.
- `D3D12_TEXTURE_ADDRESS_MODE_CLAMP`: Clamps the coordinates between `0` and `1`. Higher coordinates become
  clamped to the edge, resulting in a stretched edge pattern.
- `D3D12_TEXTURE_ADDRESS_MODE_BORDER`: Coordinates outside the range return a border color.

(There is also `D3D12_TEXTURE_ADDRESS_MODE_MIRROR_ONCE`, which mirrors the image once and then clamps.)

The big difference to OpenGL is *where* these settings live. In OpenGL they are parameters of the texture object.
In Direct3D they belong to a separate **sampler**, which knows nothing about any texture: a sampler is a set of
rules for reading *some* texture. You'll describe one later in this chapter, and set the address mode per axis
(`U`, `V` and `W`) like this:

```cpp
        samplers[0].AddressU = D3D12_TEXTURE_ADDRESS_MODE_WRAP;
        samplers[0].AddressV = D3D12_TEXTURE_ADDRESS_MODE_WRAP;
        samplers[0].AddressW = D3D12_TEXTURE_ADDRESS_MODE_WRAP;
```

We will use *static samplers*, which are part of the root signature; their border color is one of a few
predefined values (`D3D12_STATIC_BORDER_COLOR_TRANSPARENT_BLACK`, `..._OPAQUE_BLACK`, `..._OPAQUE_WHITE`). A sampler
created in a sampler descriptor heap can have any border color.
:::

```quiz
A rectangle's texture coordinates go from 0.0 to 2.0 on both axes, and the texture is read with repeat (wrap) addressing. What do you see?
- [x] The image four times, in a 2 × 2 grid
- [ ] The image once in one quarter, and the image's edge pixels stretched over the rest
- [ ] The image once, stretched over the whole rectangle
---
With repeat addressing only the fractional part of a coordinate counts, so 0..1 and 1..2 both cover the whole image: twice across and twice down. The third answer describes clamp-to-edge, which you will use in the exercises.
```

## Texture Filtering

Texture coordinates do not depend on resolution but can be any floating point value, thus the GPU has to figure
out which texture pixel (also known as a *texel*) to map the texture coordinate to. This becomes especially
important if you have a very large object and a low resolution texture. You probably guessed by now that there are
options for this *texture filtering* as well. There are several options available but for now we'll discuss the
most important options:

- **Nearest neighbor filtering** (also called point filtering) selects the texel whose center is closest to the
  texture coordinate.
- **(Bi)linear filtering** takes an interpolated value from the texture coordinate's neighboring texels,
  approximating a color between the texels. The smaller the distance from the texture coordinate to a texel's
  center, the more that texel's color contributes to the sampled color.

What visual effect do these filtering methods produce? Nearest filtering results in blocked patterns where we can
clearly see the pixels that form the texture, while linear filtering produces a smoother pattern where the
individual pixels are less visible. Linear filtering produces a more realistic output, but some developers prefer
a more 8-bit look and as a result pick the nearest filter.

Texture filtering can be set for *magnifying* and *minifying* operations (when scaling up or downwards) so you
could for example use nearest neighbor filtering when textures are scaled downwards and linear filtering for
upscaled textures. In this chapter's project a 256×256 image covers a rectangle of 400×300 pixels: each texel
covers about 1.6 × 1.2 pixels, so the texture is *magnified*.

:::opengl
In OpenGL the two options are `GL_NEAREST` and `GL_LINEAR`, and we specify the filtering method for both options
via `glTexParameter*`. The code should look similar to setting the wrapping method:

```cpp
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, GL_LINEAR_MIPMAP_LINEAR);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, GL_LINEAR);
```

The magnification filter is `GL_LINEAR`. The minification filter, `GL_LINEAR_MIPMAP_LINEAR`, also involves
*mipmaps* – the next topic.
:::
:::vulkan
In Vulkan the two options are `VK_FILTER_NEAREST` and `VK_FILTER_LINEAR`, and the sampler has one field for each
case:

```cpp
        samplerInfo.magFilter = VK_FILTER_LINEAR;
        samplerInfo.minFilter = VK_FILTER_LINEAR;
```

Vulkan samplers can also do *anisotropic filtering*, which improves textures seen at a steep angle (a floor
stretching into the distance). The project's sampler turns it on – you'll see the details when you create it.
:::
:::d3d12
In Direct3D the minification filter, the magnification filter and the mipmap filter (the next topic) are combined
into one value of the type `D3D12_FILTER`. Its names spell out the three parts: `POINT` is nearest, `LINEAR` is
linear. For example `D3D12_FILTER_MIN_MAG_MIP_POINT` uses nearest filtering everywhere,
`D3D12_FILTER_MIN_MAG_LINEAR_MIP_POINT` filters linearly within a mip level, and the project's sampler uses linear
for all three:

```cpp
        samplers[0].Filter = D3D12_FILTER_MIN_MAG_MIP_LINEAR;
```

There is also `D3D12_FILTER_ANISOTROPIC` (with `MaxAnisotropy`), which improves textures seen at a steep angle.
:::

```quiz
In this chapter's project a 256×256 texture covers a rectangle of 400×300 pixels. Which filter setting decides how it looks, and what would nearest filtering show?
- [ ] The mipmap filter; nearest filtering would pick a smaller mip level
- [x] The magnification filter; nearest filtering would show every texel as a small block with hard edges
- [ ] The minification filter; nearest filtering would blur the image
---
Each texel covers more than one pixel, so the texture is magnified. Nearest filtering gives every pixel the color of the closest texel – blocks – while linear filtering blends neighboring texels into a smooth image.
```

### Mipmaps

Imagine we had a large room with thousands of objects, each with an attached texture. There will be objects far
away that have the same high resolution texture attached as the objects close to the viewer. Since the objects are
far away and probably only produce a few fragments, the GPU has difficulties retrieving the right color value for
its fragment from the high resolution texture, since it has to pick a texture color for a fragment that spans a
large part of the texture. This will produce visible artifacts on small objects, not to mention the waste of memory
bandwidth using high resolution textures on small objects.

To solve this issue graphics APIs use a concept called *mipmaps*, which is basically a collection of texture images
where each subsequent texture is twice as small compared to the previous one. The idea behind mipmaps should be
easy to understand: after a certain distance threshold from the viewer, the GPU will use a different mipmap texture
that best suits the distance to the object. Because the object is far away, the smaller resolution will not be
noticeable to the user. The GPU is then able to sample the correct texels, and there's less cache memory involved
when sampling that part of the mipmaps. A full chain of mipmaps costs only about a third more memory than the
original image (1 + ¼ + 1/16 + … ≈ 4/3).

Just like normal texture filtering, it is also possible to filter between mipmap levels: when switching between
mipmap levels you can pick the nearest level, or blend linearly between the two closest levels – and within a
level, sample with nearest or linear filtering.

:::opengl
Creating a collection of mipmapped textures for each texture image is cumbersome to do manually, but luckily OpenGL
is able to do all the work for us with a single call to `glGenerateMipmap` after we've created a texture.

To specify the filtering method between mipmap levels we can replace the original filtering methods with one of the
following four options:

- `GL_NEAREST_MIPMAP_NEAREST`: takes the nearest mipmap to match the pixel size and uses nearest neighbor
  interpolation for texture sampling.
- `GL_LINEAR_MIPMAP_NEAREST`: takes the nearest mipmap level and samples that level using linear interpolation.
- `GL_NEAREST_MIPMAP_LINEAR`: linearly interpolates between the two mipmaps that most closely match the size of a
  pixel and samples the interpolated level via nearest neighbor interpolation.
- `GL_LINEAR_MIPMAP_LINEAR`: linearly interpolates between the two closest mipmaps and samples the interpolated
  level via linear interpolation.

That is what the `GL_LINEAR_MIPMAP_LINEAR` minification filter above means. A common mistake is to set one of the
mipmap filtering options as the magnification filter. This doesn't have any effect since mipmaps are primarily used
for when textures get downscaled: texture magnification doesn't use mipmaps, and giving it a mipmap filtering
option will generate an OpenGL `GL_INVALID_ENUM` error code.
:::
:::vulkan
Vulkan has no `glGenerateMipmap`. An image has as many mip levels as you give it in `VkImageCreateInfo::mipLevels`,
and filling them is your job: vulkan-tutorial's *Generating Mipmaps* chapter does it with `vkCmdBlitImage`, which
copies each level into the next smaller one with linear filtering, together with a layout transition per level.
The sampler then chooses between levels with `mipmapMode` (`VK_SAMPLER_MIPMAP_MODE_NEAREST` or
`VK_SAMPLER_MIPMAP_MODE_LINEAR`) and the range `minLod`/`maxLod`.

This chapter keeps it simple: our texture images have **one** mip level. The project's sampler still sets
`mipmapMode = VK_SAMPLER_MIPMAP_MODE_LINEAR`, like the tutorial's, but with a single level there is nothing to
choose between. Since our rectangle magnifies the texture, mipmaps would not be used here anyway.
:::
:::d3d12
Direct3D 12 has no `glGenerateMipmap` (Direct3D 11's `GenerateMips` was not carried over). A texture has as many
mip levels as you give it in `D3D12_RESOURCE_DESC::MipLevels`, and filling them is your job: programs either load
mipmaps that were computed ahead of time (for example DDS files made with Microsoft's DirectXTex library), or
generate them on the GPU with a compute shader, as libraries such as the DirectX Tool Kit do. The sampler chooses
between levels with the `MIP` part of its filter and the range `MinLOD`/`MaxLOD`.

This chapter keeps it simple, like Microsoft's D3D12HelloTexture sample: our textures have **one** mip level. The
project's sampler still uses `D3D12_FILTER_MIN_MAG_MIP_LINEAR`, but with a single level there is nothing to choose
between. Since our rectangle magnifies the texture, mipmaps would not be used here anyway.
:::

```quiz
Why are mipmaps only used when a texture is minified (drawn smaller than its size)?
- [ ] Mipmaps are recomputed every frame, which is only fast enough for textures that appear small
- [ ] Mipmaps are larger than the original image, so they only fit on screen when the texture is minified
- [x] When many texels fall on one pixel, a smaller, pre-filtered level gives the right average color without artifacts and with less memory traffic; when magnified, the full-size level is already the most detailed one
---
Each mip level is half the size of the previous one and is computed once, when the texture is created. A magnified texture has fewer texels than pixels, so there is nothing to gain from an even smaller level.
```

## Loading and creating textures

The first thing we need to do to actually use textures is to load them into our application. Texture images can be
stored in dozens of file formats, each with their own structure and ordering of data, so how do we get those images
in our application? One solution would be to choose a file format we'd like to use, say `.PNG` and write our own
image loader to convert the image format into a large array of bytes. While it's not very hard to write your own
image loader, it's still cumbersome and what if you want to support more file formats? You'd then have to write an
image loader for each format you want to support.

Another solution, and probably a good one, is to use an image-loading library that supports several popular formats
and does all the hard work for us. A library like `stb_image.h`.

:::d3d12
> Windows programs often load images with the Windows Imaging Component (WIC), which is part of Windows, or with
> Microsoft's DirectXTex library, which also reads DDS files with ready-made mipmaps. This course uses `stb_image.h` for
> all three APIs, so the loading code is the same everywhere.
:::

### stb_image.h

`stb_image.h` is a very popular single header image loading library by Sean Barrett that is able to load most
popular file formats and is easy to integrate in your project(s). In the course's projects it is already available
as `<stb_image.h>`. To use it, you add the following lines to one source file:

```cpp
#define STB_IMAGE_IMPLEMENTATION
#include <stb_image.h>
```

By defining `STB_IMAGE_IMPLEMENTATION` the preprocessor modifies the header file such that it only contains the
relevant definition source code, effectively turning the header file into a `.cpp` file, and that's about it. Do
this in exactly **one** `.cpp` file: other files that need the library include the header without the define.

To load an image using `stb_image.h` we use its `stbi_load` function. The function takes as input the location of
an image file. It then expects you to give three `int`s as its second, third and fourth argument that `stb_image.h`
will fill with the resulting image's width, height and number of color channels. The last argument says how many
channels you want back: `0` means "as many as the file has". The function returns a pointer to the pixels, row by
row, starting with the **top** row of the image, or a null pointer if the file could not be loaded. When we are
done with the pixels we give the memory back with `stbi_image_free`.

:::opengl
```cpp
    // load image, create texture and generate mipmaps
    int width, height, nrChannels;
    stbi_set_flip_vertically_on_load(true); // tell stb_image.h to flip loaded texture's on the y-axis.
    unsigned char *data = stbi_load("container.png", &width, &height, &nrChannels, 0);
    if (data)
    {
        // TODO: create the texture image from the data and generate mipmaps
    }
    else
    {
        std::cout << "Failed to load texture" << std::endl;
    }
    stbi_image_free(data);
```

We load `container.png` with as many channels as it has (three: RGB). Note the line before `stbi_load`. Image
files – and therefore `stb_image.h` – put the top row of the image first. OpenGL, however, expects the `0.0`
coordinate on the y (t) axis to be on the **bottom** side of the image: the first row you hand to OpenGL becomes
the row at t = 0, the bottom. Without help the crate would therefore end up upside-down.
`stbi_set_flip_vertically_on_load(true)` tells `stb_image.h` to flip the image on the y-axis while loading, so the
bottom row comes first and the image appears upright.

Now do the first task, **load-image**: include `stb_image.h` (after the GLFW include) and load `container.png` as shown
above, at the second `// TODO:` in `main.cpp`. Leave the inside of `if (data)` for the next tasks. Nothing visible
changes yet – but if the file can't be loaded, you'll see `Failed to load texture` in the program's console.
:::
:::vulkan
In `createTextureImage()`:

```cpp
        int texWidth, texHeight, texChannels;
        stbi_uc* pixels = stbi_load("textures/container.png", &texWidth, &texHeight, &texChannels, STBI_rgb_alpha);

        if (!pixels) {
            throw std::runtime_error("failed to load texture image!");
        }
```

The `STBI_rgb_alpha` value forces the image to be loaded with an alpha channel, even if it doesn't have one, which
is nice for consistency: `container.png` has no alpha, but every pixel comes back as 4 bytes. The texture format we
are going to use, `VK_FORMAT_R8G8B8A8_UNORM`, has four channels too – many GPUs don't support 3-channel formats for
sampled images.

Note that there is **no vertical flip**. Image files – and therefore `stb_image.h` – put the top row of the image
first, and in Vulkan the first row in memory is the row at v = 0, which is the **top** of the texture. The image
arrives upright as it is. (OpenGL tutorials call `stbi_set_flip_vertically_on_load(true)` here, because OpenGL
treats t = 0 as the bottom of a texture.)

Free the pixels with `stbi_image_free(pixels);` once they have been copied – for now right away, at the
`// TODO:` for it.

Now do the first task, **load-image**: add the define and the include at the top of `main.cpp` and load the image
in `createTextureImage()`. Nothing visible changes yet; if the file can't be loaded the program stops with
`failed to load texture image!`.
:::
:::d3d12
In `LoadAssets()`, after the index buffer, a new block creates the first texture:

```cpp
    // Create the first texture: the container.
    {
        // Load the image. The last argument asks stb_image for 4 channels (RGBA), the
        // layout of DXGI_FORMAT_R8G8B8A8_UNORM, although container.png has no alpha.
        // No vertical flip: in Direct3D, texture coordinate v = 0 is the image's top row.
        int width, height, nrChannels;
        unsigned char* data = stbi_load("container.png", &width, &height, &nrChannels, 4);
        if (data == nullptr)
        {
            throw std::runtime_error("Failed to load texture container.png");
        }

        // Free the image memory.
        stbi_image_free(data);
    }
```

We ask for 4 channels although `container.png` has only three: the texture format we are going to use,
`DXGI_FORMAT_R8G8B8A8_UNORM`, has four, and DXGI has no 8-bit format with three channels at all.

Note that there is **no vertical flip**. Image files – and therefore `stb_image.h` – put the top row of the image
first, and in Direct3D the first row in memory is the row at v = 0, which is the **top** of the texture. The image
arrives upright as it is. (OpenGL tutorials call `stbi_set_flip_vertically_on_load(true)` here, because OpenGL
treats t = 0 as the bottom of a texture.)

Now do the first task, **load-image**: add the define and the include after `#include "d3dx12.h"` and add the block
above at the `// TODO:` after the index buffer. Nothing visible changes yet; if the file can't be loaded the program
stops with an exception.
:::

```quiz
The OpenGL version of this chapter calls `stbi_set_flip_vertically_on_load(true)`; the Vulkan and Direct3D 12 versions don't. Why?
- [ ] `stb_image.h` loads images upside down on some platforms, and only OpenGL corrects it
- [x] Image files store the top row first. OpenGL treats texture coordinate 0 on the vertical axis as the bottom of the image, Vulkan and Direct3D treat it as the top
- [ ] Vulkan and Direct3D 12 flip every image themselves when the texture is created
---
In all three APIs the first row you upload sits at vertical texture coordinate 0. In OpenGL that is the bottom of the texture, so the image is flipped while loading; in Vulkan and Direct3D v = 0 is the top, which matches the file.
```

## Generating a texture

:::opengl
Like any of the previous objects in OpenGL, textures are referenced with an ID; let's create one:

```cpp
    unsigned int texture1;
    glGenTextures(1, &texture1);
```

The `glGenTextures` function first takes as input how many textures we want to generate and stores them in a
`unsigned int` array given as its second argument (in our case just a single `unsigned int`). Just like other
objects we need to bind it so any subsequent texture commands will configure the currently bound texture:

```cpp
    glBindTexture(GL_TEXTURE_2D, texture1); // all upcoming GL_TEXTURE_2D operations now have effect on this texture object
    // set the texture wrapping parameters
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_S, GL_REPEAT); // set texture wrapping to GL_REPEAT (default wrapping method)
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_T, GL_REPEAT);
    // set texture filtering parameters
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, GL_LINEAR_MIPMAP_LINEAR);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, GL_LINEAR);
```

These are the wrapping and filtering options from the sections above. None of these calls names the texture: they
all change the texture that is bound to `GL_TEXTURE_2D` right now. When the program ends, the texture is deleted
like the buffers, with `glDeleteTextures(1, &texture1);` after `glDeleteBuffers(1, &EBO);`.

Now do the task **create-texture**: put these lines at the first `// TODO:` (before the image is loaded) and add
the `glDeleteTextures` call. Still nothing visible changes.

Now that the texture is bound, we can start generating a texture using the previously loaded image data. Textures
are generated with `glTexImage2D`:

```cpp
        glTexImage2D(GL_TEXTURE_2D, 0, GL_RGB, width, height, 0, GL_RGB, GL_UNSIGNED_BYTE, data);
        glGenerateMipmap(GL_TEXTURE_2D);
```

This is a large function with quite a few parameters so we'll walk through them step-by-step:

- The first argument specifies the texture target; setting this to `GL_TEXTURE_2D` means this operation will
  generate a texture on the currently bound texture object at the same target (so any textures bound to targets
  `GL_TEXTURE_1D` or `GL_TEXTURE_3D` will not be affected).
- The second argument specifies the mipmap level for which we want to create a texture for if you want to set each
  mipmap level manually, but we'll leave it at the base level which is `0`.
- The third argument tells OpenGL in what kind of format we want to store the texture. Our image has only `RGB`
  values so we'll store the texture with `RGB` values as well.
- The 4th and 5th argument sets the width and height of the resulting texture. We stored those earlier when loading
  the image so we'll use the corresponding variables.
- The next argument should always be `0` (some legacy stuff).
- The 7th and 8th argument specify the format and datatype of the source image. We loaded the image with `RGB`
  values and stored them as `char`s (bytes) so we'll pass in the corresponding values.
- The last argument is the actual image data.

Once `glTexImage2D` is called, the currently bound texture object now has the texture image attached to it.
However, currently it only has the base-level of the texture image loaded and if we want to use mipmaps we have to
specify all the different images manually (by continually incrementing the second argument) or, we could call
`glGenerateMipmap` after generating the texture. This will automatically generate all the required mipmaps for the
currently bound texture. OpenGL copies the data, so after this it is safe to free the image memory with
`stbi_image_free` – which is why the upload goes inside `if (data)`, before that call.

> By default OpenGL expects every row of the source data to start at a multiple of 4 bytes. A row of
> `container.png` is 256 × 3 = 768 bytes, so that is fine; for an RGB image whose width isn't a multiple of 4
> you'd call `glPixelStorei(GL_UNPACK_ALIGNMENT, 1);` before `glTexImage2D`.

Now do the task **upload**: put the two lines inside `if (data)`. The texture now holds the crate, but nothing
draws it yet, so the picture still doesn't change.
:::
:::vulkan
In OpenGL this section is short: `glGenTextures`, `glBindTexture`, `glTexImage2D` and `glGenerateMipmap`, and the
texture is ready. In Vulkan it is the longest part of the chapter, and it helps to see why before we start.
`glTexImage2D` does a lot of work that you never see: the driver picks GPU memory for the texture, chooses a
layout of the texels in that memory that suits the GPU, copies your bytes there (often through a hidden temporary
buffer), and makes sure no shader reads the texture before the copy has finished. Vulkan hides none of that. We
will:

1. copy the pixels into a **staging buffer**, a buffer in memory the CPU can write;
2. create a **`VkImage`** in fast GPU memory and allocate and bind its memory ourselves;
3. record commands that **transition the image's layout** and **copy** the buffer into the image;
4. create an **image view**, because shaders never read a `VkImage` directly; and
5. create a **sampler** with the filtering and addressing rules of the sections above.

The reward for all this code is control: nothing happens behind your back, so nothing stalls behind your back
either, and you decide where memory goes and when work runs. These steps follow vulkan-tutorial's chapters *Images*
and *Image view and sampler*.

### Staging buffer

The image will live in device-local memory, the fastest memory for the GPU, which the CPU usually cannot write. So
we first create a buffer in host-visible memory, copy the pixels into it, and later let the GPU copy them into the
image. This *staging buffer* needs a function that creates a buffer of any size and usage – vulkan-tutorial's
`createBuffer()`, the steps of `createVertexBuffer()` with parameters:

```cpp
    void createBuffer(VkDeviceSize size, VkBufferUsageFlags usage, VkMemoryPropertyFlags properties, VkBuffer& buffer, VkDeviceMemory& bufferMemory) {
        VkBufferCreateInfo bufferInfo{};
        bufferInfo.sType = VK_STRUCTURE_TYPE_BUFFER_CREATE_INFO;
        bufferInfo.size = size;
        bufferInfo.usage = usage;
        bufferInfo.sharingMode = VK_SHARING_MODE_EXCLUSIVE;

        if (vkCreateBuffer(device, &bufferInfo, nullptr, &buffer) != VK_SUCCESS) {
            throw std::runtime_error("failed to create buffer!");
        }

        VkMemoryRequirements memRequirements;
        vkGetBufferMemoryRequirements(device, buffer, &memRequirements);

        VkMemoryAllocateInfo allocInfo{};
        allocInfo.sType = VK_STRUCTURE_TYPE_MEMORY_ALLOCATE_INFO;
        allocInfo.allocationSize = memRequirements.size;
        allocInfo.memoryTypeIndex = findMemoryType(memRequirements.memoryTypeBits, properties);

        if (vkAllocateMemory(device, &allocInfo, nullptr, &bufferMemory) != VK_SUCCESS) {
            throw std::runtime_error("failed to allocate buffer memory!");
        }

        vkBindBufferMemory(device, buffer, bufferMemory, 0);
    }
```

In `createTextureImage()`, right after loading, the pixels go into the staging buffer:

```cpp
        VkDeviceSize imageSize = texWidth * texHeight * 4;

        VkBuffer stagingBuffer;
        VkDeviceMemory stagingBufferMemory;
        createBuffer(imageSize, VK_BUFFER_USAGE_TRANSFER_SRC_BIT, VK_MEMORY_PROPERTY_HOST_VISIBLE_BIT | VK_MEMORY_PROPERTY_HOST_COHERENT_BIT, stagingBuffer, stagingBufferMemory);

        void* data;
        vkMapMemory(device, stagingBufferMemory, 0, imageSize, 0, &data);
            memcpy(data, pixels, static_cast<size_t>(imageSize));
        vkUnmapMemory(device, stagingBufferMemory);
```

The size is 4 bytes per pixel because of `STBI_rgb_alpha`. `VK_BUFFER_USAGE_TRANSFER_SRC_BIT` says the buffer will
be the source of a copy. After the `memcpy` the pixels from `stb_image.h` are no longer needed, so the
`stbi_image_free(pixels);` stays after this code. The staging buffer is only needed until the copy into the image
has finished, so at the end of `createTextureImage()` it is destroyed again:

```cpp
        vkDestroyBuffer(device, stagingBuffer, nullptr);
        vkFreeMemory(device, stagingBufferMemory, nullptr);
```

Now do the task **staging-buffer**: add `createBuffer()` at its `// TODO:` and the staging code to
`createTextureImage()`. The picture doesn't change.

### Texture image

Although we could set up the shader to access the pixel values in the buffer, it's better to use image objects in
Vulkan for this purpose. Image objects make it easier and faster to retrieve colors by allowing us to use 2D
coordinates, for one. The image and its memory are new class members:

```cpp
    VkImage textureImage;
    VkDeviceMemory textureImageMemory;
```

Creating an image is very much like creating a buffer: fill in a create-info, create the object, ask for its memory
requirements, allocate fitting memory and bind it. We'll need this again for the second texture, so it goes into a
helper function:

```cpp
    void createImage(uint32_t width, uint32_t height, VkFormat format, VkImageTiling tiling, VkImageUsageFlags usage, VkMemoryPropertyFlags properties, VkImage& image, VkDeviceMemory& imageMemory) {
        VkImageCreateInfo imageInfo{};
        imageInfo.sType = VK_STRUCTURE_TYPE_IMAGE_CREATE_INFO;
        imageInfo.imageType = VK_IMAGE_TYPE_2D;
        imageInfo.extent.width = width;
        imageInfo.extent.height = height;
        imageInfo.extent.depth = 1;
        imageInfo.mipLevels = 1;
        imageInfo.arrayLayers = 1;
        imageInfo.format = format;
        imageInfo.tiling = tiling;
        imageInfo.initialLayout = VK_IMAGE_LAYOUT_UNDEFINED;
        imageInfo.usage = usage;
        imageInfo.samples = VK_SAMPLE_COUNT_1_BIT;
        imageInfo.sharingMode = VK_SHARING_MODE_EXCLUSIVE;

        if (vkCreateImage(device, &imageInfo, nullptr, &image) != VK_SUCCESS) {
            throw std::runtime_error("failed to create image!");
        }

        VkMemoryRequirements memRequirements;
        vkGetImageMemoryRequirements(device, image, &memRequirements);

        VkMemoryAllocateInfo allocInfo{};
        allocInfo.sType = VK_STRUCTURE_TYPE_MEMORY_ALLOCATE_INFO;
        allocInfo.allocationSize = memRequirements.size;
        allocInfo.memoryTypeIndex = findMemoryType(memRequirements.memoryTypeBits, properties);

        if (vkAllocateMemory(device, &allocInfo, nullptr, &imageMemory) != VK_SUCCESS) {
            throw std::runtime_error("failed to allocate image memory!");
        }

        vkBindImageMemory(device, image, imageMemory, 0);
    }
```

The image type tells Vulkan with what kind of coordinate system the texels in the image are going to be addressed:
1D, 2D or 3D. The `extent` is the size, with a depth of 1 for a 2D image. We use one mip level and one array layer,
and one sample (multisampling only matters for images used as attachments).

The `tiling` field can have one of two values:

- `VK_IMAGE_TILING_LINEAR`: texels are laid out in row-major order like our `pixels` array;
- `VK_IMAGE_TILING_OPTIMAL`: texels are laid out in an implementation defined order for optimal access.

Unlike the layout of an image, the tiling mode cannot be changed at a later time. Since we copy from a staging
buffer and only the GPU reads the image, we use `VK_IMAGE_TILING_OPTIMAL` for efficient access from the shader.

There are only two possible values for the `initialLayout` of an image: `VK_IMAGE_LAYOUT_UNDEFINED` (not usable by
the GPU and the very first transition will discard the texels) and `VK_IMAGE_LAYOUT_PREINITIALIZED` (the first
transition preserves them, useful only for linear images the CPU writes directly). We overwrite the whole image
with a copy anyway, so `UNDEFINED` is right.

In `createTextureImage()` we call it after the staging code:

```cpp
        // UNORM like the swap chain: the shaders read the bytes of the file unchanged (0..255 -> 0.0..1.0).
        createImage(texWidth, texHeight, VK_FORMAT_R8G8B8A8_UNORM, VK_IMAGE_TILING_OPTIMAL, VK_IMAGE_USAGE_TRANSFER_DST_BIT | VK_IMAGE_USAGE_SAMPLED_BIT, VK_MEMORY_PROPERTY_DEVICE_LOCAL_BIT, textureImage, textureImageMemory);
```

The image is the *destination* of the copy (`TRANSFER_DST`) and will be *sampled* by the shader (`SAMPLED`), and its
memory is `DEVICE_LOCAL`.

> **UNORM, not SRGB.** vulkan-tutorial uses `VK_FORMAT_R8G8B8A8_SRGB` here, together with an SRGB swap chain. This
> course's swap chain is `VK_FORMAT_B8G8R8A8_UNORM`, so the texture is UNORM too: the shader reads each byte as
> byte / 255 and writes it unchanged to the screen – the same colors as the OpenGL and Direct3D versions. We'll
> come back to sRGB in the chapter on gamma correction.

The image and its memory are destroyed in `cleanup()`, at their `// TODO:`:

```cpp
        vkDestroyImage(device, textureImage, nullptr);
        vkFreeMemory(device, textureImageMemory, nullptr);
```

Now do the task **texture-image**. The picture still doesn't change.

### Layout transitions

The image exists, but it is empty, and it is in the layout `VK_IMAGE_LAYOUT_UNDEFINED`. An image's *layout* is the
way its texels are arranged for a particular use, and every use needs the right one. You know this from the swap
chain images, which the render pass moves between layouts. For our texture we need two:

- `VK_IMAGE_LAYOUT_TRANSFER_DST_OPTIMAL`: optimal as destination of a transfer (copy) operation;
- `VK_IMAGE_LAYOUT_SHADER_READ_ONLY_OPTIMAL`: optimal for sampling from a shader.

Copies and layout transitions are GPU work, so they are recorded into a command buffer and submitted to a queue.
Two small helpers record and submit such one-time commands:

```cpp
    VkCommandBuffer beginSingleTimeCommands() {
        VkCommandBufferAllocateInfo allocInfo{};
        allocInfo.sType = VK_STRUCTURE_TYPE_COMMAND_BUFFER_ALLOCATE_INFO;
        allocInfo.level = VK_COMMAND_BUFFER_LEVEL_PRIMARY;
        allocInfo.commandPool = commandPool;
        allocInfo.commandBufferCount = 1;

        VkCommandBuffer commandBuffer;
        vkAllocateCommandBuffers(device, &allocInfo, &commandBuffer);

        VkCommandBufferBeginInfo beginInfo{};
        beginInfo.sType = VK_STRUCTURE_TYPE_COMMAND_BUFFER_BEGIN_INFO;
        beginInfo.flags = VK_COMMAND_BUFFER_USAGE_ONE_TIME_SUBMIT_BIT;

        vkBeginCommandBuffer(commandBuffer, &beginInfo);

        return commandBuffer;
    }

    void endSingleTimeCommands(VkCommandBuffer commandBuffer) {
        vkEndCommandBuffer(commandBuffer);

        VkSubmitInfo submitInfo{};
        submitInfo.sType = VK_STRUCTURE_TYPE_SUBMIT_INFO;
        submitInfo.commandBufferCount = 1;
        submitInfo.pCommandBuffers = &commandBuffer;

        vkQueueSubmit(graphicsQueue, 1, &submitInfo, VK_NULL_HANDLE);
        vkQueueWaitIdle(graphicsQueue);

        vkFreeCommandBuffers(device, commandPool, 1, &commandBuffer);
    }
```

`vkQueueWaitIdle` waits until the queue has finished – simple, and fine for loading at start-up.

One of the most common ways to perform layout transitions is using an *image memory barrier*. A pipeline barrier
like that is generally used to synchronize access to resources, like ensuring that a write to a buffer completes
before reading from it, but it can also be used to transition image layouts:

```cpp
    void transitionImageLayout(VkImage image, VkFormat format, VkImageLayout oldLayout, VkImageLayout newLayout) {
        VkCommandBuffer commandBuffer = beginSingleTimeCommands();

        VkImageMemoryBarrier barrier{};
        barrier.sType = VK_STRUCTURE_TYPE_IMAGE_MEMORY_BARRIER;
        barrier.oldLayout = oldLayout;
        barrier.newLayout = newLayout;
        barrier.srcQueueFamilyIndex = VK_QUEUE_FAMILY_IGNORED;
        barrier.dstQueueFamilyIndex = VK_QUEUE_FAMILY_IGNORED;
        barrier.image = image;
        barrier.subresourceRange.aspectMask = VK_IMAGE_ASPECT_COLOR_BIT;
        barrier.subresourceRange.baseMipLevel = 0;
        barrier.subresourceRange.levelCount = 1;
        barrier.subresourceRange.baseArrayLayer = 0;
        barrier.subresourceRange.layerCount = 1;

        VkPipelineStageFlags sourceStage;
        VkPipelineStageFlags destinationStage;

        if (oldLayout == VK_IMAGE_LAYOUT_UNDEFINED && newLayout == VK_IMAGE_LAYOUT_TRANSFER_DST_OPTIMAL) {
            barrier.srcAccessMask = 0;
            barrier.dstAccessMask = VK_ACCESS_TRANSFER_WRITE_BIT;

            sourceStage = VK_PIPELINE_STAGE_TOP_OF_PIPE_BIT;
            destinationStage = VK_PIPELINE_STAGE_TRANSFER_BIT;
        } else if (oldLayout == VK_IMAGE_LAYOUT_TRANSFER_DST_OPTIMAL && newLayout == VK_IMAGE_LAYOUT_SHADER_READ_ONLY_OPTIMAL) {
            barrier.srcAccessMask = VK_ACCESS_TRANSFER_WRITE_BIT;
            barrier.dstAccessMask = VK_ACCESS_SHADER_READ_BIT;

            sourceStage = VK_PIPELINE_STAGE_TRANSFER_BIT;
            destinationStage = VK_PIPELINE_STAGE_FRAGMENT_SHADER_BIT;
        } else {
            throw std::invalid_argument("unsupported layout transition!");
        }

        vkCmdPipelineBarrier(
            commandBuffer,
            sourceStage, destinationStage,
            0,
            0, nullptr,
            0, nullptr,
            1, &barrier
        );

        endSingleTimeCommands(commandBuffer);
    }
```

The barrier names the old and the new layout and the part of the image it applies to (the color aspect, our single
mip level and layer). We don't move the image to another queue family, hence `VK_QUEUE_FAMILY_IGNORED`. The access
masks and pipeline stages say which work must happen before the barrier and which work must wait for it:

- `UNDEFINED → TRANSFER_DST_OPTIMAL`: nothing needs to happen before (access mask 0, the earliest stage
  `TOP_OF_PIPE`), and the transfer writes must wait for the transition.
- `TRANSFER_DST_OPTIMAL → SHADER_READ_ONLY_OPTIMAL`: the transfer writes must be finished and visible before the
  fragment shader reads (`SHADER_READ` in the `FRAGMENT_SHADER` stage).

So the barrier does two jobs at once: it changes the layout, and it orders the copy before the shader reads. The
copy itself is one command, `vkCmdCopyBufferToImage`, with a region that says which part of the buffer goes to
which part of the image:

```cpp
    void copyBufferToImage(VkBuffer buffer, VkImage image, uint32_t width, uint32_t height) {
        VkCommandBuffer commandBuffer = beginSingleTimeCommands();

        VkBufferImageCopy region{};
        region.bufferOffset = 0;
        region.bufferRowLength = 0;
        region.bufferImageHeight = 0;
        region.imageSubresource.aspectMask = VK_IMAGE_ASPECT_COLOR_BIT;
        region.imageSubresource.mipLevel = 0;
        region.imageSubresource.baseArrayLayer = 0;
        region.imageSubresource.layerCount = 1;
        region.imageOffset = {0, 0, 0};
        region.imageExtent = {
            width,
            height,
            1
        };

        vkCmdCopyBufferToImage(commandBuffer, buffer, image, VK_IMAGE_LAYOUT_TRANSFER_DST_OPTIMAL, 1, &region);

        endSingleTimeCommands(commandBuffer);
    }
```

`bufferRowLength` and `bufferImageHeight` of 0 mean the pixels are tightly packed, as `stb_image.h` delivers them.
The fourth parameter of `vkCmdCopyBufferToImage` says which layout the image is in during the copy. With the
helpers in place, `createTextureImage()` transitions, copies and transitions again, between `createImage` and
destroying the staging buffer:

```cpp
        transitionImageLayout(textureImage, VK_FORMAT_R8G8B8A8_UNORM, VK_IMAGE_LAYOUT_UNDEFINED, VK_IMAGE_LAYOUT_TRANSFER_DST_OPTIMAL);
            copyBufferToImage(stagingBuffer, textureImage, static_cast<uint32_t>(texWidth), static_cast<uint32_t>(texHeight));
        transitionImageLayout(textureImage, VK_FORMAT_R8G8B8A8_UNORM, VK_IMAGE_LAYOUT_TRANSFER_DST_OPTIMAL, VK_IMAGE_LAYOUT_SHADER_READ_ONLY_OPTIMAL);
```

Now do the task **layout-transitions**: add the four helpers at their `// TODO:` comments and the three calls in
`createTextureImage()`. The picture doesn't change, and there are still no validation messages.

### Image view

Images are accessed through image views rather than directly, both for the swap chain images and for textures. A
view says how to interpret the image: as a 2D image, with which format, which aspect and which mip levels and
layers. The texture view is a new member, `VkImageView textureImageView;`, and since the code is the same as for the
swap chain images apart from the image and the format, it goes into a helper:

```cpp
    VkImageView createImageView(VkImage image, VkFormat format) {
        VkImageViewCreateInfo viewInfo{};
        viewInfo.sType = VK_STRUCTURE_TYPE_IMAGE_VIEW_CREATE_INFO;
        viewInfo.image = image;
        viewInfo.viewType = VK_IMAGE_VIEW_TYPE_2D;
        viewInfo.format = format;
        viewInfo.subresourceRange.aspectMask = VK_IMAGE_ASPECT_COLOR_BIT;
        viewInfo.subresourceRange.baseMipLevel = 0;
        viewInfo.subresourceRange.levelCount = 1;
        viewInfo.subresourceRange.baseArrayLayer = 0;
        viewInfo.subresourceRange.layerCount = 1;

        VkImageView imageView;
        if (vkCreateImageView(device, &viewInfo, nullptr, &imageView) != VK_SUCCESS) {
            throw std::runtime_error("failed to create image view!");
        }

        return imageView;
    }
```

The `components` swizzle is left out: zero-initialized, it is `VK_COMPONENT_SWIZZLE_IDENTITY`. The long create-info
in `createImageViews()` shrinks to one line, `swapChainImageViews[i] = createImageView(swapChainImages[i],
swapChainImageFormat);`, and `createTextureImageView()` creates the texture's view:

```cpp
        textureImageView = createImageView(textureImage, VK_FORMAT_R8G8B8A8_UNORM);
```

In `cleanup()` the view is destroyed with `vkDestroyImageView(device, textureImageView, nullptr);`.

Now do the task **image-view**. The picture doesn't change.

### Sampler

It is possible for shaders to read texels directly from images, but that is not very common when they are used as
textures. Textures are usually accessed through samplers, which will apply filtering and transformations to compute
the final color that is retrieved. The sampler is a new member, `VkSampler textureSampler;`, created in
`createTextureSampler()`:

```cpp
        VkPhysicalDeviceProperties properties{};
        vkGetPhysicalDeviceProperties(physicalDevice, &properties);

        VkSamplerCreateInfo samplerInfo{};
        samplerInfo.sType = VK_STRUCTURE_TYPE_SAMPLER_CREATE_INFO;
        samplerInfo.magFilter = VK_FILTER_LINEAR;
        samplerInfo.minFilter = VK_FILTER_LINEAR;
        samplerInfo.addressModeU = VK_SAMPLER_ADDRESS_MODE_REPEAT;
        samplerInfo.addressModeV = VK_SAMPLER_ADDRESS_MODE_REPEAT;
        samplerInfo.addressModeW = VK_SAMPLER_ADDRESS_MODE_REPEAT;
        samplerInfo.anisotropyEnable = VK_TRUE;
        samplerInfo.maxAnisotropy = properties.limits.maxSamplerAnisotropy;
        samplerInfo.borderColor = VK_BORDER_COLOR_INT_OPAQUE_BLACK;
        samplerInfo.unnormalizedCoordinates = VK_FALSE;
        samplerInfo.compareEnable = VK_FALSE;
        samplerInfo.compareOp = VK_COMPARE_OP_ALWAYS;
        samplerInfo.mipmapMode = VK_SAMPLER_MIPMAP_MODE_LINEAR;

        if (vkCreateSampler(device, &samplerInfo, nullptr, &textureSampler) != VK_SUCCESS) {
            throw std::runtime_error("failed to create texture sampler!");
        }
```

You know the filters and address modes from the sections above: linear filtering and repeat, like OpenGL's
`GL_LINEAR` and `GL_REPEAT`. The other fields:

- `anisotropyEnable` and `maxAnisotropy`: anisotropic filtering, limited by what the device supports, which we read
  from its properties. It is an optional device feature, so it must be enabled when the logical device is created
  – in `createLogicalDevice()`, `deviceFeatures.samplerAnisotropy = VK_TRUE;` – and `isDeviceSuitable()` should
  only accept devices that have it:

  ```cpp
        VkPhysicalDeviceFeatures supportedFeatures;
        vkGetPhysicalDeviceFeatures(device, &supportedFeatures);

        return indices.isComplete() && extensionsSupported && swapChainAdequate && supportedFeatures.samplerAnisotropy;
  ```

  Using anisotropy without enabling the feature is a validation error.
- `borderColor`: only used with clamp-to-border.
- `unnormalizedCoordinates = VK_FALSE`: coordinates run from 0 to 1, not from 0 to the width in texels.
- `compareEnable`: a comparison is mainly used for percentage-closer filtering on shadow maps; off here.
- `mipmapMode`: how to choose between mip levels; see *Mipmaps*.

Note that the sampler does not reference a `VkImage` anywhere. The sampler is a distinct object that provides an
interface to extract colors from a texture. It can be applied to any image you want, whether it is 1D, 2D or 3D.
This is different from OpenGL, which combines texture images and filtering into a single state. The sampler is
destroyed in `cleanup()` with `vkDestroySampler(device, textureSampler, nullptr);`.

Now do the task **sampler**: create the sampler, enable the device feature and require it in
`isDeviceSuitable()`. The picture still doesn't change – the shader doesn't know about any of this yet.
:::
:::d3d12
In OpenGL this section is short: `glGenTextures`, `glBindTexture`, `glTexImage2D` and `glGenerateMipmap`, and the
texture is ready. In Direct3D 12 it takes more steps, because `glTexImage2D` does work that Direct3D 12 leaves to
you: the driver picks GPU memory for the texture, copies your bytes there through a temporary buffer, and makes sure
nothing reads the texture before the copy is done. Following D3D12HelloTexture, we will:

1. create the **texture** in a *default heap*, memory that only the GPU uses;
2. copy the pixels into an **upload heap** and record a GPU copy into the texture, then a **barrier** that makes
   the texture readable by the pixel shader, and execute that work and wait for it; and
3. create a **shader resource view** (SRV) of the texture in a shader-visible descriptor heap.

### The texture

The texture is a resource like the vertex buffer, created with `CreateCommittedResource`, but it is described as a
2D texture and placed in a different kind of heap. It is a new member:

```cpp
    ComPtr<ID3D12Resource> m_texture1;
```

and in the container's block, after loading the image:

```cpp
        // Describe and create a Texture2D in a default heap (memory only the GPU uses).
        // It starts in the COPY_DEST state: the pixels are copied into it next.
        D3D12_RESOURCE_DESC textureDesc = {};
        textureDesc.MipLevels = 1;
        textureDesc.Format = DXGI_FORMAT_R8G8B8A8_UNORM;
        textureDesc.Width = static_cast<UINT64>(width);
        textureDesc.Height = static_cast<UINT>(height);
        textureDesc.Flags = D3D12_RESOURCE_FLAG_NONE;
        textureDesc.DepthOrArraySize = 1;
        textureDesc.SampleDesc.Count = 1;
        textureDesc.SampleDesc.Quality = 0;
        textureDesc.Dimension = D3D12_RESOURCE_DIMENSION_TEXTURE2D;

        CD3DX12_HEAP_PROPERTIES heapProperties(D3D12_HEAP_TYPE_DEFAULT);
        ThrowIfFailed(m_device->CreateCommittedResource(
            &heapProperties,
            D3D12_HEAP_FLAG_NONE,
            &textureDesc,
            D3D12_RESOURCE_STATE_COPY_DEST,
            nullptr,
            IID_PPV_ARGS(&m_texture1)));
```

The description: a 2D texture of `width` × `height` texels, one mip level, one array slice (`DepthOrArraySize`),
one sample per texel, and the format `DXGI_FORMAT_R8G8B8A8_UNORM` – four 8-bit channels that the shader reads as
values from 0.0 to 1.0, the bytes of the file unchanged, like OpenGL's `GL_RGB`/`GL_RGBA` and the course's
`R8G8B8A8_UNORM` swap chain. Note that we don't choose how the texels are arranged in memory: the GPU uses its own
layout for textures, which is one reason the CPU can't simply write into it.

The heap is a `D3D12_HEAP_TYPE_DEFAULT` heap this time. The vertex buffer lives in an upload heap, which the CPU can
write and the GPU reads across the bus every time it needs the data. A default heap is memory the GPU reads fast,
but the CPU can't write it – the pixels get there by a GPU copy. That is why the texture is created in the state
`D3D12_RESOURCE_STATE_COPY_DEST`: the first thing that happens to it is a copy. (As in *Hello Triangle*, the heap
properties are a local variable, not the address of a temporary.)

Now do the task **texture**. The picture doesn't change.

### Uploading the pixels

To get the pixels into the default heap we need a buffer in an upload heap, big enough for the texture, and a copy.
The copy is GPU work, so it is recorded into a command list. That changes the end of `LoadAssets()` a little.
Until now the command list was closed right after it was created, because there was nothing to record. Now it stays
open, and the texture uploads are recorded into it:

```cpp
    // Command lists are created in the recording state. This one stays open: the
    // texture upload below is recorded into it, and it is executed at the end.
```

The upload heap must stay alive until the GPU has executed the copy, so it is declared in `LoadAssets()` itself,
before the texture's block:

```cpp
    // Note: ComPtr's are CPU objects, but an upload heap needs to stay in scope until
    // the command list that copies from it has finished executing on the GPU.
    // We will flush the GPU at the end of this method to ensure it is not
    // prematurely destroyed.
    ComPtr<ID3D12Resource> textureUploadHeap1;
```

In the block, after `CreateCommittedResource` for the texture:

```cpp
        // The upload heap: a buffer in memory the CPU can write, big enough for the
        // texture's rows as the GPU lays them out (GetRequiredIntermediateSize).
        const UINT64 uploadBufferSize = GetRequiredIntermediateSize(m_texture1.Get(), 0, 1);

        // Create the GPU upload buffer.
        CD3DX12_HEAP_PROPERTIES uploadHeapProperties(D3D12_HEAP_TYPE_UPLOAD);
        CD3DX12_RESOURCE_DESC uploadBufferDesc = CD3DX12_RESOURCE_DESC::Buffer(uploadBufferSize);
        ThrowIfFailed(m_device->CreateCommittedResource(
            &uploadHeapProperties,
            D3D12_HEAP_FLAG_NONE,
            &uploadBufferDesc,
            D3D12_RESOURCE_STATE_GENERIC_READ,
            nullptr,
            IID_PPV_ARGS(&textureUploadHeap1)));

        // Copy data to the intermediate upload heap and then schedule a copy
        // from the upload heap to the Texture2D. UpdateSubresources copies the pixels
        // into the upload heap right away (on the CPU), so the image can be freed after
        // it; the GPU copies them into the texture when the command list executes.
        D3D12_SUBRESOURCE_DATA textureData = {};
        textureData.pData = data;
        textureData.RowPitch = width * 4;                          // bytes per row: 4 per pixel
        textureData.SlicePitch = textureData.RowPitch * height;    // bytes in the whole image

        UpdateSubresources(m_commandList.Get(), m_texture1.Get(), textureUploadHeap1.Get(), 0, 0, 1, &textureData);

        // After the copy, the texture is read by the pixel shader.
        CD3DX12_RESOURCE_BARRIER barrier = CD3DX12_RESOURCE_BARRIER::Transition(m_texture1.Get(), D3D12_RESOURCE_STATE_COPY_DEST, D3D12_RESOURCE_STATE_PIXEL_SHADER_RESOURCE);
        m_commandList->ResourceBarrier(1, &barrier);
```

Step by step:

- `GetRequiredIntermediateSize(m_texture1.Get(), 0, 1)` asks how big the upload buffer must be for subresource 0
  (our single mip level) of the texture. That can be more than `width * height * 4`: in a buffer that is copied
  into a texture, every row must start at a multiple of 256 bytes (`D3D12_TEXTURE_DATA_PITCH_ALIGNMENT`). Our rows
  are 1024 bytes, which happens to fit, but the function handles any size.
- The upload buffer is an ordinary buffer in an upload heap, in the state `GENERIC_READ`, like the vertex buffer.
- `D3D12_SUBRESOURCE_DATA` describes our pixels: where they are, how many bytes one row has (`RowPitch`) and how
  many the whole image has (`SlicePitch`).
- `UpdateSubresources` is a helper from `d3dx12.h`. It works out the layout the texture's copy needs, maps the
  upload buffer and copies our pixels into it row by row – on the CPU, right away – and then records a
  `CopyTextureRegion` from the upload buffer into the texture on the command list. That copy only happens on the
  GPU when the command list executes.
- The barrier moves the texture from `COPY_DEST` to `PIXEL_SHADER_RESOURCE` after the copy, so the pixel shader
  may read it – and only after the copy. You know resource barriers from the back buffers, which move between
  `PRESENT` and `RENDER_TARGET` every frame.

Because `UpdateSubresources` has already copied the pixels into the upload buffer, `stbi_image_free(data)` can stay
at the end of the block. The upload buffer, however, must stay alive until the GPU has executed the copy. So at the
end of `LoadAssets()` we close the command list, execute it and wait:

```cpp
    // Close the command list and execute it to begin the initial GPU setup.
    ThrowIfFailed(m_commandList->Close());
    ID3D12CommandList* ppCommandLists[] = { m_commandList.Get() };
    m_commandQueue->ExecuteCommandLists(_countof(ppCommandLists), ppCommandLists);
```

and at the end of the synchronization block, once the fence and its event exist:

```cpp
        // Wait for the command list to execute; we are reusing the same command
        // list in our main loop but for now, we just want to wait for setup to
        // complete before continuing. Only then may the upload heap go away.
        WaitForPreviousFrame();
```

When `LoadAssets()` returns, `textureUploadHeap1` is released – safely, because the GPU has finished with it.

Now do the task **upload**: remove the early `Close()`, declare the upload heap, add the upload code and the
barrier to the block, and execute and wait at the end of `LoadAssets()`. The picture doesn't change.

### Shader resource view

A shader doesn't read a resource directly. It reads it through a *descriptor*, a small record that says how to
interpret the resource: here a *shader resource view* (SRV) that says "a 2D texture with this format and this many
mip levels". You know descriptors from the render target views of the back buffers, which live in an RTV descriptor
heap. SRVs live in a heap of the type `D3D12_DESCRIPTOR_HEAP_TYPE_CBV_SRV_UAV` (constant buffer, shader resource and
unordered access views share one heap type), and this heap must be **shader visible** so the shaders can reach the
descriptors in it – the RTV heap is not. A new member, `ComPtr<ID3D12DescriptorHeap> m_srvHeap;`, is created in
`LoadPipeline()` next to the RTV heap:

```cpp
        // Describe and create a shader resource view (SRV) heap for the texture.
        // Shader visible: the shaders can read the descriptors in it.
        D3D12_DESCRIPTOR_HEAP_DESC srvHeapDesc = {};
        srvHeapDesc.NumDescriptors = 1;
        srvHeapDesc.Type = D3D12_DESCRIPTOR_HEAP_TYPE_CBV_SRV_UAV;
        srvHeapDesc.Flags = D3D12_DESCRIPTOR_HEAP_FLAG_SHADER_VISIBLE;
        ThrowIfFailed(m_device->CreateDescriptorHeap(&srvHeapDesc, IID_PPV_ARGS(&m_srvHeap)));
```

The SRV goes into the heap's first slot, after the barrier in the container's block:

```cpp
        // Describe and create a SRV for the texture, in the first slot of the SRV heap.
        D3D12_SHADER_RESOURCE_VIEW_DESC srvDesc = {};
        srvDesc.Shader4ComponentMapping = D3D12_DEFAULT_SHADER_4_COMPONENT_MAPPING;
        srvDesc.Format = textureDesc.Format;
        srvDesc.ViewDimension = D3D12_SRV_DIMENSION_TEXTURE2D;
        srvDesc.Texture2D.MipLevels = 1;
        m_device->CreateShaderResourceView(m_texture1.Get(), &srvDesc, m_srvHeap->GetCPUDescriptorHandleForHeapStart());
```

`D3D12_DEFAULT_SHADER_4_COMPONENT_MAPPING` hands the channels to the shader unchanged (red as red, and so on). The
view's format and dimension match the texture, with its one mip level.

Now do the task **srv**. The picture still doesn't change – the shader doesn't know about any of this yet.
:::

:::opengl
```quiz
`glTexParameteri` and `glTexImage2D` take no texture object as an argument. Which texture do they change?
- [ ] The texture created most recently by `glGenTextures`
- [x] The texture currently bound to `GL_TEXTURE_2D` (of the active texture unit), which is why `glBindTexture(GL_TEXTURE_2D, texture1)` comes first
- [ ] Every texture object at once
---
OpenGL is a state machine: these functions act on whatever object is bound to the target you name. Binding `texture1` first makes all following `GL_TEXTURE_2D` calls configure and fill that texture.
```
:::
:::vulkan
```quiz
Why does `createTextureImage()` copy the pixels into a staging buffer first instead of writing them into the image directly?
- [ ] Because a staging buffer is the only way to change an image's layout
- [x] The image lives in device-local memory with optimal tiling: the CPU generally can't map that memory and doesn't know the texel arrangement, so the GPU copies from a host-visible buffer with `vkCmdCopyBufferToImage`
- [ ] Because `stbi_load` returns memory that Vulkan is not allowed to read
---
Device-local memory is fastest for the GPU but usually not host-visible, and `VK_IMAGE_TILING_OPTIMAL` uses an implementation-defined order. The copy command does the rearranging; the layout transitions are done by the barriers around it.
```
:::
:::d3d12
```quiz
Why must `textureUploadHeap1` stay alive until `WaitForPreviousFrame()` at the end of `LoadAssets()` has returned?
- [x] `UpdateSubresources` only records the copy into the texture; the GPU reads the upload heap when the command list executes, so releasing it earlier would free memory the GPU still has to read
- [ ] Because the SRV points at the upload heap, not at the texture
- [ ] Because the pixel shader reads the texture from the upload heap every frame
---
The CPU part of `UpdateSubresources` (copying the pixels into the upload heap) happens at once, which is why the image can be freed right after it. The GPU part runs later, when the command list is executed – and the fence wait makes sure it has finished before the `ComPtr` goes out of scope.
```
:::

## Applying textures

:::opengl
For the upcoming sections we will use the rectangle shape drawn with `glDrawElements` from the final part of the
*Hello Triangle* chapter. We need to inform OpenGL how to sample the texture so we'll have to update the vertex data
with the texture coordinates:

```cpp
    float vertices[] = {
        // positions          // colors           // texture coords
         0.5f,  0.5f, 0.0f,   1.0f, 0.0f, 0.0f,   1.0f, 1.0f, // top right
         0.5f, -0.5f, 0.0f,   0.0f, 1.0f, 0.0f,   1.0f, 0.0f, // bottom right
        -0.5f, -0.5f, 0.0f,   0.0f, 0.0f, 1.0f,   0.0f, 0.0f, // bottom left
        -0.5f,  0.5f, 0.0f,   1.0f, 1.0f, 0.0f,   0.0f, 1.0f  // top left
    };
```

Since we've added an extra vertex attribute we again have to notify OpenGL of the new vertex format: each vertex is
now 8 floats – position, color, texture coordinates. The stride of all three attributes becomes `8 * sizeof(float)`,
and the texture coordinates start after 6 floats:

```cpp
    // position attribute
    glVertexAttribPointer(0, 3, GL_FLOAT, GL_FALSE, 8 * sizeof(float), (void*)0);
    glEnableVertexAttribArray(0);
    // color attribute
    glVertexAttribPointer(1, 3, GL_FLOAT, GL_FALSE, 8 * sizeof(float), (void*)(3 * sizeof(float)));
    glEnableVertexAttribArray(1);
    // texture coord attribute
    glVertexAttribPointer(2, 2, GL_FLOAT, GL_FALSE, 8 * sizeof(float), (void*)(6 * sizeof(float)));
    glEnableVertexAttribArray(2);
```

Next we need to alter the vertex shader to accept the texture coordinates as a vertex attribute and then forward the
coordinates to the fragment shader:

```glsl
#version 330 core
layout (location = 0) in vec3 aPos;
layout (location = 1) in vec3 aColor;
layout (location = 2) in vec2 aTexCoord;

out vec3 ourColor;
out vec2 TexCoord;

void main()
{
    gl_Position = vec4(aPos, 1.0);
    ourColor = aColor;
    TexCoord = vec2(aTexCoord.x, aTexCoord.y);
}
```

Now do the task **texture-coords**. Nothing changes on screen yet: the fragment shader still outputs the vertex
color.

The fragment shader should then accept the `TexCoord` output variable as an input variable. The fragment shader
should also have access to the texture object, but how do we pass the texture object to the fragment shader? GLSL
has a built-in data-type for texture objects called a *sampler* that takes as a postfix the texture type we want
e.g. `sampler1D`, `sampler3D` or in our case `sampler2D`. We can then add a texture to the fragment shader by simply
declaring a `uniform sampler2D` that we later assign our texture to:

```glsl
#version 330 core
out vec4 FragColor;

in vec3 ourColor;
in vec2 TexCoord;

// texture sampler
uniform sampler2D texture1;

void main()
{
    FragColor = texture(texture1, TexCoord);
}
```

To sample the color of a texture we use GLSL's built-in `texture` function that takes as its first argument a
texture sampler and as its second argument the corresponding texture coordinates. The `texture` function then
samples the corresponding color value using the texture parameters we set earlier. The output of this fragment
shader is then the (filtered) color of the texture at the (interpolated) texture coordinate.

All that's left to do now is to bind the texture before calling `glDrawElements` and it will then automatically
assign the texture to the fragment shader's sampler. In the render loop, before `// render container`:

```cpp
        // bind Texture
        glBindTexture(GL_TEXTURE_2D, texture1);
```

Now do the task **sample**. If you did everything right you should see the crate on the rectangle – upright, with
its dark frame along the edges and the dark diagonal brace running from the bottom-left to the top-right corner.

> We never told the sampler `texture1` which texture to use. A sampler uniform that is never set has the value 0,
> which means *texture unit 0* – and that is the unit `glBindTexture` binds to by default. The next section explains
> texture units.

We can also mix the resulting texture color with the vertex colors. We simply multiply the resulting texture color
with the vertex color in the fragment shader to mix both colors:

```glsl
    FragColor = texture(texture1, TexCoord) * vec4(ourColor, 1.0);
```

Now do the task **tint**. The result should be a mixture of the vertex's color and the texture's color: a "funky"
crate, yellow at the top left, red at the top right, green at the bottom right and very dark blue at the bottom
left. Multiplying colors keeps, per channel, only as much of the texture as the vertex color lets through: the
crate's brown has hardly any blue, so the blue corner turns almost black.
:::
:::vulkan
Before the shader can sample the texture, it needs a way to *find* it. In OpenGL you bind a texture to a texture
unit and the sampler uniform reads from that unit. Vulkan has no texture units. Resources like images and buffers
reach shaders through **descriptors**, grouped into **descriptor sets**. This takes three parts, which
vulkan-tutorial builds in its chapters *Descriptor layout and buffer*, *Descriptor pool and sets* and *Combined
image sampler* (it starts with a uniform buffer; we don't have one yet, so our set holds only textures):

1. a **descriptor set layout** that says what kinds of descriptors the shaders expect at which bindings – part of
   the pipeline layout;
2. a **descriptor pool** to allocate a **descriptor set** from, and an update that points the set's descriptors at
   our image view and sampler;
3. binding the set in the command buffer before drawing.

### Descriptor set layout

The descriptor type we need is a *combined image sampler*: an image view and a sampler together, which the shader
sees as one `sampler2D` – much like an OpenGL texture with its parameters. In `createDescriptorSetLayout()`:

```cpp
        VkDescriptorSetLayoutBinding samplerLayoutBinding{};
        samplerLayoutBinding.binding = 0;
        samplerLayoutBinding.descriptorCount = 1;
        samplerLayoutBinding.descriptorType = VK_DESCRIPTOR_TYPE_COMBINED_IMAGE_SAMPLER;
        samplerLayoutBinding.pImmutableSamplers = nullptr;
        samplerLayoutBinding.stageFlags = VK_SHADER_STAGE_FRAGMENT_BIT;

        std::array<VkDescriptorSetLayoutBinding, 1> bindings = {samplerLayoutBinding};
        VkDescriptorSetLayoutCreateInfo layoutInfo{};
        layoutInfo.sType = VK_STRUCTURE_TYPE_DESCRIPTOR_SET_LAYOUT_CREATE_INFO;
        layoutInfo.bindingCount = static_cast<uint32_t>(bindings.size());
        layoutInfo.pBindings = bindings.data();

        if (vkCreateDescriptorSetLayout(device, &layoutInfo, nullptr, &descriptorSetLayout) != VK_SUCCESS) {
            throw std::runtime_error("failed to create descriptor set layout!");
        }
```

Binding 0 holds one combined image sampler, read by the fragment shader. (`pImmutableSamplers` could bake a sampler
into the layout; we don't need that.) The layout is a member, `VkDescriptorSetLayout descriptorSetLayout;`, and it
becomes part of the pipeline layout in `createGraphicsPipeline()` – which is why `initVulkan()` creates it before
the pipeline:

```cpp
        pipelineLayoutInfo.setLayoutCount = 1;
        pipelineLayoutInfo.pSetLayouts = &descriptorSetLayout;
```

In `cleanup()` it is destroyed with `vkDestroyDescriptorSetLayout(device, descriptorSetLayout, nullptr);`.

Now do the task **descriptor-layout**. The picture doesn't change.

### Descriptor pool and set

Descriptor sets can't be created directly, they must be allocated from a pool like command buffers. The pool says
how many descriptors of which type, and how many sets, it can hand out. In `createDescriptorPool()`:

```cpp
        std::array<VkDescriptorPoolSize, 1> poolSizes{};
        poolSizes[0].type = VK_DESCRIPTOR_TYPE_COMBINED_IMAGE_SAMPLER;
        poolSizes[0].descriptorCount = 1;

        VkDescriptorPoolCreateInfo poolInfo{};
        poolInfo.sType = VK_STRUCTURE_TYPE_DESCRIPTOR_POOL_CREATE_INFO;
        poolInfo.poolSizeCount = static_cast<uint32_t>(poolSizes.size());
        poolInfo.pPoolSizes = poolSizes.data();
        poolInfo.maxSets = 1;

        if (vkCreateDescriptorPool(device, &poolInfo, nullptr, &descriptorPool) != VK_SUCCESS) {
            throw std::runtime_error("failed to create descriptor pool!");
        }
```

vulkan-tutorial allocates one set per frame in flight, because its uniform buffer changes every frame. This course
renders one frame at a time and our set never changes, so **one** set is enough: `maxSets = 1`. In
`createDescriptorSets()` we allocate it and fill in its descriptor:

```cpp
        VkDescriptorSetAllocateInfo allocInfo{};
        allocInfo.sType = VK_STRUCTURE_TYPE_DESCRIPTOR_SET_ALLOCATE_INFO;
        allocInfo.descriptorPool = descriptorPool;
        allocInfo.descriptorSetCount = 1;
        allocInfo.pSetLayouts = &descriptorSetLayout;

        if (vkAllocateDescriptorSets(device, &allocInfo, &descriptorSet) != VK_SUCCESS) {
            throw std::runtime_error("failed to allocate descriptor sets!");
        }

        VkDescriptorImageInfo imageInfo{};
        imageInfo.imageLayout = VK_IMAGE_LAYOUT_SHADER_READ_ONLY_OPTIMAL;
        imageInfo.imageView = textureImageView;
        imageInfo.sampler = textureSampler;

        std::array<VkWriteDescriptorSet, 1> descriptorWrites{};

        descriptorWrites[0].sType = VK_STRUCTURE_TYPE_WRITE_DESCRIPTOR_SET;
        descriptorWrites[0].dstSet = descriptorSet;
        descriptorWrites[0].dstBinding = 0;
        descriptorWrites[0].dstArrayElement = 0;
        descriptorWrites[0].descriptorType = VK_DESCRIPTOR_TYPE_COMBINED_IMAGE_SAMPLER;
        descriptorWrites[0].descriptorCount = 1;
        descriptorWrites[0].pImageInfo = &imageInfo;

        vkUpdateDescriptorSets(device, static_cast<uint32_t>(descriptorWrites.size()), descriptorWrites.data(), 0, nullptr);
```

The set is allocated with our layout. The `VkDescriptorImageInfo` names the image view, the sampler and the layout
the image will be in when the shader reads it – the layout our last barrier moved it to. A `VkWriteDescriptorSet`
writes that into binding 0 of the set, and `vkUpdateDescriptorSets` applies the write.

Finally, `recordCommandBuffer()` binds the set, after `vkCmdBindIndexBuffer`:

```cpp
        vkCmdBindDescriptorSets(commandBuffer, VK_PIPELINE_BIND_POINT_GRAPHICS, pipelineLayout, 0, 1, &descriptorSet, 0, nullptr);
```

Unlike vertex and index buffers, descriptor sets are not unique to graphics pipelines, so we specify the bind
point. Then come the pipeline layout the set's layout belongs to, the index of the first set (0), the number of sets
and the sets, and an array of dynamic offsets we don't use. The pool and the set are members
(`VkDescriptorPool descriptorPool; VkDescriptorSet descriptorSet;`); `cleanup()` destroys the pool with
`vkDestroyDescriptorPool(device, descriptorPool, nullptr);`, which frees the set too.

Now do the task **descriptor-set**. The picture still doesn't change: the shader doesn't sample yet.

### Texture coordinates

Now the vertices need texture coordinates. `Vertex` gets a third member, `glm::vec2 texCoord;`, and
`getAttributeDescriptions()` returns three descriptions (`std::array<VkVertexInputAttributeDescription, 3>`), the
new one for location 2:

```cpp
        attributeDescriptions[2].binding = 0;
        attributeDescriptions[2].location = 2;
        attributeDescriptions[2].format = VK_FORMAT_R32G32_SFLOAT;
        attributeDescriptions[2].offset = offsetof(Vertex, texCoord);
```

Each corner of the rectangle gets its corner of the image. Remember that Vulkan's y axis points down, so the vertex
with y = -0.5 is at the top, and that (0, 0) is the top left of the image:

```cpp
    {{-0.5f, -0.5f, 0.0f}, {1.0f, 1.0f, 0.0f}, {0.0f, 0.0f}}, // top left: yellow
    {{0.5f, -0.5f, 0.0f}, {1.0f, 0.0f, 0.0f}, {1.0f, 0.0f}},  // top right: red
    {{0.5f, 0.5f, 0.0f}, {0.0f, 1.0f, 0.0f}, {1.0f, 1.0f}},   // bottom right: green
    {{-0.5f, 0.5f, 0.0f}, {0.0f, 0.0f, 1.0f}, {0.0f, 1.0f}}   // bottom left: blue
```

The vertex shader passes them on:

```glsl
#version 450

layout(location = 0) in vec3 inPosition;
layout(location = 1) in vec3 inColor;
layout(location = 2) in vec2 inTexCoord;

layout(location = 0) out vec3 fragColor;
layout(location = 1) out vec2 fragTexCoord;

void main() {
    gl_Position = vec4(inPosition, 1.0);
    fragColor = inColor;
    fragTexCoord = inTexCoord;
}
```

Like vulkan-tutorial, let's first make them visible: the fragment shader declares
`layout(location = 1) in vec2 fragTexCoord;` and outputs them as a color, `outColor = vec4(fragTexCoord, 0.0, 1.0);`.

Now do the task **texture-coords**. The rectangle shows the coordinates as colors – red for u, green for v: black
at the top left, red at the top right, yellow at the bottom right and green at the bottom left. Visualizing data
with colors is the shader programming equivalent of `printf` debugging, for lack of a better option.

### Sampling

A combined image sampler descriptor is represented in GLSL by a sampler uniform. Add a reference to it in the
fragment shader:

```glsl
#version 450

layout(binding = 0) uniform sampler2D texSampler;

layout(location = 0) in vec3 fragColor;
layout(location = 1) in vec2 fragTexCoord;

layout(location = 0) out vec4 outColor;

void main() {
    outColor = texture(texSampler, fragTexCoord);
}
```

`layout(binding = 0)` is binding 0 of the descriptor set (set 0 when no `set` is given) – our combined image
sampler. Textures are sampled using the built-in `texture` function. It takes a sampler and coordinate as
arguments. The sampler automatically takes care of the filtering and transformations in the background. The output
is the (filtered) color of the texture at the (interpolated) texture coordinate.

Now do the task **sample**. You should see the crate on the rectangle – upright, with its dark frame along the
edges and the dark diagonal brace running from the bottom-left to the top-right corner.

We can also mix the resulting texture color with the vertex colors, like learnopengl does. We simply multiply the
resulting texture color with the vertex color in the fragment shader:

```glsl
    outColor = texture(texSampler, fragTexCoord) * vec4(fragColor, 1.0);
```

Now do the task **tint**. The result is a "funky" crate, yellow at the top left, red at the top right, green at the
bottom right and very dark blue at the bottom left. Multiplying colors keeps, per channel, only as much of the
texture as the vertex color lets through: the crate's brown has hardly any blue, so the blue corner turns almost
black.
:::
:::d3d12
Before the shader can sample the texture, it needs a way to *find* it. In OpenGL you bind a texture to a texture
unit and the sampler uniform reads from that unit. Direct3D 12 has no texture units: everything a shader reads
besides the vertex data goes through the **root signature**. In the *Shaders* chapter you used *root constants*;
for a texture we need two other things:

- a **descriptor table**: a root parameter that points at a range of descriptors in a shader-visible descriptor
  heap – our SRV. The table maps them to shader registers: SRVs to `t` registers (`t0`, `t1`, …);
- a **sampler**, which maps to an `s` register. The simplest kind is a *static sampler*: it is described inside the
  root signature itself and needs no descriptor or heap at all.

### Root signature

The root signature block in `LoadAssets()` gets both:

```cpp
    // Create the root signature: what the shaders read besides the vertices.
    {
        // Root parameter 0: a descriptor table with one range of SRVs - 1 SRV,
        // starting at register t0. Only the pixel shader reads it.
        CD3DX12_DESCRIPTOR_RANGE ranges[1];
        ranges[0].Init(D3D12_DESCRIPTOR_RANGE_TYPE_SRV, 1, 0);

        CD3DX12_ROOT_PARAMETER rootParameters[1];
        rootParameters[0].InitAsDescriptorTable(1, &ranges[0], D3D12_SHADER_VISIBILITY_PIXEL);

        // A static sampler is part of the root signature itself (no descriptor needed).
        // Sampler s0: linear filtering; texture coordinates outside 0..1 wrap around.
        D3D12_STATIC_SAMPLER_DESC samplers[1] = {};
        samplers[0].Filter = D3D12_FILTER_MIN_MAG_MIP_LINEAR;
        samplers[0].AddressU = D3D12_TEXTURE_ADDRESS_MODE_WRAP;
        samplers[0].AddressV = D3D12_TEXTURE_ADDRESS_MODE_WRAP;
        samplers[0].AddressW = D3D12_TEXTURE_ADDRESS_MODE_WRAP;
        samplers[0].MipLODBias = 0;
        samplers[0].MaxAnisotropy = 0;
        samplers[0].ComparisonFunc = D3D12_COMPARISON_FUNC_NEVER;
        samplers[0].BorderColor = D3D12_STATIC_BORDER_COLOR_TRANSPARENT_BLACK;
        samplers[0].MinLOD = 0.0f;
        samplers[0].MaxLOD = D3D12_FLOAT32_MAX;
        samplers[0].ShaderRegister = 0;
        samplers[0].RegisterSpace = 0;
        samplers[0].ShaderVisibility = D3D12_SHADER_VISIBILITY_PIXEL;

        CD3DX12_ROOT_SIGNATURE_DESC rootSignatureDesc;
        rootSignatureDesc.Init(_countof(rootParameters), rootParameters, _countof(samplers), samplers, D3D12_ROOT_SIGNATURE_FLAG_ALLOW_INPUT_ASSEMBLER_INPUT_LAYOUT);
```

`ranges[0].Init(D3D12_DESCRIPTOR_RANGE_TYPE_SRV, 1, 0)` is a range of 1 SRV starting at register `t0`.
`InitAsDescriptorTable` makes root parameter 0 a table with that one range, visible only to the pixel shader. The
static sampler `s0` uses the filter and address modes from the sections above – linear and wrap, like OpenGL's
`GL_LINEAR` and `GL_REPEAT`. `MaxLOD = D3D12_FLOAT32_MAX` allows every mip level (we have only one); the comparison
function is only used by comparison samplers for shadow maps, and the border color only with the border address
mode. `Init` now gets the parameters and the samplers.

The table is only a description; the command list must also say *where* in which heap the table starts. In
`PopulateCommandList()`, after `SetGraphicsRootSignature`:

```cpp
    // The SRV heap the descriptor table points into, and root parameter 0: the
    // table, starting at the heap's first descriptor.
    ID3D12DescriptorHeap* ppHeaps[] = { m_srvHeap.Get() };
    m_commandList->SetDescriptorHeaps(_countof(ppHeaps), ppHeaps);
    m_commandList->SetGraphicsRootDescriptorTable(0, m_srvHeap->GetGPUDescriptorHandleForHeapStart());
```

`SetDescriptorHeaps` sets the shader-visible heaps the GPU reads descriptors from (at most one CBV/SRV/UAV heap and
one sampler heap at a time). `SetGraphicsRootDescriptorTable(0, …)` sets root parameter 0 to a *GPU* descriptor
handle – the heap's first descriptor, our SRV. Note the difference: creating the SRV used a CPU handle (where the
CPU writes the descriptor), the table uses a GPU handle (where the GPU reads it). Both calls happen every frame,
because a reset command list starts without heaps and root arguments.

Now do the task **root-signature**. The picture still doesn't change: the shaders don't read the texture yet.

### Texture coordinates

Now the vertices need texture coordinates. `Vertex` gets a third member, `XMFLOAT2 texCoord;`, and the input layout
a third element, 24 bytes into the vertex (after 3 + 3 floats):

```cpp
            { "TEXCOORD", 0, DXGI_FORMAT_R32G32_FLOAT, 0, 24, D3D12_INPUT_CLASSIFICATION_PER_VERTEX_DATA, 0 }
```

The stride, `sizeof(Vertex)`, grows to 32 bytes by itself. Each corner of the rectangle gets its corner of the
image – with (0, 0) at the image's top left:

```cpp
        // Define the four corners of a rectangle, each with its own colour and texture
        // coordinates. Direct3D's texture coordinates start at the image's top left
        // corner (0, 0); (1, 1) is its bottom right corner.
        Vertex vertices[] =
        {
            // position               color                  texture coords
            { { 0.5f, 0.5f, 0.0f },   { 1.0f, 0.0f, 0.0f },  { 1.0f, 0.0f } },    // top right: red
            { { 0.5f, -0.5f, 0.0f },  { 0.0f, 1.0f, 0.0f },  { 1.0f, 1.0f } },    // bottom right: green
            { { -0.5f, -0.5f, 0.0f }, { 0.0f, 0.0f, 1.0f },  { 0.0f, 1.0f } },    // bottom left: blue
            { { -0.5f, 0.5f, 0.0f },  { 1.0f, 1.0f, 0.0f },  { 0.0f, 0.0f } }     // top left: yellow
        };
```

In `shaders.hlsl`, `PSInput` gets `float2 texCoord : TEXCOORD;`, and the vertex shader passes the coordinates on:

```hlsl
PSInput VSMain(float4 position : POSITION, float4 color : COLOR, float2 texCoord : TEXCOORD)
{
    PSInput result;

    // The vertex buffer holds 3 floats (x, y, z) per vertex; w is filled in with 1.0.
    result.position = position;
    result.color = color;
    result.texCoord = texCoord;

    return result;
}
```

Now do the task **texture-coords**. Nothing changes on screen yet: the pixel shader still returns the vertex color.

### Sampling

In HLSL a texture and a sampler are two separate objects, declared at the registers the root signature maps them
to. At the top of `shaders.hlsl`:

```hlsl
// The texture: register t0, in the descriptor table of root parameter 0.
Texture2D texture1 : register(t0);
// The sampler: register s0, the static sampler of the root signature.
SamplerState wrapSampler : register(s0);
```

and the pixel shader samples the texture:

```hlsl
    // The texture's colour at the texture coordinates.
    return texture1.Sample(wrapSampler, input.texCoord);
```

`Sample` is a method of the texture object that takes the sampler and the texture coordinates. It returns the
(filtered) color of the texture at the (interpolated) texture coordinate. Where GLSL's `sampler2D` combines texture
and sampling rules, HLSL keeps them apart, just like the root signature does.

Now do the task **sample**. You should see the crate on the rectangle – upright, with its dark frame along the
edges and the dark diagonal brace running from the bottom-left to the top-right corner.

We can also mix the resulting texture color with the vertex colors, like learnopengl does. We simply multiply the
resulting texture color with the vertex color in the pixel shader:

```hlsl
    // The texture's colour at the texture coordinates, tinted with the vertex colour.
    return texture1.Sample(wrapSampler, input.texCoord) * input.color;
```

Now do the task **tint**. The result is a "funky" crate, yellow at the top left, red at the top right, green at the
bottom right and very dark blue at the bottom left. Multiplying colors keeps, per channel, only as much of the
texture as the vertex color lets through: the crate's brown has hardly any blue, so the blue corner turns almost
black.
:::

:::opengl
```quiz
Before the task texture-units, the program never sets the uniform `texture1`. Why does the fragment shader still sample the crate?
- [x] An unset sampler uniform is 0, which means texture unit 0 – the default active unit, where `glBindTexture` bound the crate
- [ ] `glBindTexture` sets every sampler uniform of the active program to the bound texture
- [ ] `texture()` always reads the texture that was created most recently
---
Samplers refer to texture units, not to texture objects. Unit 0 is active by default, so binding the crate and leaving the sampler at 0 connects them. With two textures you have to set the samplers yourself.
```
:::
:::vulkan
```quiz
How does `layout(binding = 0) uniform sampler2D texSampler;` in `shader.frag` reach the crate?
- [x] Through binding 0 of the descriptor set bound with `vkCmdBindDescriptorSets`: a combined image sampler descriptor that points at `textureImageView` and `textureSampler`
- [ ] Through the vertex attribute at location 0
- [ ] Through texture unit 0, which the image is bound to when it is created
---
The descriptor set layout declares binding 0 as a combined image sampler, `vkUpdateDescriptorSets` writes the view and sampler into it, and binding the set as set 0 makes it visible to the shader.
```
:::
:::d3d12
```quiz
How does `Texture2D texture1 : register(t0);` in `shaders.hlsl` reach the crate?
- [ ] Through the order in which the textures were created with `CreateCommittedResource`
- [x] Root parameter 0 is a descriptor table whose SRV range starts at t0; `SetGraphicsRootDescriptorTable` points it at the SRV heap's first descriptor, the SRV of `m_texture1`
- [ ] The static sampler s0 holds the texture
---
The register connects the shader to the root signature, the table connects the root signature to a place in the shader-visible heap, and the SRV there describes the texture resource.
```
:::

## Texture Units

:::opengl
You probably wondered why the `sampler2D` variable is a uniform if we didn't even assign it some value with
`glUniform`. Using `glUniform1i` we can actually assign a *location* value to the texture sampler so we can set
multiple textures at once in a fragment shader. This location of a texture is more commonly known as a *texture
unit*. The default texture unit for a texture is `0` which is the default active texture unit so we didn't need to
assign a location in the previous section.

The main purpose of texture units is to allow us to use more than 1 texture in our shaders. By assigning texture
units to the samplers, we can bind to multiple textures at once as long as we activate the corresponding texture
unit first. Just like `glBindTexture` we can activate texture units using `glActiveTexture` passing in the texture
unit we'd like to use. After activating a texture unit, a subsequent `glBindTexture` call will bind that texture to
the currently active texture unit. Texture unit `GL_TEXTURE0` is always by default activated, so we didn't have to
activate any texture units in the previous example when using `glBindTexture`.

> OpenGL should have at least a minimum of 16 texture units for you to use which you can activate using
> `GL_TEXTURE0` to `GL_TEXTURE15`. They are defined in order so we could also get `GL_TEXTURE8` via
> `GL_TEXTURE0 + 8` for example, which is useful when we'd have to loop over several texture units.

We still however need to edit the fragment shader to accept another sampler. This should be relatively
straightforward now:

```glsl
#version 330 core
out vec4 FragColor;

in vec3 ourColor;
in vec2 TexCoord;

// texture samplers
uniform sampler2D texture1;
uniform sampler2D texture2;

void main()
{
    // linearly interpolate between both textures (80% container, 20% awesomeface)
    FragColor = mix(texture(texture1, TexCoord), texture(texture2, TexCoord), 0.2);
}
```

The final output color is now the combination of two texture lookups. GLSL's built-in `mix` function takes two
values as input and linearly interpolates between them based on its third argument. If the third value is `0.0` it
returns the first input; if it's `1.0` it returns the second input value. A value of `0.2` will return 80% of the
first input color and 20% of the second input color, resulting in a mixture of both our textures. (The tint with
the vertex color is gone again.)

We now want to load and create another texture; you should be familiar with the steps now. Make sure to create
another texture object, load the image and generate the final texture using `glTexImage2D`. For the second texture
we'll use an image of your facial expression while learning OpenGL:

```cpp
    // load image, create texture and generate mipmaps
    data = stbi_load("awesomeface.png", &width, &height, &nrChannels, 0);
    if (data)
    {
        // note that the awesomeface.png has transparency and thus an alpha channel, so make sure to tell OpenGL the data type is of GL_RGBA
        glTexImage2D(GL_TEXTURE_2D, 0, GL_RGBA, width, height, 0, GL_RGBA, GL_UNSIGNED_BYTE, data);
        glGenerateMipmap(GL_TEXTURE_2D);
    }
```

Note that we now load a `.png` image that includes an alpha (transparency) channel. This means we now need to
specify that the image data contains an alpha channel as well by using `GL_RGBA`; otherwise OpenGL will incorrectly
interpret the image data. Before this, the second texture object is created and configured exactly like the first:
`unsigned int texture1, texture2;` declares both, and `glGenTextures(1, &texture2);`, `glBindTexture` and the same
four `glTexParameteri` calls come before the loading. The flip setting of `stb_image.h` still applies, so the face
is upright too.

To use the second texture (and the first texture) we'd have to change the rendering procedure a bit by binding both
textures to the corresponding texture unit:

```cpp
        // bind textures on corresponding texture units
        glActiveTexture(GL_TEXTURE0);
        glBindTexture(GL_TEXTURE_2D, texture1);
        glActiveTexture(GL_TEXTURE1);
        glBindTexture(GL_TEXTURE_2D, texture2);
```

We also have to tell OpenGL to which texture unit each shader sampler belongs to by setting each sampler using
`glUniform1i`. We only have to set this once, so we can do this before we enter the render loop:

```cpp
    // tell opengl for each sampler to which texture unit it belongs to (only has to be done once)
    // -------------------------------------------------------------------------------------------
    ourShader.use(); // don't forget to activate/use the shader before setting uniforms!
    ourShader.setInt("texture1", 0);
    ourShader.setInt("texture2", 1);
```

By setting the samplers via `glUniform1i` (which `setInt` calls) we make sure each uniform sampler corresponds to
the proper texture unit. Remember to delete the second texture at the end as well: `glDeleteTextures(1, &texture2);`.

Now do the task **texture-units**.
:::
:::vulkan
In OpenGL, *texture units* let a shader use more than one texture at once: you bind each texture to its own unit
and tell each sampler uniform which unit to read. In Vulkan the same job is done by the **bindings** of the
descriptor set: each binding is a slot for a descriptor, and the shader names the binding it reads. To use a second
texture we add a second binding – nothing like a global "active unit" is involved.

The second texture needs everything the first one has: an image, its memory and a view (new members
`faceTextureImage`, `faceTextureImageMemory` and `faceTextureImageView`). The project gives it its own function,
`createFaceTextureImage()`, called right after `createTextureImage()`. It is a copy of `createTextureImage()` that
loads the other file into the other image – much like learnopengl repeats the texture block for its second texture:

```cpp
        stbi_uc* pixels = stbi_load("textures/awesomeface.png", &texWidth, &texHeight, &texChannels, STBI_rgb_alpha);
```

`awesomeface.png` has an alpha channel of its own; with `STBI_rgb_alpha` both images arrive as RGBA anyway, so the
same format, `VK_FORMAT_R8G8B8A8_UNORM`, works for both. `createTextureImageView()` creates the second view:

```cpp
        faceTextureImageView = createImageView(faceTextureImage, VK_FORMAT_R8G8B8A8_UNORM);
```

We don't need a second sampler: a sampler doesn't belong to an image, so the same `textureSampler` can read both.
The descriptor set layout gets a second binding, `faceSamplerLayoutBinding` – the same as the first with
`binding = 1` – and the array holds both:

```cpp
        std::array<VkDescriptorSetLayoutBinding, 2> bindings = {samplerLayoutBinding, faceSamplerLayoutBinding};
```

The pool must now have room for two combined image samplers (`poolSizes[0].descriptorCount = 2;`), and
`createDescriptorSets()` writes the second one, with its own image info:

```cpp
        VkDescriptorImageInfo faceImageInfo{};
        faceImageInfo.imageLayout = VK_IMAGE_LAYOUT_SHADER_READ_ONLY_OPTIMAL;
        faceImageInfo.imageView = faceTextureImageView;
        faceImageInfo.sampler = textureSampler;

        std::array<VkWriteDescriptorSet, 2> descriptorWrites{};
```

and a second write, `descriptorWrites[1]`, for `dstBinding = 1` with `pImageInfo = &faceImageInfo`. The face's
view, image and memory are destroyed in `cleanup()` next to the crate's.

In the fragment shader the face is binding 1, and the two colors are mixed:

```glsl
layout(binding = 0) uniform sampler2D texSampler;
layout(binding = 1) uniform sampler2D faceSampler;
```

```glsl
    // 80% container, 20% face
    outColor = mix(texture(texSampler, fragTexCoord), texture(faceSampler, fragTexCoord), 0.2);
```

GLSL's built-in `mix` function takes two values as input and linearly interpolates between them based on its third
argument. If the third value is `0.0` it returns the first input; if it's `1.0` it returns the second input value. A
value of `0.2` will return 80% of the first input color and 20% of the second input color, resulting in a mixture of
both our textures. (The tint with the vertex color is gone again.)

Now do the task **texture-units**.
:::
:::d3d12
In OpenGL, *texture units* let a shader use more than one texture at once: you bind each texture to its own unit
and tell each sampler uniform which unit to read. In Direct3D 12 the same job is done by **registers** and the
descriptor table: the table covers a range of descriptors in the heap, and each one is a register, `t0`, `t1`, …
To use a second texture we put its SRV right after the first one and let the table cover two descriptors.

First the second texture itself. It goes through exactly the same steps as the container, in a second block after
the container's, which loads the other file into a new member `ComPtr<ID3D12Resource> m_texture2`:

```cpp
        unsigned char* data = stbi_load("awesomeface.png", &width, &height, &nrChannels, 4);
```

It needs its own upload heap, declared next to the first so it also lives until the wait at the end of
`LoadAssets()`:

```cpp
    ComPtr<ID3D12Resource> textureUploadHeap1;
    ComPtr<ID3D12Resource> textureUploadHeap2;
```

The SRV heap gets room for two descriptors (`srvHeapDesc.NumDescriptors = 2;`), and the face's SRV goes into the
**second** slot. Descriptors sit next to each other in a heap, but the size of one descriptor depends on the GPU,
so we ask the device for it in `LoadPipeline()` and keep it in a new member `UINT m_srvDescriptorSize`:

```cpp
        m_srvDescriptorSize = m_device->GetDescriptorHandleIncrementSize(D3D12_DESCRIPTOR_HEAP_TYPE_CBV_SRV_UAV);
```

The handle of slot 1 is the heap's start plus one descriptor:

```cpp
        // The SRV goes into the second slot of the SRV heap (descriptor 1), right after
        // the container's: the descriptor table's t0 and t1.
        D3D12_SHADER_RESOURCE_VIEW_DESC srvDesc = {};
        srvDesc.Shader4ComponentMapping = D3D12_DEFAULT_SHADER_4_COMPONENT_MAPPING;
        srvDesc.Format = textureDesc.Format;
        srvDesc.ViewDimension = D3D12_SRV_DIMENSION_TEXTURE2D;
        srvDesc.Texture2D.MipLevels = 1;
        CD3DX12_CPU_DESCRIPTOR_HANDLE srvHandle(m_srvHeap->GetCPUDescriptorHandleForHeapStart(), 1, m_srvDescriptorSize);
        m_device->CreateShaderResourceView(m_texture2.Get(), &srvDesc, srvHandle);
```

Finally the descriptor range covers two SRVs, `t0` and `t1`:

```cpp
        ranges[0].Init(D3D12_DESCRIPTOR_RANGE_TYPE_SRV, 2, 0);
```

`SetGraphicsRootDescriptorTable` still points at the heap's start: the table now reads two descriptors from there.
We don't need a second sampler – a sampler doesn't belong to a texture, so `s0` can read both.

Now do the task **second-texture**. The picture doesn't change yet: the shader doesn't read `t1`.

In the shader, the face is register `t1`, and the two colors are mixed:

```hlsl
// The textures: registers t0 and t1, in the descriptor table of root parameter 0.
Texture2D texture1 : register(t0);    // the container
Texture2D texture2 : register(t1);    // the face
```

```hlsl
    // Linearly interpolate between both textures (80% container, 20% face).
    return lerp(texture1.Sample(wrapSampler, input.texCoord), texture2.Sample(wrapSampler, input.texCoord), 0.2f);
```

HLSL's `lerp` is GLSL's `mix`: it takes two values as input and linearly interpolates between them based on its
third argument, `a * (1 - t) + b * t`. If the third value is `0.0` it returns the first input; if it's `1.0` it
returns the second input value. A value of `0.2` will return 80% of the first input color and 20% of the second
input color, resulting in a mixture of both our textures. (The tint with the vertex color is gone again.)

Now do the task **texture-units**.
:::

You should get the crate with a faint smiley on top of it, with a red heart on the face's right side. Look closely
at the crate *outside* the face: it is darker than before. That is the face's transparent area at work. Mixing
blends all four channels, and the transparent pixels of `awesomeface.png` are black with an alpha of 0 – nothing
looks at the alpha, so 20% black is mixed into the crate everywhere outside the face. (Blending with the alpha
channel is the topic of a later chapter.)

```quiz
Outside the face, the crate is darker after mixing with 0.2 than it was on its own. Why?
- [x] The face's transparent pixels are stored as black with alpha 0; the mix ignores alpha and blends 20% of that black into the crate
- [ ] The face texture is sampled outside 0..1 there and returns a black border color
- [ ] Mixing always halves the brightness of both inputs
---
A transparent pixel still has an RGB value, and in `awesomeface.png` it is black. To leave the crate untouched where the face is transparent, you could use the face's alpha in the mix weight – the face's `.a` times 0.2.
```

## Exercises

To get more comfortable with textures it is advised to work through these exercises before continuing:

1. Make sure only the happy face looks in the other/reverse direction by changing the fragment shader.
2. Experiment with the different texture wrapping methods by specifying texture coordinates in the range `0.0f` to
   `2.0f` instead of `0.0f` to `1.0f`. See if you can display 4 smiley faces on a single container image clamped at
   its edge.
3. Try to display only the center pixels of the texture image on the rectangle in such a way that the individual
   pixels are getting visible by changing the texture coordinates. Try to set the texture filtering method to
   nearest to see the pixels more clearly.
4. Use a value set from the CPU as the mix function's third parameter to vary the amount the two textures are
   visible. Use the up and down arrow keys to change how much the container or the smiley face is visible.

Exercises 1, 2 and 4 are the last tasks of this chapter; exercise 3 is an extra experiment. The tasks build on each
other, so the program you end with has a mirrored face, the repeat/clamp setup and the adjustable mix.

### Flip the face

The face looks the other way if its texture is mirrored horizontally: sample it at `1 - u` instead of `u`. Only the
face's coordinates change; the container keeps its own.

:::opengl
```glsl
    // linearly interpolate between both textures (the face mirrored horizontally)
    FragColor = mix(texture(texture1, TexCoord), texture(texture2, vec2(1.0 - TexCoord.x, TexCoord.y)), 0.2);
```
:::
:::vulkan
```glsl
    outColor = mix(texture(texSampler, fragTexCoord), texture(faceSampler, vec2(1.0 - fragTexCoord.x, fragTexCoord.y)), 0.2);
```
:::
:::d3d12
```hlsl
    // The face is mirrored horizontally: u becomes 1 - u.
    return lerp(texture1.Sample(wrapSampler, input.texCoord), texture2.Sample(wrapSampler, float2(1.0f - input.texCoord.x, input.texCoord.y)), 0.2f);
```
:::

Now do the task **flip-face**. The heart moves to the face's left side; the crate is unchanged (its brace still runs
from the bottom left to the top right).

### Four faces on a clamped container

With texture coordinates from 0 to 2, the face should repeat 2 × 2 while the container is clamped at its edge. That
needs a different wrapping mode for each texture.

:::opengl
Replace every `1.0f` texture coordinate with `2.0f`:

```cpp
         0.5f,  0.5f, 0.0f,   1.0f, 0.0f, 0.0f,   2.0f, 2.0f, // top right
         0.5f, -0.5f, 0.0f,   0.0f, 1.0f, 0.0f,   2.0f, 0.0f, // bottom right
        -0.5f, -0.5f, 0.0f,   0.0f, 0.0f, 1.0f,   0.0f, 0.0f, // bottom left
        -0.5f,  0.5f, 0.0f,   1.0f, 1.0f, 0.0f,   0.0f, 2.0f  // top left
```

In OpenGL the wrapping mode is a parameter of each texture object, so only the container's two
`GL_TEXTURE_WRAP_*` calls change; the face keeps `GL_REPEAT`:

```cpp
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_S, GL_CLAMP_TO_EDGE); // note that we set the container wrapping method to GL_CLAMP_TO_EDGE
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_T, GL_CLAMP_TO_EDGE);
```

Now do the task **repeat**. You see four mirrored faces, one in each quarter. The container appears once, at half
size, in the **bottom-left** quarter: that is where the coordinates run from 0 to 1, because OpenGL's (0, 0) is at
the bottom left. Everywhere else the coordinates are above 1 on at least one axis, so the container's edge texels –
its dark frame – are stretched over the rest of the rectangle.
:::
:::vulkan
Replace every `1.0f` texture coordinate with `2.0f`:

```cpp
    {{-0.5f, -0.5f, 0.0f}, {1.0f, 1.0f, 0.0f}, {0.0f, 0.0f}}, // top left: yellow
    {{0.5f, -0.5f, 0.0f}, {1.0f, 0.0f, 0.0f}, {2.0f, 0.0f}},  // top right: red
    {{0.5f, 0.5f, 0.0f}, {0.0f, 1.0f, 0.0f}, {2.0f, 2.0f}},   // bottom right: green
    {{-0.5f, 0.5f, 0.0f}, {0.0f, 0.0f, 1.0f}, {0.0f, 2.0f}}   // bottom left: blue
```

In Vulkan the address mode belongs to the sampler, not to the image, and both textures currently share
`textureSampler`. So the container gets a sampler of its own, a new member `VkSampler clampSampler;`, created in
`createTextureSampler()` from the same `samplerInfo` after `textureSampler`:

```cpp
        // A second sampler for the container: outside 0..1 it repeats the edge texels.
        samplerInfo.addressModeU = VK_SAMPLER_ADDRESS_MODE_CLAMP_TO_EDGE;
        samplerInfo.addressModeV = VK_SAMPLER_ADDRESS_MODE_CLAMP_TO_EDGE;
        samplerInfo.addressModeW = VK_SAMPLER_ADDRESS_MODE_CLAMP_TO_EDGE;

        if (vkCreateSampler(device, &samplerInfo, nullptr, &clampSampler) != VK_SUCCESS) {
            throw std::runtime_error("failed to create texture sampler!");
        }
```

The container's descriptor uses it – `imageInfo.sampler = clampSampler;` in `createDescriptorSets()` – while the
face's keeps the repeating `textureSampler`. `cleanup()` destroys it with
`vkDestroySampler(device, clampSampler, nullptr);`.

Now do the task **repeat**. You see four mirrored faces, one in each quarter. The container appears once, at half
size, in the **top-left** quarter: that is where the coordinates run from 0 to 1, because Vulkan's (0, 0) is at the
top left. (In the OpenGL version of this exercise it ends up in the bottom-left quarter.) Everywhere else the
coordinates are above 1 on at least one axis, so the container's edge texels – its dark frame – are stretched over
the rest of the rectangle.
:::
:::d3d12
Replace every `1.0f` texture coordinate with `2.0f`:

```cpp
            { { 0.5f, 0.5f, 0.0f },   { 1.0f, 0.0f, 0.0f },  { 2.0f, 0.0f } },    // top right: red
            { { 0.5f, -0.5f, 0.0f },  { 0.0f, 1.0f, 0.0f },  { 2.0f, 2.0f } },    // bottom right: green
            { { -0.5f, -0.5f, 0.0f }, { 0.0f, 0.0f, 1.0f },  { 0.0f, 2.0f } },    // bottom left: blue
            { { -0.5f, 0.5f, 0.0f },  { 1.0f, 1.0f, 0.0f },  { 0.0f, 0.0f } }     // top left: yellow
```

In Direct3D the address mode belongs to the sampler, not to the texture, and both textures currently use `s0`. So
the container gets a second static sampler, `s1`: the root signature now has `D3D12_STATIC_SAMPLER_DESC samplers[2]`,
and after the first one is filled in:

```cpp
        // Sampler s1: the same, but coordinates outside 0..1 are clamped to the edge.
        samplers[1] = samplers[0];
        samplers[1].AddressU = D3D12_TEXTURE_ADDRESS_MODE_CLAMP;
        samplers[1].AddressV = D3D12_TEXTURE_ADDRESS_MODE_CLAMP;
        samplers[1].AddressW = D3D12_TEXTURE_ADDRESS_MODE_CLAMP;
        samplers[1].ShaderRegister = 1;
```

The shader declares both samplers and reads the container with the clamping one:

```hlsl
// The samplers: registers s0 and s1, the static samplers of the root signature.
SamplerState wrapSampler : register(s0);     // repeats the texture outside 0..1
SamplerState clampSampler : register(s1);    // stretches its edge pixels outside 0..1
```

```hlsl
    return lerp(texture1.Sample(clampSampler, input.texCoord), texture2.Sample(wrapSampler, float2(1.0f - input.texCoord.x, input.texCoord.y)), 0.2f);
```

Now do the task **repeat**. You see four mirrored faces, one in each quarter. The container appears once, at half
size, in the **top-left** quarter: that is where the coordinates run from 0 to 1, because Direct3D's (0, 0) is at
the top left. (In the OpenGL version of this exercise it ends up in the bottom-left quarter.) Everywhere else the
coordinates are above 1 on at least one axis, so the container's edge texels – its dark frame – are stretched over
the rest of the rectangle.
:::

### Only the center pixels

This exercise is not a task. If you want to try it, do so after you have finished the last task, and change the
values back afterwards. Give the rectangle texture coordinates that cover only a small part in the middle of the
image, for example 0.45 to 0.55 on both axes instead of 0 to 2. Then only about 26 × 26 texels are stretched over
the whole rectangle, and with nearest filtering each of them becomes a clearly visible block.

:::opengl
For nearest filtering, set `GL_TEXTURE_MAG_FILTER` to `GL_NEAREST` for the textures (the minification filter doesn't matter here: the
texture is magnified). With `GL_LINEAR` the same blocks blur smoothly into each other.
:::
:::vulkan
For nearest filtering, set `samplerInfo.magFilter = VK_FILTER_NEAREST;` (the minification filter doesn't matter here: the texture is
magnified). With `VK_FILTER_LINEAR` the same blocks blur smoothly into each other.
:::
:::d3d12
For nearest filtering, set the static samplers' `Filter` to `D3D12_FILTER_MIN_MAG_MIP_POINT`. With `D3D12_FILTER_MIN_MAG_MIP_LINEAR` the
same blocks blur smoothly into each other.
:::

### Mix with the arrow keys

The fixed 0.2 in the mix becomes a value the program sets from the CPU, and the Up and Down arrow keys change it.

:::opengl
In `shader.fs`, declare `uniform float mixValue;` and use it as the third argument:

```glsl
    FragColor = mix(texture(texture1, TexCoord), texture(texture2, vec2(1.0 - TexCoord.x, TexCoord.y)), mixValue);
```

In `main.cpp` a global variable holds the value, below the settings:

```cpp
// stores how much we're seeing of either texture
float mixValue = 0.5f;
```

and the render loop sets the uniform every frame, after the shader is activated:

```cpp
        ourShader.use();
        // set the texture mix value in the shader
        ourShader.setFloat("mixValue", mixValue);
```

`processInput` changes the value while a key is held:

```cpp
    if (glfwGetKey(window, GLFW_KEY_UP) == GLFW_PRESS)
    {
        mixValue += 0.001f; // change this value accordingly (might be too slow or too fast based on system hardware)
        if (mixValue >= 1.0f)
            mixValue = 1.0f;
    }
    if (glfwGetKey(window, GLFW_KEY_DOWN) == GLFW_PRESS)
    {
        mixValue -= 0.001f; // change this value accordingly (might be too slow or too fast based on system hardware)
        if (mixValue <= 0.0f)
            mixValue = 0.0f;
    }
```

The value changes by 0.001 every frame the key is down, and it is clamped to the range of `mix`.

Now do the task **mix-value**.
:::
:::vulkan
A single float for the fragment shader is a job for *push constants*, as in the *Shaders* chapter. The fragment
shader declares the block and uses it in the mix:

```glsl
layout(push_constant) uniform PushConstants {
    float mixValue;
} pc;
```

```glsl
    outColor = mix(texture(texSampler, fragTexCoord), texture(faceSampler, vec2(1.0 - fragTexCoord.x, fragTexCoord.y)), pc.mixValue);
```

On the C++ side: a struct with the same layout above the class, `struct PushConstants { float mixValue; };`, a
member `float mixValue = 0.5f;`, and a push constant range for the fragment stage in the pipeline layout:

```cpp
        VkPushConstantRange pushConstantRange{};
        pushConstantRange.stageFlags = VK_SHADER_STAGE_FRAGMENT_BIT;
        pushConstantRange.offset = 0;
        pushConstantRange.size = sizeof(PushConstants);
```

with `pipelineLayoutInfo.pushConstantRangeCount = 1;` and `pipelineLayoutInfo.pPushConstantRanges =
&pushConstantRange;`. `recordCommandBuffer()` pushes the value after binding the descriptor set:

```cpp
        PushConstants constants{};
        constants.mixValue = mixValue;
        vkCmdPushConstants(commandBuffer, pipelineLayout, VK_SHADER_STAGE_FRAGMENT_BIT, 0, sizeof(PushConstants), &constants);
```

A new `processInput()`, called in `mainLoop()` after `glfwPollEvents()`, changes the value while a key is held:

```cpp
    void processInput() {
        if (glfwGetKey(window, GLFW_KEY_UP) == GLFW_PRESS) {
            mixValue += 0.001f; // per frame: change it if this is too slow or too fast on your machine
            if (mixValue >= 1.0f) {
                mixValue = 1.0f;
            }
        }
        if (glfwGetKey(window, GLFW_KEY_DOWN) == GLFW_PRESS) {
            mixValue -= 0.001f;
            if (mixValue <= 0.0f) {
                mixValue = 0.0f;
            }
        }
    }
```

Since the command buffer is recorded anew every frame, the new value is in the next frame.

Now do the task **mix-value**.
:::
:::d3d12
A single float for the pixel shader is a job for *root constants*, as in the *Shaders* chapter. The shader
declares them as a constant buffer at `b0` and uses the value in the mix:

```hlsl
// Root constants set from main.cpp with SetGraphicsRoot32BitConstants: the pixel
// shader sees them as a constant buffer at register b0.
cbuffer MixConstants : register(b0)
{
    float mixValue;    // how much of the face shows
};
```

```hlsl
    return lerp(texture1.Sample(clampSampler, input.texCoord), texture2.Sample(wrapSampler, float2(1.0f - input.texCoord.x, input.texCoord.y)), mixValue);
```

On the C++ side: a struct `MixConstants { float mixValue; };` next to `Vertex`, a member `float m_mixValue = 0.5f;`,
and a second root parameter – the descriptor table stays parameter 0:

```cpp
        CD3DX12_ROOT_PARAMETER rootParameters[2];
        rootParameters[0].InitAsDescriptorTable(1, &ranges[0], D3D12_SHADER_VISIBILITY_PIXEL);
        rootParameters[1].InitAsConstants(sizeof(MixConstants) / 4, 0, 0, D3D12_SHADER_VISIBILITY_PIXEL);
```

`PopulateCommandList()` sets the value every frame, after `RSSetScissorRects`:

```cpp
    // Root parameter 1: the mix value for the pixel shader.
    MixConstants mixConstants = {};
    mixConstants.mixValue = m_mixValue;
    m_commandList->SetGraphicsRoot32BitConstants(1, sizeof(MixConstants) / 4, &mixConstants, 0);
```

Now do the task **mix-value**. The faces are much stronger at 0.5.

The keys arrive in the window procedure as `WM_KEYDOWN` messages, but `WindowProc` is a free function that doesn't
know our app. Microsoft's samples solve that by keeping a pointer to the app in the window's *user data*. In
`wWinMain`, after the app is created:

```cpp
    // Store a pointer to the app in the window, so WindowProc can pass it the keys.
    SetWindowLongPtr(hwnd, GWLP_USERDATA, reinterpret_cast<LONG_PTR>(&app));
```

`WindowProc` gets it back with `GetWindowLongPtr` and hands every key except Escape to the app:

```cpp
    // The app that wWinMain stored in the window (nullptr until then).
    D3D12App* pApp = reinterpret_cast<D3D12App*>(GetWindowLongPtr(hWnd, GWLP_USERDATA));

    switch (message)
    {
    case WM_KEYDOWN:
        // Escape closes the window; the app gets the other keys.
        if (wParam == VK_ESCAPE)
        {
            DestroyWindow(hWnd);
        }
        else if (pApp != nullptr)
        {
            pApp->OnKeyDown(static_cast<UINT8>(wParam));
        }
        return 0;
```

and a new public method `void OnKeyDown(UINT8 key);` changes the value:

```cpp
// Up and Down change the mix value, in steps of 0.1 (holding a key repeats it).
void D3D12App::OnKeyDown(UINT8 key)
{
    if (key == VK_UP)
    {
        m_mixValue += 0.1f;
        if (m_mixValue >= 1.0f)
            m_mixValue = 1.0f;
    }
    if (key == VK_DOWN)
    {
        m_mixValue -= 0.1f;
        if (m_mixValue <= 0.0f)
            m_mixValue = 0.0f;
    }
}
```

The OpenGL and Vulkan versions ask GLFW every frame whether a key is down; Windows instead sends a message per key
press – and repeats it while the key is held – so each message moves the value a whole step of 0.1.

Now do the task **mix-keys**.
:::

At 0.5 the faces are much brighter, and everything outside them is half as bright as the crate – half black. Hold
Up and the faces take over (at 1.0 you see only the faces, black where they are transparent); hold Down and the
crate comes back (at 0.0 only the clamped crate is left).

Congratulations – you have textured your first object. In the next chapter we start moving it around with
transformations.
