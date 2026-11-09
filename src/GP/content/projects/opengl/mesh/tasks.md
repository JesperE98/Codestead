# Mesh – tasks (OpenGL)

learnopengl "Mesh": `includes/learnopengl/mesh.h`. Files: `main.cpp`, `shader_m.h`, `mesh.h`, `model_loading.vs`,
`model_loading.fs` (learnopengl's `1.model_loading.vs/.fs`, renamed like the lighting chapters' shaders), and the
read-only model files in `models/` (`planet.obj`, `planet.mtl`, `planet_diffuse.png`, `planet_specular.png`,
`rings.png`, `rings_specular.png`).

Start (prepared from the Multiple Lights solution, reduced to learnopengl's `model_loading.cpp` scene): the camera
globals at (0, 0, 3) looking down -z (yaw -90, pitch 0, fov 45) with WASD, mouse look and zoom as before; no vertex data,
no textures, no lamps. `main.cpp` includes `"shader_m.h"` and `"mesh.h"`, then `#define STB_IMAGE_IMPLEMENTATION` +
`#include <stb_image.h>` (moved below the project headers: model.h will include `<stb_image.h>` for its declarations, and
the implementation must be compiled exactly once). One shader `Shader ourShader("model_loading.vs", "model_loading.fs");`
(vertex attributes location 0 `aPos`, 1 `aNormal`, 2 `aTexCoords`; the fragment shader outputs
`texture(texture_diffuse1, TexCoords)`), depth test on, clear colour (0.05, 0.05, 0.05), and in the loop `projection`
(perspective fov, 800/600, 0.1, 100), `view` (lookAt from cameraPos) and the `model` matrix (translate (0, 0, 0),
rotate 25° about x, scale 0.5) set with `setMat4`. Nothing is drawn yet: learnopengl's Mesh chapter draws nothing new.

`mesh.h` (start): include guard `MESH_H`, includes (`glad`, `glm`, `"shader_m.h"`, `<string>`, `<vector>`), a TODO for the
two structs, and `class Mesh` with `public:` a TODO for the data and constructor, `void Draw(Shader &shader)` with a TODO
body, and `private:` `void setupMesh()` with a TODO body.

**Picture: no task changes it.** Start and every step: the whole window is the clear colour ≈ 13,13,13 (nothing is
drawn until the Model chapter). The checks are code checks; every state compiles and runs. Unlike learnopengl the code
writes `std::vector` / `std::string` (no `using namespace std;` in a header), and the Vertex has only the 3.3-core
essentials (no Tangent/Bitangent/bone data, no `MAX_BONE_INFLUENCE`).

## `vertex-struct`
- **Task:** In `mesh.h`, define `struct Vertex` with `glm::vec3 Position`, `glm::vec3 Normal` and `glm::vec2 TexCoords`, and `struct Texture` with `unsigned int id`, `std::string type` and `std::string path`.
- **Hint:** The fields of a struct lie one after the other in memory, so an array of `Vertex` is exactly the interleaved buffer OpenGL needs (8 floats per vertex). `type` will be `"texture_diffuse"` or `"texture_specular"`.
- **When done:** `mesh.h` has `struct Vertex { glm::vec3 Position; glm::vec3 Normal; glm::vec2 TexCoords; };` and
  `struct Texture { unsigned int id; std::string type; std::string path; };` before `class Mesh`. Nothing visible changes.

## `mesh-data`
- **Task:** Give `Mesh` its data – `std::vector<Vertex> vertices`, `std::vector<unsigned int> indices`, `std::vector<Texture> textures` and `unsigned int VAO` – and a constructor that takes the three vectors, stores them and calls `setupMesh()`.
- **Hint:** `Mesh(std::vector<Vertex> vertices, std::vector<unsigned int> indices, std::vector<Texture> textures)` – the parameters have the same names as the members, so store them with `this->vertices = vertices;` and so on.
- **When done:** public members `vertices`, `indices`, `textures`, `VAO` (comment `// mesh Data`) and the constructor
  `Mesh(std::vector<Vertex> vertices, std::vector<unsigned int> indices, std::vector<Texture> textures)` with
  `this->vertices = vertices; this->indices = indices; this->textures = textures;` and `setupMesh();`. Nothing visible
  changes.

## `setup-mesh`
- **Task:** Fill `setupMesh()`: create the VAO, VBO and EBO (`unsigned int VBO, EBO;` as private members), upload the vertices and indices, and set the three vertex attribute pointers with a stride of `sizeof(Vertex)` and offsets from `offsetof`.
- **Hint:** `glBufferData(GL_ARRAY_BUFFER, vertices.size() * sizeof(Vertex), &vertices[0], GL_STATIC_DRAW);` – the same for `GL_ELEMENT_ARRAY_BUFFER` with `indices`. The normal starts at `(void*)offsetof(Vertex, Normal)`, the texture coordinates at `(void*)offsetof(Vertex, TexCoords)`.
- **When done:** `private:` `// render data` `unsigned int VBO, EBO;`; `setupMesh()` calls `glGenVertexArrays(1, &VAO)`,
  `glGenBuffers(1, &VBO)`, `glGenBuffers(1, &EBO)`, `glBindVertexArray(VAO)`, `glBindBuffer(GL_ARRAY_BUFFER, VBO)` +
  `glBufferData(GL_ARRAY_BUFFER, vertices.size() * sizeof(Vertex), &vertices[0], GL_STATIC_DRAW)`,
  `glBindBuffer(GL_ELEMENT_ARRAY_BUFFER, EBO)` + `glBufferData(GL_ELEMENT_ARRAY_BUFFER, indices.size() * sizeof(unsigned int), &indices[0], GL_STATIC_DRAW)`,
  then `glEnableVertexAttribArray` + `glVertexAttribPointer` for location 0 (3 floats, `(void*)0`), 1 (3 floats,
  `(void*)offsetof(Vertex, Normal)`) and 2 (2 floats, `(void*)offsetof(Vertex, TexCoords)`), all with stride
  `sizeof(Vertex)`, and `glBindVertexArray(0)`. Nothing visible changes.

## `draw-mesh`
- **Task:** Fill `Draw(Shader &shader)`: bind every texture to its own texture unit, point the sampler named after it (`texture_diffuse1`, `texture_diffuse2`, …, `texture_specular1`, …) at that unit, then draw the mesh's triangles with `glDrawElements`.
- **Hint:** Count diffuse, specular and normal textures separately (`diffuseNr`, `specularNr`, `normalNr`, starting at 1); for texture `i`: `glActiveTexture(GL_TEXTURE0 + i)`, `glUniform1i(glGetUniformLocation(shader.ID, (name + number).c_str()), i)`, `glBindTexture(GL_TEXTURE_2D, textures[i].id)`. Then `glBindVertexArray(VAO)` and `glDrawElements(GL_TRIANGLES, static_cast<unsigned int>(indices.size()), GL_UNSIGNED_INT, 0)`.
- **When done:** `Draw` has `unsigned int diffuseNr = 1;`, `unsigned int specularNr = 1;`, `unsigned int normalNr = 1;`, a `for` loop over `textures`
  with `glActiveTexture(GL_TEXTURE0 + i)`, the name `textures[i].type` + number (`std::to_string(diffuseNr++)` for
  `"texture_diffuse"`, `specularNr++` for `"texture_specular"`, `normalNr++` for `"texture_normal"`),
  `glUniform1i(glGetUniformLocation(shader.ID, (name + number).c_str()), i)` and
  `glBindTexture(GL_TEXTURE_2D, textures[i].id)`; then `glBindVertexArray(VAO)`,
  `glDrawElements(GL_TRIANGLES, static_cast<unsigned int>(indices.size()), GL_UNSIGNED_INT, 0)`, `glBindVertexArray(0)`
  and `glActiveTexture(GL_TEXTURE0)`. Nothing visible changes (no Mesh is created yet – that is the Model chapter).
