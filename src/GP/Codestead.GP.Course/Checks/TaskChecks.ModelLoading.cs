namespace Codestead.GP.Course.Checks;

// Model Loading: most steps build the mesh and model code without changing the picture (learnopengl's Mesh and Model
// chapters draw nothing new until the model is drawn), so they are checked in the code; the model itself and the
// lighting exercise are checked in the picture. Task ids differ a little per API (vulkan-tutorial has no Mesh class).
public static partial class TaskChecks
{
    /// <summary>The planet's north pole (white ice) at the top of the model: (400, 186) of the 800×600 window.</summary>
    private static bool PoleIsIce(CheckContext c) => c.Pixel(0.5, 0.31) is { } p && p[0] > 0.75 && p[1] > 0.75 && p[2] > 0.75;

    private static IEnumerable<(string Chapter, Dictionary<string, TaskCheck> Checks)> ModelLoading =>
    [
        ("mesh", new()
        {
            // OpenGL (mesh.h)
            ["vertex-struct"] = c => c.Built && c.Has(@"struct Vertex \{[^}]*Position[^}]*Normal[^}]*TexCoords") && c.Has(@"struct Texture \{"),
            ["mesh-data"] = c => c.Built && (c.Api == "vulkan"
                ? c.Has(@"std::vector< ?uint32_t ?> indices")
                : c.Has(@"Mesh \( std::vector< ?Vertex ?> vertices") && c.Has(@"setupMesh \( \) ;")),
            ["setup-mesh"] = c => c.Built && (c.Api == "d3d12"
                ? c.Has(@"m_indexBufferView \. Format = DXGI_FORMAT_R32_UINT")
                : c.Has(@"offsetof \( Vertex , Normal \)") && c.Has(@"glBufferData \( GL_ELEMENT_ARRAY_BUFFER")),
            ["draw-mesh"] = c => c.Built && (c.Api == "d3d12"
                ? c.Has(@"commandList -> DrawIndexedInstanced")
                : c.Has(@"glDrawElements \( GL_TRIANGLES , static_cast< ?unsigned int ?> \( indices \. size \( \) \)")),
            // Vulkan
            ["vertex"] = c => c.Built && (c.Api == "vulkan"
                ? c.Has(@"uint32_t materialIndex ;") && c.Has("VK_FORMAT_R32_UINT")
                : c.Has(@"struct Vertex \{[^}]*position[^}]*normal[^}]*texCoord")),
            ["vertex-equality"] = c => c.Built && c.Has(@"bool operator== \( const Vertex &") && c.Has(@"struct hash< ?Vertex ?>"),
            ["vertex-buffer"] = c => c.Built && c.Has(@"copyBuffer \( stagingBuffer , vertexBuffer"),
            ["index-buffer"] = c => c.Built && c.Has(@"copyBuffer \( stagingBuffer , indexBuffer"),
            ["draw"] = c => c.Drew && c.Has("VK_INDEX_TYPE_UINT32") && c.Has(@"vkCmdDrawIndexed \("),
            // DirectX 12
            ["mesh-class"] = c => c.Built && c.Has(@"class Mesh \{") && c.Has(@"std::vector< ?Vertex ?> vertices"),
            ["mesh-textures"] = c => c.Built && c.Has(@"""texture_diffuse"" , ""texture_specular""") && c.Has(@"CreateShaderResourceView"),
        }),
        ("model", new()
        {
            ["load-model"] = c => c.Api == "vulkan"
                ? c.Drew && c.Has(@"tinyobj::LoadObj \(")
                : c.Built && c.Has(@"ReadFile \( path , aiProcess_Triangulate") && c.Has(@"processNode \( scene -> mRootNode , scene \)"),
            ["process-node"] = c => c.Built && c.Has(@"processNode \( node -> mChildren \[ i \] , scene \)"),
            ["process-mesh"] = c => c.Built && c.Has(@"mesh -> mVertices \[ i \]") && c.Has(@"face \. mIndices \[ j \]"),
            ["texture-from-file"] = c => c.Built && c.Has(@"unsigned int TextureFromFile \( const char \* path , const std::string & directory \) \{[^}]*glGenTextures"),
            ["material-textures"] = c => c.Api == "vulkan"
                ? c.Drew && c.HasInShaders(@"flat in uint") && PoleIsIce(c)
                : c.Built && c.Has(@"loadMaterialTextures \( material , aiTextureType_DIFFUSE , ""texture_diffuse"" \)"),
            ["draw-model"] = c => c.Drew && PoleIsIce(c) && (c.Api == "d3d12" ? c.Has(@"m_model \. Draw \(") : c.Has(@"ourModel \. Draw \( ourShader \)")),
            // Vulkan
            ["textures"] = c => c.Built && c.Has(@"stbi_load \( PLANET_DIFFUSE_PATH \. c_str \( \)") && c.Has(@"stbi_load \( RINGS_DIFFUSE_PATH \. c_str \( \)"),
            ["descriptors"] = c => c.Built && c.Has(@"VK_DESCRIPTOR_TYPE_COMBINED_IMAGE_SAMPLER") && c.Has(@"descriptorWrites \[ 1 \+ i \] \. dstBinding"),
            ["specular-maps"] = c => c.Built && c.Has(@"_SPECULAR_PATH \. c_str \( \)"),
            // every API: the exercise
            ["lighting"] = c => c.Drew && c.HasInShaders(@"reflect \(") && c.HasInShaders(@"pow \(") && c.HasInShaders(@"(?i)specular"),
        }),
    ];
}
