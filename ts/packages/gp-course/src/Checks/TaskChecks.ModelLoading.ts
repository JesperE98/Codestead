import { given, type CheckContext } from "../CheckContext.js";
import { type ChapterChecks } from "./TaskChecks.PerApi.js";

// Model Loading: most steps build the mesh and model code without changing the picture (learnopengl's Mesh and Model
// chapters draw nothing new until the model is drawn), so they are checked in the code; the model itself and the
// lighting exercise are checked in the picture. Task ids differ a little per API (vulkan-tutorial has no Mesh class).

/** The planet's north pole (white ice) at the top of the model: (400, 186) of the 800×600 window. */

export function poleIsIce(c: CheckContext): boolean {
  return given(c.pixel(0.5, 0.31), (p) => p[0] > 0.75 && p[1] > 0.75 && p[2] > 0.75);
}

export function modelLoading(): ChapterChecks {
  return [
    ["mesh", {
        // OpenGL (mesh.h)
        "vertex-struct": c => c.built && c.has("struct Vertex \\{[^}]*Position[^}]*Normal[^}]*TexCoords") && c.has("struct Texture \\{"),
        "mesh-data": c => c.built && (c.api === "vulkan"
            ? c.has("std::vector< ?uint32_t ?> indices")
            : c.has("Mesh \\( std::vector< ?Vertex ?> vertices") && c.has("setupMesh \\( \\) ;")),
        "setup-mesh": c => c.built && (c.api === "d3d12"
            ? c.has("m_indexBufferView \\. Format = DXGI_FORMAT_R32_UINT")
            : c.has("offsetof \\( Vertex , Normal \\)") && c.has("glBufferData \\( GL_ELEMENT_ARRAY_BUFFER")),
        "draw-mesh": c => c.built && (c.api === "d3d12"
            ? c.has("commandList -> DrawIndexedInstanced")
            : c.has("glDrawElements \\( GL_TRIANGLES , static_cast< ?unsigned int ?> \\( indices \\. size \\( \\) \\)")),
        // Vulkan
        "vertex": c => c.built && (c.api === "vulkan"
            ? c.has("uint32_t materialIndex ;") && c.has("VK_FORMAT_R32_UINT")
            : c.has("struct Vertex \\{[^}]*position[^}]*normal[^}]*texCoord")),
        "vertex-equality": c => c.built && c.has("bool operator== \\( const Vertex &") && c.has("struct hash< ?Vertex ?>"),
        "vertex-buffer": c => c.built && c.has("copyBuffer \\( stagingBuffer , vertexBuffer"),
        "index-buffer": c => c.built && c.has("copyBuffer \\( stagingBuffer , indexBuffer"),
        "draw": c => c.drew && c.has("VK_INDEX_TYPE_UINT32") && c.has("vkCmdDrawIndexed \\("),
        // DirectX 12
        "mesh-class": c => c.built && c.has("class Mesh \\{") && c.has("std::vector< ?Vertex ?> vertices"),
        "mesh-textures": c => c.built && c.has("\"texture_diffuse\" , \"texture_specular\"") && c.has("CreateShaderResourceView"),
    }],
    ["model", {
        "load-model": c => c.api === "vulkan"
            ? c.drew && c.has("tinyobj::LoadObj \\(")
            : c.built && c.has("ReadFile \\( path , aiProcess_Triangulate") && c.has("processNode \\( scene -> mRootNode , scene \\)"),
        "process-node": c => c.built && c.has("processNode \\( node -> mChildren \\[ i \\] , scene \\)"),
        "process-mesh": c => c.built && c.has("mesh -> mVertices \\[ i \\]") && c.has("face \\. mIndices \\[ j \\]"),
        "texture-from-file": c => c.built && c.has("unsigned int TextureFromFile \\( const char \\* path , const std::string & directory \\) \\{[^}]*glGenTextures"),
        "material-textures": c => c.api === "vulkan"
            ? c.drew && c.hasInShaders("flat in uint") && poleIsIce(c)
            : c.built && c.has("loadMaterialTextures \\( material , aiTextureType_DIFFUSE , \"texture_diffuse\" \\)"),
        "draw-model": c => c.drew && poleIsIce(c) && (c.api === "d3d12" ? c.has("m_model \\. Draw \\(") : c.has("ourModel \\. Draw \\( ourShader \\)")),
        // Vulkan
        "textures": c => c.built && c.has("stbi_load \\( PLANET_DIFFUSE_PATH \\. c_str \\( \\)") && c.has("stbi_load \\( RINGS_DIFFUSE_PATH \\. c_str \\( \\)"),
        "descriptors": c => c.built && c.has("VK_DESCRIPTOR_TYPE_COMBINED_IMAGE_SAMPLER") && c.has("descriptorWrites \\[ 1 \\+ i \\] \\. dstBinding"),
        "specular-maps": c => c.built && c.has("_SPECULAR_PATH \\. c_str \\( \\)"),
        // every API: the exercise
        "lighting": c => c.drew && c.hasInShaders("reflect \\(") && c.hasInShaders("pow \\(") && c.hasInShaders("(?i)specular"),
    }],
  ];
}
