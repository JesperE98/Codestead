# Model (Vulkan) – load planet.obj with tinyobjloader and draw it textured (learnopengl "Model")

learnopengl's Model class (Assimp: loadModel, processNode, processMesh, loadMaterialTextures) maps onto
vulkan-tutorial's "Loading models": `tinyobj::LoadObj` reads `models/planet.obj` (and `planet.mtl`), `loadModel()`
turns its faces into `vertices` / `indices` without duplicates, every vertex carries the number of its material
(planet = 0, rings = 1, the order of `planet.mtl`), the textures of the materials are loaded from string constants
and bound at consecutive bindings, and the fragment shader picks the textures of the fragment's material. The whole
model is **one** `vkCmdDrawIndexed`.

**Start** = the `mesh` solution unchanged: the test square in texture-coordinate colours (see mesh/tasks.md).

Named points of the 800×600 window (lavapipe and the app's simulator agree, ±1): **centre** (400, 300) (planet, land),
**top** (400, 200) (planet, an ocean below the pole), **pole** (400, 186) (the white north pole), **left** (300, 330)
(planet, land on the lower left), **ocean-left** (290, 300) (an ocean at the planet's left edge), **highlight**
(436, 270), **ring-front** (400, 420), **ring-right** (600, 330), **ring-left** (200, 330), **background** (30, 300) =
(13, 13, 13). Nothing depends on time.

Start picture: centre = (128, 128, 0), the square as in the mesh chapter.

## load-model
- **Task:** Load the model: `#define TINYOBJLOADER_IMPLEMENTATION` + `#include <tiny_obj_loader.h>` (and
  `<string>`, `<unordered_map>`), `const std::string MODEL_PATH = "models/planet.obj";`, the members become
  `std::vector<Vertex> vertices;` / `std::vector<uint32_t> indices;` (the test square goes), and `loadModel()` – called
  in `initVulkan()` before `createVertexBuffer()` – calls `tinyobj::LoadObj(&attrib, &shapes, &materials, &warn, &err,
  MODEL_PATH.c_str(), "models/")` (throws `std::runtime_error(warn + err)` on failure), and for every index of every
  shape builds a `Vertex`: position, normal, texture coordinate with v flipped (`1.0f - attrib.texcoords[2 *
  index.texcoord_index + 1]`), `materialIndex = shape.mesh.material_ids[i / 3]` (faces are triangles: 3 indices per
  face), and adds it once with `std::unordered_map<Vertex, uint32_t> uniqueVertices`.
- **Hint:** The last argument of LoadObj is the folder of the `.mtl` file; `i / 3` is the face of index `i`.
- **When done:** the planet and its ring in texture-coordinate colours (red = u, green = v), seen slightly from above:
  centre = (191, 92, 0), top = (192, 25, 0), pole = (197, 7, 0), left = (157, 123, 0), ring-front = (145, 64, 0),
  ring-right = (94, 14, 0) (just below the ring's u seam, a sharp red/yellow edge at y ≈ 300, x ≈ 570..640),
  background = (13, 13, 13). One `vkCmdDrawIndexed` with all of the model's indices.

## textures
- **Task:** Load the diffuse maps of the two materials: `const std::string PLANET_DIFFUSE_PATH =
  "models/planet_diffuse.png";` and `RINGS_DIFFUSE_PATH = "models/rings.png";`, a `struct Texture { VkImage image;
  VkDeviceMemory memory; VkImageView view; };`, the members `Texture planetDiffuseMap; Texture ringsDiffuseMap;`,
  `createTextures()` (called before `createTextureSampler()`) with `stbi_load(PLANET_DIFFUSE_PATH.c_str(), …,
  STBI_rgb_alpha)` then `stbi_load(RINGS_DIFFUSE_PATH.c_str(), …)`, each passed to `createTexture(pixels, texWidth,
  texHeight, texture)` (error check, `createTextureImage`, `stbi_image_free`, `createImageView`), and
  `destroyTexture(…)` for both in `cleanup()`.
- **Hint:** The paths are constants in the order of the bindings the textures will get (1, 2): the planet's first.
- **When done:** code only (the shaders do not read the textures yet; picture unchanged): the two `stbi_load` calls
  with the constants, in this order; two textures created and destroyed.

## descriptors
- **Task:** Give the textures descriptors: in `createDescriptorSetLayout()` a `samplerLayoutBinding` (combined image
  sampler, fragment stage) copied into `bindings[1]` (binding 1) and `bindings[2]` (binding 2); in
  `createDescriptorPool()` a second pool size, `VK_DESCRIPTOR_TYPE_COMBINED_IMAGE_SAMPLER` × 2; in
  `createDescriptorSets()` an image info per texture (`planetDiffuseMap.view`, `ringsDiffuseMap.view`, both with
  `textureSampler`) and a write for each (`dstBinding = 1 + i`).
- **Hint:** Binding 0 stays the uniform buffer; the texture at index i of `textureViews` gets binding 1 + i.
- **When done:** code only (picture unchanged): `std::array<VkDescriptorSetLayoutBinding, 3>`,
  `poolSizes[1].descriptorCount = 2`, `std::array<VkWriteDescriptorSet, 3>`, image infos with `textureSampler`.

## material-textures
- **Task:** Colour each fragment with the diffuse map of its material: the vertex shader passes the material index on
  (`layout(location = 3) flat out uint fragMaterialIndex;` – `flat`, an integer is not interpolated); the fragment
  shader declares `layout(binding = 1) uniform sampler2D planetDiffuseMap;`, `layout(binding = 2) uniform sampler2D
  ringsDiffuseMap;` and `layout(location = 3) flat in uint fragMaterialIndex;`, samples **both** textures and keeps
  one: `outColor = fragMaterialIndex == 0u ? planetColor : ringsColor;`.
- **Hint:** Sample before choosing: texture() inside an if whose condition changes between neighbouring pixels gets a
  wrong level of detail.
- **When done:** the textured planet (blue oceans, green land, the white north pole at the top – the texture is
  upright) and the beige-banded ring around it, seen from slightly above, on (13, 13, 13): centre = (105, 140, 60),
  top = (28, 70, 150), pole = (235, 240, 245), left = (63, 121, 50), ocean-left = (28, 70, 150), highlight =
  (72, 125, 52), ring-front = (181, 155, 120), ring-right = (97, 83, 64), ring-left = (96, 83, 64). This is the
  picture of learnopengl's model_loading.cpp (diffuse texture only, no lighting).

## specular-maps
- **Task:** Load and bind the materials' specular maps as well: `PLANET_SPECULAR_PATH = "models/planet_specular.png"`,
  `RINGS_SPECULAR_PATH = "models/rings_specular.png"` (after the diffuse paths), `Texture planetSpecularMap;
  Texture ringsSpecularMap;`, two more `stbi_load` + `createTexture` at the end of `createTextures()`, destroyed in
  `cleanup()`; bindings 3 and 4 (`std::array<VkDescriptorSetLayoutBinding, 5>`), `poolSizes[1].descriptorCount = 4`,
  four `textureViews` / `imageInfos` and `std::array<VkWriteDescriptorSet, 5>`.
- **Hint:** The order of the `stbi_load` calls is the order of the bindings: planet diffuse, rings diffuse, planet
  specular, rings specular.
- **When done:** code only (the shader does not read them yet; picture unchanged): four `stbi_load` calls, five
  descriptor bindings.

## lighting
- **Task (exercise):** Light the model like the lighting-maps chapter: a point light at
  `glm::vec3 lightPos(1.2f, 1.0f, 2.0f);` with ambient 0.2, diffuse 0.5, specular 1.0, no attenuation, Phong with the
  diffuse map and the specular map of the fragment's material, shininess 32, `viewPos = cameraPos`. C++: `struct
  Material` and `struct Light` (padded for std140 as in lighting-maps), `UniformBufferObject { view; proj; viewPos;
  pad1; Material material; Light light; }`, the UBO binding's stage `VERTEX | FRAGMENT`, and `updateUniformBuffer()`
  sets `viewPos`, `material.shininess = 32.0f`, `light.position = lightPos`, the three light colours. Vertex shader:
  `fragPos` (location 0, world space) and `fragNormal = mat3(transpose(inverse(pc.model))) * inNormal` (location 1),
  `gl_Position = ubo.proj * ubo.view * vec4(fragPos, 1.0)`. Fragment shader: the samplers at bindings 3 and 4, the
  `Material` / `Light` structs and the uniform block (binding 0), sample all four maps, select diffuse and specular
  colour by `fragMaterialIndex`, then ambient + diffuse + specular.
- **Hint:** The normal matrix keeps the normals right under the model's rotation and scaling (the ring's normal +y
  tilts with it).
- **When done:** the planet lit from the upper right front (the light), its lower left in shadow (ambient only), the
  ring lit from above: centre = (57, 76, 33), top = (16, 40, 86), pole = (120, 123, 125), left = (13, 24, 10),
  ocean-left = (6, 14, 30), ring-front = (108, 93, 72), ring-right = (59, 51, 39), ring-left = (49, 42, 32),
  background = (13, 13, 13). The highlight of the light falls at about (436, 270) – on land, whose specular map is dark,
  so it is faint there: highlight = (67, 102, 54). An ocean shows a bright highlight when the camera moves (A/D, the
  mouse) so the highlight lands on it.

**std140:** as in lighting-maps – `viewPos` is followed by a padding float, `Material` (shininess + 3 floats) is 16
bytes, `Light` has a padding float after each vec3 (64 bytes), so the C++ struct has the shader block's offsets.
