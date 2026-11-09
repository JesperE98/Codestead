#ifndef MODEL_H
#define MODEL_H

#include <glad/glad.h>

#include <glm/glm.hpp>
#include <glm/gtc/matrix_transform.hpp>
#include <stb_image.h>
#include <assimp/Importer.hpp>
#include <assimp/scene.h>
#include <assimp/postprocess.h>

#include "mesh.h"
#include "shader_m.h"

#include <string>
#include <cstring>
#include <iostream>
#include <vector>

unsigned int TextureFromFile(const char *path, const std::string &directory);

class Model
{
public:
    // model data
    std::vector<Texture> textures_loaded; // stores all the textures loaded so far, optimization to make sure textures aren't loaded more than once.
    std::vector<Mesh>    meshes;
    std::string directory;

    // TODO: the constructor: load the model at path (loadModel)

    // TODO: Draw: draw every mesh of the model

private:
    // loads a model with supported ASSIMP extensions from file and stores the resulting meshes in the meshes vector.
    void loadModel(std::string const &path)
    {
        // TODO: read the file with an Assimp::Importer, check for errors, remember the directory and process the root node
    }

    // processes a node in a recursive fashion. Processes each individual mesh located at the node and repeats this process on its children nodes (if any).
    void processNode(aiNode *node, const aiScene *scene)
    {
        // TODO: turn every mesh of this node into a Mesh (processMesh), then process the children
    }

    Mesh processMesh(aiMesh *mesh, const aiScene *scene)
    {
        // data to fill
        std::vector<Vertex> vertices;
        std::vector<unsigned int> indices;
        std::vector<Texture> textures;

        // TODO: copy every vertex (position, normal, texture coordinates) and the indices of every face

        // TODO: process materials: load the diffuse, specular and normal maps (loadMaterialTextures)

        // return a mesh object created from the extracted mesh data
        return Mesh(vertices, indices, textures);
    }

    // TODO: loadMaterialTextures: load the material's textures of one type (each file only once)
};


// TODO: TextureFromFile: load an image file from the model's directory into an OpenGL texture
#endif
