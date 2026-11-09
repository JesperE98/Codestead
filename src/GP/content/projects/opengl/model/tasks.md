# Model – tasks (OpenGL)

learnopengl "Model": `includes/learnopengl/model.h` and `src/3.model_loading/1.model_loading/model_loading.cpp`. Files:
`main.cpp`, `shader_m.h`, `mesh.h` (finished in the Mesh chapter), `model.h`, `model_loading.vs`, `model_loading.fs`,
and the read-only model in `models/` (`planet.obj` with the objects `planet` and `rings`, `planet.mtl`,
`planet_diffuse.png`, `planet_specular.png`, `rings.png`, `rings_specular.png`). Compiled with `-lassimp`.

Start (prepared from the Mesh solution): `main.cpp` includes `"model.h"` instead of `"mesh.h"` and has two TODOs: after
`Shader ourShader(...)` `// TODO: load the model from "models/planet.obj" (Model ourModel)`, and after
`ourShader.setMat4("model", model);` `// TODO: draw the loaded model (ourModel.Draw)`. `model.h` (start): include guard,
includes (glad, glm, `<stb_image.h>`, `<assimp/Importer.hpp>`, `<assimp/scene.h>`, `<assimp/postprocess.h>`,
`"mesh.h"`, `"shader_m.h"`, `<string>`, `<cstring>`, `<iostream>`, `<vector>`), the declaration
`unsigned int TextureFromFile(const char *path, const std::string &directory);`, and `class Model` with the public data
`std::vector<Texture> textures_loaded; std::vector<Mesh> meshes; std::string directory;`, TODOs for the constructor and
`Draw`, and the private functions `loadModel(std::string const &path)`, `processNode(aiNode *node, const aiScene *scene)`
with TODO bodies, `processMesh(aiMesh *mesh, const aiScene *scene)` that declares the three vectors, has two TODOs and
returns `Mesh(vertices, indices, textures)`, and TODOs for `loadMaterialTextures` (in the class) and `TextureFromFile`
(after it). learnopengl's `gammaCorrection` / `gamma` parameter is left out (unused); the height maps
(`aiTextureType_AMBIENT`) are left out; `std::` is written out.

**Texture orientation:** `model.h` keeps learnopengl's flags including `aiProcess_FlipUVs`, but `main.cpp` does **not**
call `stbi_set_flip_vertically_on_load(true)` (learnopengl's model_loading.cpp does both, which only suits its backpack
model, whose texture coordinates are stored flipped). The OBJ has v = 1 at the north pole and the images have the north
pole in their first row; one flip is needed, and doing both turns the planet's texture upside down. A comment in
`main.cpp` says so. (Measured: with FlipUVs alone the land and the small round sea near the north pole appear exactly as
at the top of `planet_diffuse.png`.)

