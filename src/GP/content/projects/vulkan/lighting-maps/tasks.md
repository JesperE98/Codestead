# Lighting Maps (Vulkan) – a diffuse map, a specular map and an emission map (learnopengl "Lighting maps")

Start: the result of "Materials" with the light colour fixed again (`ubo.light.ambient = glm::vec3(0.2f…)`,
`ubo.light.diffuse = glm::vec3(0.5f…)`), the cube's shaders renamed `shaders/lighting_maps.vert` / `.frag`, and what
textures need, as in the "Textures" chapter: `#include <stb_image.h>` (with `STB_IMAGE_IMPLEMENTATION`), the images
`textures/container2.png` (wood in a steel frame), `textures/container2_specular.png` (steel bright, wood almost
black) and `textures/matrix.png` (green glyphs on black), the tutorial's helpers `beginSingleTimeCommands()`,
`endSingleTimeCommands()`, `transitionImageLayout()`, `copyBufferToImage()`, a helper
`createTextureImage(stbi_uc* pixels, int texWidth, int texHeight, VkImage& image, VkDeviceMemory& imageMemory)` (the
body of the Textures chapter's `createTextureImage`: staging buffer, device-local `VK_FORMAT_R8G8B8A8_UNORM` image,
layout transitions, copy) and the sampler (`textureSampler`: linear, repeat, anisotropy; created in
`initVulkan()`, destroyed in `cleanup()`). The vertices have texture coordinates: `struct Vertex { glm::vec3 pos;
glm::vec3 normal; glm::vec2 texCoord; }` with learnopengl's coordinates, v flipped (`1 - v`, like the Textures chapter:
learnopengl flips the images when loading, we flip the coordinates) – but `getAttributeDescriptions()` still describes
two attributes (`// TODO` for the third) and the cube's pipeline reads 2.

Each map gets a function of its own that loads its image with `stbi_load("textures/….png", …, STBI_rgb_alpha)` and
makes the image + image view (`createDiffuseMap()`, `createSpecularMap()`, `createEmissionMap()`, called in this
order in `initVulkan()` before `createTextureSampler()`), a combined image sampler binding in the descriptor set
layout (fragment stage), a pool size and a descriptor write. The uniform buffer keeps **binding 2**; the maps take
binding 0 (diffuse), 1 (specular) and 3 (emission). A uniform block cannot hold samplers, so the maps are
`layout(binding = N) uniform sampler2D diffuseMap / specularMap / emissionMap` next to the block (learnopengl's
`material.diffuse` …), and the C++ `Material` keeps only what stays in the block: after the specular map just
`float shininess` + `pad1..pad3` (a struct in a uniform block takes a multiple of 16 bytes).

