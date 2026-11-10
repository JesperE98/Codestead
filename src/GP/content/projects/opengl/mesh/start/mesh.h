#ifndef MESH_H
#define MESH_H

#include <glad/glad.h> // holds all OpenGL type declarations

#include <glm/glm.hpp>
#include <glm/gtc/matrix_transform.hpp>

#include "shader_m.h"

#include <string>
#include <vector>

// TODO: the Vertex struct (Position, Normal, TexCoords) and the Texture struct (id, type, path)

class Mesh {
public:
    // TODO: the mesh data (vertices, indices, textures, VAO) and the constructor that stores it and calls setupMesh

    // render the mesh
    void Draw(Shader &shader)
    {
        // TODO: bind the textures to the samplers texture_diffuseN / texture_specularN and draw the triangles (glDrawElements)
    }

private:
    // initializes all the buffer objects/arrays
    void setupMesh()
    {
        // TODO: create the VAO, VBO and EBO, fill them and set the vertex attribute pointers (offsetof)
    }
};
#endif