Pixels measured with Mesa (llvmpipe), coordinates from the top left of the 800×600 window; nothing depends on time (the
camera stands still at (0, 0, 3) without input). The model covers x ≈ 147..652, y ≈ 178..445: the planet is a disc of
radius ≈ 122 px around (400,285) (row 300: x ≈ 278..521), its north pole at the top (y ≈ 178..190, white), the ring
around it seen slightly from above (row 300: x ≈ 158..230 left and 569..641 right; the ring's front edge crosses the
planet's lower part at y ≈ 385..445; behind the planet the ring is hidden). Named points: **centre** (400,300) land,
**pole** (400,186) ice, **sea** (380,215) ocean near the pole, **lake** (437,220) small round ocean spot,
**highlight** (435,268) land where the light's reflection is, **left-edge** (292,300) ocean at the planet's left rim,
**sea-low** (470,382) ocean just above the ring, **lower-left** (330,330) land, **ring-front** (400,420) a light band,
**ring-left** (175,330) and **ring-right** (625,330) darker bands, **gap** (250,310) between ring and planet = background,
**background** (400,520) and (100,100).

Start picture and every step up to `material-textures`: nothing is drawn – the whole window ≈ 13,13,13 (the Model is
not created before `draw-model`, so every state runs).

## `load-model`
- **Task:** Give `Model` a constructor `Model(std::string const &path)` that calls `loadModel(path)`, and write `loadModel`: read the file with an `Assimp::Importer` (`aiProcess_Triangulate | aiProcess_GenSmoothNormals | aiProcess_FlipUVs | aiProcess_CalcTangentSpace`), print Assimp's error and return if it failed, store the file's directory and process the root node.
- **Hint:** `const aiScene* scene = importer.ReadFile(path, ...);` fails when `!scene || scene->mFlags & AI_SCENE_FLAGS_INCOMPLETE || !scene->mRootNode`; the error text is `importer.GetErrorString()`. The directory is `path.substr(0, path.find_last_of('/'))`; then `processNode(scene->mRootNode, scene);`.
- **When done:** `Model(std::string const &path) { loadModel(path); }`; `loadModel` has `Assimp::Importer importer;`,
  `importer.ReadFile(path, aiProcess_Triangulate | aiProcess_GenSmoothNormals | aiProcess_FlipUVs | aiProcess_CalcTangentSpace)`,
  the error check printing `"ERROR::ASSIMP:: " << importer.GetErrorString()` and `return;`,
  `directory = path.substr(0, path.find_last_of('/'));` and `processNode(scene->mRootNode, scene);`. Nothing visible
  changes.

## `process-node`
- **Task:** Write `processNode`: turn every mesh of the node into a `Mesh` with `processMesh` and add it to `meshes`, then call `processNode` for every child node.
- **Hint:** A node only holds indices: the mesh itself is `scene->mMeshes[node->mMeshes[i]]` (for `i < node->mNumMeshes`); the children are `node->mChildren[i]` (for `i < node->mNumChildren`).
- **When done:** two `for` loops: `aiMesh* mesh = scene->mMeshes[node->mMeshes[i]]; meshes.push_back(processMesh(mesh, scene));`
  and `processNode(node->mChildren[i], scene);`. Nothing visible changes. (planet.obj gives two meshes: `planet` and
  `rings`.)

## `process-mesh`
- **Task:** In `processMesh`, copy every vertex of the `aiMesh` into a `Vertex` (position, normal if there are normals, the first set of texture coordinates or (0, 0)) and every face's indices into `indices`.
- **Hint:** Loop `i < mesh->mNumVertices`: `mesh->mVertices[i]`, `mesh->mNormals[i]` (if `mesh->HasNormals()`), `mesh->mTextureCoords[0][i]` (if `mesh->mTextureCoords[0]`). Then loop over `mesh->mNumFaces`: `aiFace face = mesh->mFaces[i];` and push `face.mIndices[j]` for `j < face.mNumIndices` (3, thanks to aiProcess_Triangulate).
- **When done:** the vertex loop (`Vertex vertex; glm::vec3 vector;` …, `vertex.Position`, `vertex.Normal`,
  `vertex.TexCoords`, `vertices.push_back(vertex);`) and the face loop (`indices.push_back(face.mIndices[j]);`) stand
  before the materials TODO. Nothing visible changes.

## `texture-from-file`
- **Task:** Write `TextureFromFile(const char *path, const std::string &directory)` after the class: load `directory + '/' + path` with `stbi_load`, create an OpenGL texture from it (format from the channel count, mipmaps, REPEAT, LINEAR_MIPMAP_LINEAR / LINEAR) and return its id; print a message if the file cannot be loaded.
- **Hint:** It is the `loadTexture` function of the lighting chapters, with the directory put in front of the file name – the .mtl names the images relative to the .obj file (`models/`). No `stbi_set_flip_vertically_on_load` here (see the note above).
- **When done:** `unsigned int TextureFromFile(const char *path, const std::string &directory)` with
  `filename = directory + '/' + filename;`, `glGenTextures(1, &textureID)`, `stbi_load(filename.c_str(), &width, &height, &nrComponents, 0)`,
  `GL_RED`/`GL_RGB`/`GL_RGBA` by `nrComponents`, `glBindTexture`, `glTexImage2D`, `glGenerateMipmap`, the four
  `glTexParameteri` calls, `stbi_image_free(data)`, the message `"Texture failed to load at path: "` and
  `return textureID;`. Nothing visible changes.

## `material-textures`
- **Task:** Load the mesh's material textures: write `loadMaterialTextures(aiMaterial *mat, aiTextureType type, std::string typeName)` (each file only once, using `textures_loaded`) and in `processMesh` add the diffuse (`"texture_diffuse"`), specular (`"texture_specular"`) and normal (`"texture_normal"`, Assimp's `aiTextureType_HEIGHT` for OBJ `map_Bump`) maps to `textures`.
- **Hint:** `aiMaterial* material = scene->mMaterials[mesh->mMaterialIndex];` For each `i < mat->GetTextureCount(type)`: `mat->GetTexture(type, i, &str);` – if `textures_loaded` already has a texture with `path == str.C_Str()` (`std::strcmp`), reuse it, else `TextureFromFile(str.C_Str(), this->directory)` and remember it in `textures_loaded`.
- **When done:** `processMesh` has `aiMaterial* material = scene->mMaterials[mesh->mMaterialIndex];` and three
  `loadMaterialTextures(material, aiTextureType_DIFFUSE, "texture_diffuse")` / `(…, aiTextureType_SPECULAR, "texture_specular")`
  / `(…, aiTextureType_HEIGHT, "texture_normal")` calls, each followed by `textures.insert(textures.end(), …)`; the class
  has `loadMaterialTextures` with the `textures_loaded` cache (`bool skip`, `std::strcmp(textures_loaded[j].path.data(), str.C_Str()) == 0`,
  `texture.id = TextureFromFile(str.C_Str(), this->directory); texture.type = typeName; texture.path = str.C_Str();`,
  `textures_loaded.push_back(texture);`). Nothing visible changes. (planet: `planet_diffuse.png` + `planet_specular.png`;
  rings: `rings.png` + `rings_specular.png`; no normal maps.)