Camera and lamp as before (camera at (-3, 0, 3), lamp at (1.2, 1, 2)). Nothing depends on time. Colours measured on
lavapipe; the OpenGL version of this chapter gives the same values except where OpenGL's mipmaps average the image
(learnopengl's `glGenerateMipmap`; vulkan-tutorial adds mipmaps only in a later chapter) – a few points of the
wood grain, and the emission glyphs, which are sharper and brighter here. Named points: left face wood W1 (165, 360),
front face wood W2 (300, 360), left edge of the front face's steel frame S1 (245, 300), its upper part S2 (270, 280),
right edge of the frame S3 (352, 380), lamp (640, 195) (white), background (400, 300) = (26, 26, 26).
- start (coral material, white light 0.2 / 0.5 / 1.0): W1 = (51, 26, 16), W2 = (142, 73, 46), S1 = (200, 134, 108),
  S2 = (230, 160, 133), S3 = (147, 74, 46).

## texcoords
- **Task:** Pass the texture coordinates to the shaders: `getAttributeDescriptions()` returns 3, with
  `attributeDescriptions[2]` = binding 0, location 2, `VK_FORMAT_R32G32_SFLOAT`, `offsetof(Vertex, texCoord)`; the
  cube's pipeline reads 3 attributes (`createPipeline(…lighting_maps…, 3, lightingPipeline)`); in the vertex shader
  `layout(location = 2) in vec2 inTexCoord;`, `layout(location = 2) out vec2 fragTexCoord;`,
  `fragTexCoord = inTexCoord;`; in the fragment shader `layout(location = 2) in vec2 fragTexCoord;`.
- **Hint:** Like the normal, the coordinates go from the vertex buffer through the vertex shader to the fragment shader.
- **When done:** picture unchanged (not used yet): W1 = (51, 26, 16), W2 = (142, 73, 46), S1 = (200, 134, 108).

## diffuse-map
- **Task:** Colour the surface from a diffuse map: members `diffuseMapImage`, `diffuseMapImageMemory`,
  `diffuseMapImageView`; `createDiffuseMap()` (stbi_load `"textures/container2.png"`, `createTextureImage(pixels, …,
  diffuseMapImage, diffuseMapImageMemory)`, `stbi_image_free`, `createImageView(…)`), called in `initVulkan()`,
  destroyed in `cleanup()`; a `VkDescriptorSetLayoutBinding diffuseMapLayoutBinding` (binding 0, combined image
  sampler, fragment stage) in the layout; a pool size `VK_DESCRIPTOR_TYPE_COMBINED_IMAGE_SAMPLER`; a
  `VkDescriptorImageInfo diffuseMapInfo` (the view, `textureSampler`) and a write to binding 0. In the fragment shader
  `layout(binding = 0) uniform sampler2D diffuseMap;`, `Material` without `ambient` and `diffuse`, `ambient =
  ubo.light.ambient * texture(diffuseMap, fragTexCoord).rgb`, `diffuse = ubo.light.diffuse * diff *
  texture(diffuseMap, fragTexCoord).rgb`. In C++ `struct Material { glm::vec3 specular; float shininess; }` and
  `ubo.material.specular = glm::vec3(0.5f…); ubo.material.shininess = 64.0f;`.
- **Hint:** A diffuse map is a texture that gives every fragment its own material colour (for ambient and diffuse).
- **When done:** the cube is a wooden container in a steel frame (the left face dark, the front face lit):
  W1 = (28, 18, 10), W2 = (82, 54, 29), S1 = (114, 115, 118), S2 = (146, 147, 150), S3 = (87, 88, 91); the wood shows a
  grey sheen of the uniform specular 0.5 too. Lamp white, background (26, 26, 26).

## specular-map
- **Task:** Let a specular map decide where it shines: members `specularMapImage…`, `createSpecularMap()` with
  `"textures/container2_specular.png"`, binding 1 (layout binding, pool size count 2, image info + write);
  `layout(binding = 1) uniform sampler2D specularMap;`, `specular = ubo.light.specular * spec * texture(specularMap,
  fragTexCoord).rgb`, `Material` keeps only `float shininess` (C++: `float shininess; float pad1; float pad2; float
  pad3;`), `ubo.material.specular` removed.
- **Hint:** Steel shines, wood hardly: the specular map is bright on the frame and black on the planks.
- **When done:** the highlight only on the steel frame: S1 = (133, 134, 138), S2 = (182, 183, 186); the wood keeps its
  diffuse colour W2 = (82, 54, 29), W1 = (28, 18, 10); S3 = (87, 88, 91) (outside the highlight).

## emission
- **Task:** Add an emission map (learnopengl's exercise): members `emissionMapImage…`, `createEmissionMap()` with
  `"textures/matrix.png"`, binding 3 (binding 2 is the uniform buffer; pool size count 3, image info + write);
  `layout(binding = 3) uniform sampler2D emissionMap;`, `vec3 emission = texture(emissionMap, fragTexCoord).rgb;` and
  `result = ambient + diffuse + specular + emission`.
- **Hint:** Emission is light the surface gives off itself: it is added after the lighting and does not depend on any
  light.
- **When done:** green glyphs glow over both faces, in the dark too (the left face): W1 = (28, 146, 48),
  W2 = (82, 236, 83); points without a glyph unchanged: S1 = (133, 134, 138),
  S2 = (182, 183, 186). Lamp white, background (26, 26, 26).