## `draw-model`
- **Task:** Give `Model` a `Draw(Shader &shader)` that draws all its meshes; in `main.cpp` load the model with `Model ourModel("models/planet.obj");` after the shader, and draw it with `ourModel.Draw(ourShader);` right after the model matrix is set.
- **Hint:** `for (unsigned int i = 0; i < meshes.size(); i++) meshes[i].Draw(shader);` The model is loaded once, before the render loop; the path is relative to the program's folder.
- **When done:** `model.h`: `void Draw(Shader &shader)` with the loop over `meshes`. `main.cpp`: `// load models` with
  the comment about not flipping and `Model ourModel("models/planet.obj");` after `Shader ourShader(...)`;
  `ourModel.Draw(ourShader);` after `ourShader.setMat4("model", model);`. **The planet appears**, textured, unlit: in
  the centre the planet (radius ≈ 122 px), white pole at the top, the beige ring around it seen slightly from above, dark
  grey background. centre ≈ 105,140,60 (land), pole ≈ 235,240,245, sea ≈ 28,70,150, lake ≈ 28,70,150, highlight ≈
  73,125,52 (land), left-edge ≈ 28,70,150, sea-low ≈ 28,71,149, lower-left ≈ 79,128,54, ring-front ≈ 178,153,119,
  ring-left ≈ 79,67,52, ring-right ≈ 82,70,55, gap and background ≈ 13,13,13. (The texture colours are shown unchanged:
  ocean 28,70,150, ice 235,240,245.)

## `lighting`
- **Task:** Exercise: light the model like the Lighting Maps chapter – a white point light at `lightPos` (1.2, 1.0, 2.0) with ambient 0.2, diffuse 0.5, specular 1.0 (no attenuation), Phong shading with `texture_diffuse1` as the diffuse colour and `texture_specular1` as the specular map, shininess 32, `viewPos` = `cameraPos`. The vertex shader passes `FragPos` and the normal (with the normal matrix).
- **Hint:** Vertex shader: `FragPos = vec3(model * vec4(aPos, 1.0)); Normal = mat3(transpose(inverse(model))) * aNormal;`. Fragment shader: `struct Light { vec3 position; vec3 ambient; vec3 diffuse; vec3 specular; };` and the ambient + diffuse + specular sum of Lighting Maps, sampling `texture_diffuse1` / `texture_specular1`. In `main.cpp`: `ourShader.setVec3("light.position", lightPos);` … and `ourShader.setFloat("shininess", 32.0f);`.
- **When done:** `main.cpp`: global `// lighting` `glm::vec3 lightPos(1.2f, 1.0f, 2.0f);` after the timing globals;
  after `ourShader.use();`: `setVec3("viewPos", cameraPos)`, `setFloat("shininess", 32.0f)`,
  `setVec3("light.position", lightPos)`, `setVec3("light.ambient", 0.2f, 0.2f, 0.2f)`,
  `setVec3("light.diffuse", 0.5f, 0.5f, 0.5f)`, `setVec3("light.specular", 1.0f, 1.0f, 1.0f)`. `model_loading.vs`:
  `out vec3 FragPos; out vec3 Normal;`, `FragPos = vec3(model * vec4(aPos, 1.0));`,
  `Normal = mat3(transpose(inverse(model))) * aNormal;`, `gl_Position = projection * view * vec4(FragPos, 1.0);`.
  `model_loading.fs`: `struct Light`, inputs `FragPos`, `Normal`, `TexCoords`, uniforms `texture_diffuse1`,
  `texture_specular1`, `float shininess`, `vec3 viewPos`, `Light light`, and
  `FragColor = vec4(ambient + diffuse + specular, 1.0)`. The model is **lit from the upper right front**: the side
  facing (1.2, 1, 2) is brightest, the left rim is dark (only ambient). centre ≈ 57,77,33, highlight ≈ 68,102,54 (the
  reflection of the light falls on land, whose specular map is dark (20), so it is only a faint soft spot – the oceans
  (specular map 200) do not lie under the highlight from this camera), pole ≈ 120,123,125, sea ≈ 15,38,82, lake ≈
  19,47,101, left-edge ≈ 6,14,30 (dark side, ambient only), sea-low ≈ 10,24,51, lower-left ≈ 22,35,15, ring-front ≈
  107,92,71, ring-left ≈ 39,33,26, ring-right ≈ 51,43,34 (the ring's normal is +y tilted by 25° towards the camera, so
  the whole ring is evenly lit at ≈ 0.6 of its texture colour), gap and background ≈ 13,13,13.
