// A Direct3D 12 program in one file, modelled on Microsoft's D3D12HelloWorld samples
// (D3D12HelloWindow, D3D12HelloTriangle, D3D12HelloTexture, D3D12HelloConstBuffers)
// and the depth buffer of the D3D12Bundles sample. The mesh and the model are ports of
// learnopengl.com's Mesh and Model classes (with the bone data of its skeletal animation
// article); its Bone, Animation and Animator classes are written as structs and free functions.

#include <windows.h>
#include <windowsx.h>
#include <d3d12.h>
#include <dxgi1_6.h>
#include <d3dcompiler.h>
#include <DirectXMath.h>
#include <wrl.h>
#include "d3dx12.h"

// stb_image loads image files (PNG, JPEG ...). STB_IMAGE_IMPLEMENTATION makes this file
// compile the library's code as well (do that in exactly one .cpp file).
#define STB_IMAGE_IMPLEMENTATION
#include <stb_image.h>

// Assimp (the Open Asset Import Library) reads 3D model files: Wavefront .obj, FBX, glTF ...
// Add its include folder and its library to the project (for example with vcpkg: vcpkg install assimp).
#include <assimp/Importer.hpp>
#include <assimp/scene.h>
#include <assimp/postprocess.h>

#include <chrono>
#include <climits>
#include <cmath>
#include <cstdio>
#include <cstring>
#include <map>
#include <stdexcept>
#include <string>
#include <vector>

// The libraries to link: d3d12.lib, dxgi.lib and d3dcompiler.lib (Visual Studio reads these lines).
#if defined(_MSC_VER)
#pragma comment(lib, "d3d12.lib")
#pragma comment(lib, "dxgi.lib")
#pragma comment(lib, "d3dcompiler.lib")
#endif

using namespace DirectX;

// ComPtr is a smart pointer for COM objects: it releases the object when it goes away.
// It knows nothing about the GPU, though: OnDestroy() waits until the GPU is done
// before the objects are released.
using Microsoft::WRL::ComPtr;

// Turns a failed HRESULT (the result code of the D3D12 and DXGI calls) into an exception.
inline void ThrowIfFailed(HRESULT hr)
{
    if (FAILED(hr))
    {
        char message[64] = {};
        snprintf(message, sizeof(message), "HRESULT of 0x%08X", static_cast<unsigned int>(hr));
        throw std::runtime_error(message);
    }
}

// The size of a constant buffer view must be a multiple of 256 bytes
// (D3D12_CONSTANT_BUFFER_DATA_PLACEMENT_ALIGNMENT): rounds a size up to the next multiple.
inline UINT CalculateConstantBufferByteSize(UINT byteSize)
{
    return (byteSize + (D3D12_CONSTANT_BUFFER_DATA_PLACEMENT_ALIGNMENT - 1)) & ~(D3D12_CONSTANT_BUFFER_DATA_PLACEMENT_ALIGNMENT - 1);
}

// The camera: where it is, the direction it looks in, and which way is up. Globals,
// so that OnUpdate and the window's message handler can both use them.
XMVECTOR cameraPos   = XMVectorSet(0.0f, 0.0f,  3.0f, 0.0f);
XMVECTOR cameraFront = XMVectorSet(0.0f, 0.0f, -1.0f, 0.0f);
XMVECTOR cameraUp    = XMVectorSet(0.0f, 1.0f,  0.0f, 0.0f);

// Which keys are held down, by virtual-key code ('W', VK_UP ...). WindowProc keeps it up to date.
bool keys[256] = {};

// Mouse look: the camera's direction as two angles, in degrees.
bool firstMouse = true;
float yaw   = -90.0f;    // yaw is initialized to -90.0 degrees since a yaw of 0.0 results in a direction vector pointing to the right so we initially rotate a bit to the left.
float pitch =  0.0f;
float lastX =  800.0f / 2.0f;
float lastY =  600.0f / 2.0f;

// Zoom: the field of view, in degrees.
float fov   =  45.0f;

// The most bones that move one vertex.
#define MAX_BONE_INFLUENCE 4

// A vertex of a mesh: the layout of the vertex buffer, which the input layout describes
// (POSITION at byte 0, NORMAL at byte 12, TEXCOORD at byte 24, BLENDINDICES at byte 32,
// BLENDWEIGHT at byte 48).
struct Vertex
{
    // position
    XMFLOAT3 position;
    // normal
    XMFLOAT3 normal;
    // texCoords
    XMFLOAT2 texCoord;
    // bone indexes which will influence this vertex
    int m_BoneIDs[MAX_BONE_INFLUENCE];
    // weights from each bone
    float m_Weights[MAX_BONE_INFLUENCE];
};

// A texture of a mesh: the image in GPU memory, what it is used for and the file it came from.
struct Texture
{
    ComPtr<ID3D12Resource> resource;    // the texture (learnopengl's texture id)
    std::string type;                   // "texture_diffuse" or "texture_specular"
    std::string path;                   // the file name, as the material names it
};

class Mesh
{
public:
    // mesh Data
    std::vector<Vertex>  vertices;
    std::vector<UINT>    indices;
    std::vector<Texture> textures;

    // constructor: srvCpuHandle and srvGpuHandle are the mesh's two slots in the CBV/SRV
    // heap (where the CPU writes its texture views, and where the GPU reads them).
    Mesh(std::vector<Vertex> vertices, std::vector<UINT> indices, std::vector<Texture> textures,
        ID3D12Device* device, CD3DX12_CPU_DESCRIPTOR_HANDLE srvCpuHandle, CD3DX12_GPU_DESCRIPTOR_HANDLE srvGpuHandle)
    {
        this->vertices = vertices;
        this->indices = indices;
        this->textures = textures;
        m_srvHandle = srvGpuHandle;

        // now that we have all the required data, create the buffers and the views.
        SetupMesh(device, srvCpuHandle);
    }

    // render the mesh
    void Draw(ID3D12GraphicsCommandList* commandList)
    {
        // bind the mesh's textures: root parameter 2 is the descriptor table of the
        // pixel shader's textures (t0 = texture_diffuse1, t1 = texture_specular1)
        commandList->SetGraphicsRootDescriptorTable(2, m_srvHandle);

        // draw mesh
        commandList->IASetVertexBuffers(0, 1, &m_vertexBufferView);
        commandList->IASetIndexBuffer(&m_indexBufferView);
        commandList->DrawIndexedInstanced(static_cast<UINT>(indices.size()), 1, 0, 0, 0);
    }

private:
    // render data
    ComPtr<ID3D12Resource> m_vertexBuffer;
    ComPtr<ID3D12Resource> m_indexBuffer;
    D3D12_VERTEX_BUFFER_VIEW m_vertexBufferView = {};
    D3D12_INDEX_BUFFER_VIEW m_indexBufferView = {};
    D3D12_GPU_DESCRIPTOR_HANDLE m_srvHandle = {};    // the first of the mesh's two SRVs

    // initializes all the buffers and views
    void SetupMesh(ID3D12Device* device, CD3DX12_CPU_DESCRIPTOR_HANDLE srvHandle)
    {
        // Upload heaps, as for the cube before: simple, and fine for a small model.
        CD3DX12_HEAP_PROPERTIES heapProperties(D3D12_HEAP_TYPE_UPLOAD);
        CD3DX12_RANGE readRange(0, 0);        // We do not intend to read from these resources on the CPU.

        // Create the vertex buffer and copy the vertices into it. A great thing about structs
        // is that their memory layout is sequential for all its items: the vector's data is
        // exactly the bytes the input layout describes.
        const UINT vertexBufferSize = static_cast<UINT>(vertices.size() * sizeof(Vertex));
        CD3DX12_RESOURCE_DESC vertexBufferDesc = CD3DX12_RESOURCE_DESC::Buffer(vertexBufferSize);
        ThrowIfFailed(device->CreateCommittedResource(
            &heapProperties,
            D3D12_HEAP_FLAG_NONE,
            &vertexBufferDesc,
            D3D12_RESOURCE_STATE_GENERIC_READ,
            nullptr,
            IID_PPV_ARGS(&m_vertexBuffer)));

        UINT8* pVertexDataBegin = nullptr;
        ThrowIfFailed(m_vertexBuffer->Map(0, &readRange, reinterpret_cast<void**>(&pVertexDataBegin)));
        memcpy(pVertexDataBegin, vertices.data(), vertexBufferSize);
        m_vertexBuffer->Unmap(0, nullptr);

        // Initialize the vertex buffer view.
        m_vertexBufferView.BufferLocation = m_vertexBuffer->GetGPUVirtualAddress();
        m_vertexBufferView.StrideInBytes = sizeof(Vertex);
        m_vertexBufferView.SizeInBytes = vertexBufferSize;

        // Create the index buffer and copy the indices into it: 32-bit unsigned integers.
        const UINT indexBufferSize = static_cast<UINT>(indices.size() * sizeof(UINT));
        CD3DX12_RESOURCE_DESC indexBufferDesc = CD3DX12_RESOURCE_DESC::Buffer(indexBufferSize);
        ThrowIfFailed(device->CreateCommittedResource(
            &heapProperties,
            D3D12_HEAP_FLAG_NONE,
            &indexBufferDesc,
            D3D12_RESOURCE_STATE_GENERIC_READ,
            nullptr,
            IID_PPV_ARGS(&m_indexBuffer)));

        UINT8* pIndexDataBegin = nullptr;
        ThrowIfFailed(m_indexBuffer->Map(0, &readRange, reinterpret_cast<void**>(&pIndexDataBegin)));
        memcpy(pIndexDataBegin, indices.data(), indexBufferSize);
        m_indexBuffer->Unmap(0, nullptr);

        // Initialize the index buffer view.
        m_indexBufferView.BufferLocation = m_indexBuffer->GetGPUVirtualAddress();
        m_indexBufferView.Format = DXGI_FORMAT_R32_UINT;
        m_indexBufferView.SizeInBytes = indexBufferSize;

        // The texture views: by the naming convention, the mesh's first diffuse texture goes
        // into its first slot (t0, texture_diffuse1) and its first specular texture into the
        // second (t1, texture_specular1). A slot without a texture gets a null view (the
        // shader reads black from it).
        const char* slotTypes[] = { "texture_diffuse", "texture_specular" };
        for (UINT slot = 0; slot < _countof(slotTypes); slot++)
        {
            ID3D12Resource* resource = nullptr;
            for (UINT i = 0; i < textures.size(); i++)
            {
                if (textures[i].type == slotTypes[slot])
                {
                    resource = textures[i].resource.Get();
                    break;
                }
            }

            D3D12_SHADER_RESOURCE_VIEW_DESC srvDesc = {};
            srvDesc.Shader4ComponentMapping = D3D12_DEFAULT_SHADER_4_COMPONENT_MAPPING;
            srvDesc.Format = DXGI_FORMAT_R8G8B8A8_UNORM;
            srvDesc.ViewDimension = D3D12_SRV_DIMENSION_TEXTURE2D;
            srvDesc.Texture2D.MipLevels = 1;
            device->CreateShaderResourceView(resource, &srvDesc, srvHandle);
            srvHandle.Offset(1, device->GetDescriptorHandleIncrementSize(D3D12_DESCRIPTOR_HEAP_TYPE_CBV_SRV_UAV));
        }
    }
};

// assimp's matrices are row-major with the translation in the last column (a4, b4, c4) - for
// column vectors, like OpenGL's. DirectXMath multiplies row vectors (the translation in the last
// row): the same transformation is the transposed matrix (learnopengl's AssimpGLMHelpers).
inline XMFLOAT4X4 ConvertMatrixToXMFormat(const aiMatrix4x4& from)
{
    return XMFLOAT4X4(
        from.a1, from.b1, from.c1, from.d1,
        from.a2, from.b2, from.c2, from.d2,
        from.a3, from.b3, from.c3, from.d3,
        from.a4, from.b4, from.c4, from.d4);
}

inline XMFLOAT3 GetXMVec(const aiVector3D& vec)
{
    return XMFLOAT3(vec.x, vec.y, vec.z);
}

// XMFLOAT4 holds a quaternion as x, y, z, w (glm::quat's constructor takes w first)
inline XMFLOAT4 GetXMQuat(const aiQuaternion& pOrientation)
{
    return XMFLOAT4(pOrientation.x, pOrientation.y, pOrientation.z, pOrientation.w);
}

// a bone of the model: its index in the final bone matrices and its offset matrix
struct BoneInfo
{
    // id is index in finalBoneMatrices
    int id;

    // offset matrix transforms vertex from model space to bone space
    XMFLOAT4X4 offset;
};

ComPtr<ID3D12Resource> TextureFromFile(const char* path, const std::string& directory, ID3D12Device* device, ID3D12GraphicsCommandList* commandList, ComPtr<ID3D12Resource>& uploadHeap);

class Model
{
public:
    // model data
    std::vector<Texture> textures_loaded;    // stores all the textures loaded so far, optimization to make sure textures aren't loaded more than once.
    std::vector<Mesh>    meshes;
    std::string directory;

    // The textures' upload buffers: the copies recorded in the command list read from them,
    // so they must stay alive until it has executed.
    std::vector<ComPtr<ID3D12Resource>> uploadHeaps;

    // Loads a model from a file (learnopengl's constructor). The textures' copies are recorded
    // in commandList; the meshes' texture views go into srvHeap from slot firstDescriptor on.
    void Load(std::string const& path, ID3D12Device* device, ID3D12GraphicsCommandList* commandList, ID3D12DescriptorHeap* srvHeap, UINT firstDescriptor)
    {
        m_device = device;
        m_commandList = commandList;
        m_srvHeap = srvHeap;
        m_nextDescriptor = firstDescriptor;
        loadModel(path);
    }

    // draws the model, and thus all its meshes
    void Draw(ID3D12GraphicsCommandList* commandList)
    {
        for (UINT i = 0; i < meshes.size(); i++)
            meshes[i].Draw(commandList);
    }

    std::map<std::string, BoneInfo>& GetBoneInfoMap() { return m_BoneInfoMap; }
    int& GetBoneCount() { return m_BoneCounter; }

private:
    std::map<std::string, BoneInfo> m_BoneInfoMap;    // the bones by name
    int m_BoneCounter = 0;                            // the number of bones found so far (the next bone's id)

    // What loading needs from the program (set by Load).
    ID3D12Device* m_device = nullptr;
    ID3D12GraphicsCommandList* m_commandList = nullptr;
    ID3D12DescriptorHeap* m_srvHeap = nullptr;
    UINT m_nextDescriptor = 0;    // the next free slot of the CBV/SRV heap

    // loads a model with supported ASSIMP extensions from file and stores the resulting meshes in the meshes vector.
    void loadModel(std::string const& path)
    {
        // read file via ASSIMP (aiProcess_FlipUVs: assimp turns texture coordinates to OpenGL's
        // v-up convention; flipped back, v = 0 is the image's top row, as Direct3D samples it)
        Assimp::Importer importer;
        const aiScene* scene = importer.ReadFile(path, aiProcess_Triangulate | aiProcess_GenSmoothNormals | aiProcess_FlipUVs | aiProcess_CalcTangentSpace);
        // check for errors
        if (!scene || scene->mFlags & AI_SCENE_FLAGS_INCOMPLETE || !scene->mRootNode) // if is Not Zero
        {
            throw std::runtime_error(std::string("ERROR::ASSIMP:: ") + importer.GetErrorString());
        }
        // retrieve the directory path of the filepath
        directory = path.substr(0, path.find_last_of('/'));

        // process ASSIMP's root node recursively
        processNode(scene->mRootNode, scene);
    }

    // processes a node in a recursive fashion. Processes each individual mesh located at the node and repeats this process on its children nodes (if any).
    void processNode(aiNode* node, const aiScene* scene)
    {
        // process each mesh located at the current node
        for (UINT i = 0; i < node->mNumMeshes; i++)
        {
            // the node object only contains indices to index the actual objects in the scene.
            // the scene contains all the data, node is just to keep stuff organized (like relations between nodes).
            aiMesh* mesh = scene->mMeshes[node->mMeshes[i]];
            meshes.push_back(processMesh(mesh, scene));
        }
        // after we've processed all of the meshes (if any) we then recursively process each of the children nodes
        for (UINT i = 0; i < node->mNumChildren; i++)
        {
            processNode(node->mChildren[i], scene);
        }
    }

    Mesh processMesh(aiMesh* mesh, const aiScene* scene)
    {
        // data to fill
        std::vector<Vertex> vertices;
        std::vector<UINT> indices;
        std::vector<Texture> textures;

        // walk through each of the mesh's vertices
        for (UINT i = 0; i < mesh->mNumVertices; i++)
        {
            Vertex vertex;
            SetVertexBoneDataToDefault(vertex);
            // positions
            vertex.position = XMFLOAT3(mesh->mVertices[i].x, mesh->mVertices[i].y, mesh->mVertices[i].z);
            // normals
            if (mesh->HasNormals())
                vertex.normal = XMFLOAT3(mesh->mNormals[i].x, mesh->mNormals[i].y, mesh->mNormals[i].z);
            else
                vertex.normal = XMFLOAT3(0.0f, 0.0f, 0.0f);
            // texture coordinates
            if (mesh->mTextureCoords[0]) // does the mesh contain texture coordinates?
            {
                // a vertex can contain up to 8 different texture coordinates. We thus make the assumption that we won't
                // use models where a vertex can have multiple texture coordinates so we always take the first set (0).
                vertex.texCoord = XMFLOAT2(mesh->mTextureCoords[0][i].x, mesh->mTextureCoords[0][i].y);
            }
            else
                vertex.texCoord = XMFLOAT2(0.0f, 0.0f);

            vertices.push_back(vertex);
        }
        // now walk through each of the mesh's faces (a face is a mesh its triangle) and retrieve the corresponding vertex indices.
        for (UINT i = 0; i < mesh->mNumFaces; i++)
        {
            aiFace face = mesh->mFaces[i];
            // retrieve all indices of the face and store them in the indices vector
            for (UINT j = 0; j < face.mNumIndices; j++)
                indices.push_back(face.mIndices[j]);
        }
        // process materials
        aiMaterial* material = scene->mMaterials[mesh->mMaterialIndex];
        // we assume a convention for the textures in the shaders: the first diffuse texture
        // is texture_diffuse1 (register t0), the first specular texture texture_specular1 (t1).

        // 1. diffuse maps
        std::vector<Texture> diffuseMaps = loadMaterialTextures(material, aiTextureType_DIFFUSE, "texture_diffuse");
        textures.insert(textures.end(), diffuseMaps.begin(), diffuseMaps.end());
        // 2. specular maps
        std::vector<Texture> specularMaps = loadMaterialTextures(material, aiTextureType_SPECULAR, "texture_specular");
        textures.insert(textures.end(), specularMaps.begin(), specularMaps.end());

        // the bones that move each vertex, and how much
        ExtractBoneWeightForVertices(vertices, mesh, scene);

        // The mesh's two texture views go into the next two free slots of the CBV/SRV heap.
        if (m_nextDescriptor + 2 > m_srvHeap->GetDesc().NumDescriptors)
        {
            throw std::runtime_error("The CBV/SRV heap has no room for another mesh");
        }
        UINT descriptorSize = m_device->GetDescriptorHandleIncrementSize(D3D12_DESCRIPTOR_HEAP_TYPE_CBV_SRV_UAV);
        CD3DX12_CPU_DESCRIPTOR_HANDLE srvCpuHandle(m_srvHeap->GetCPUDescriptorHandleForHeapStart(), m_nextDescriptor, descriptorSize);
        CD3DX12_GPU_DESCRIPTOR_HANDLE srvGpuHandle(m_srvHeap->GetGPUDescriptorHandleForHeapStart(), m_nextDescriptor, descriptorSize);
        m_nextDescriptor += 2;

        // return a mesh object created from the extracted mesh data
        return Mesh(vertices, indices, textures, m_device, srvCpuHandle, srvGpuHandle);
    }

    // no bones yet: id -1 (no bone), weight 0
    void SetVertexBoneDataToDefault(Vertex& vertex)
    {
        for (int i = 0; i < MAX_BONE_INFLUENCE; i++)
        {
            vertex.m_BoneIDs[i] = -1;
            vertex.m_Weights[i] = 0.0f;
        }
    }

    // put the bone and its weight into the vertex's first free slot (at most MAX_BONE_INFLUENCE bones per vertex)
    void SetVertexBoneData(Vertex& vertex, int boneID, float weight)
    {
        for (int i = 0; i < MAX_BONE_INFLUENCE; ++i)
        {
            if (vertex.m_BoneIDs[i] < 0)
            {
                vertex.m_Weights[i] = weight;
                vertex.m_BoneIDs[i] = boneID;
                break;
            }
        }
    }

    // assimp stores the weights per bone (aiBone: its vertices and weights); a shader needs them per vertex
    void ExtractBoneWeightForVertices(std::vector<Vertex>& vertices, aiMesh* mesh, const aiScene* scene)
    {
        auto& boneInfoMap = m_BoneInfoMap;
        int& boneCount = m_BoneCounter;

        for (UINT boneIndex = 0; boneIndex < mesh->mNumBones; ++boneIndex)
        {
            int boneID = -1;
            std::string boneName = mesh->mBones[boneIndex]->mName.C_Str();
            if (boneInfoMap.find(boneName) == boneInfoMap.end())
            {
                // a new bone: the next id, and its offset matrix
                BoneInfo newBoneInfo;
                newBoneInfo.id = boneCount;
                newBoneInfo.offset = ConvertMatrixToXMFormat(mesh->mBones[boneIndex]->mOffsetMatrix);
                boneInfoMap[boneName] = newBoneInfo;
                boneID = boneCount;
                boneCount++;
            }
            else
            {
                boneID = boneInfoMap[boneName].id;
            }
            auto weights = mesh->mBones[boneIndex]->mWeights;
            int numWeights = mesh->mBones[boneIndex]->mNumWeights;

            for (int weightIndex = 0; weightIndex < numWeights; ++weightIndex)
            {
                int vertexId = weights[weightIndex].mVertexId;
                float weight = weights[weightIndex].mWeight;
                SetVertexBoneData(vertices[vertexId], boneID, weight);
            }
        }
    }

    // checks all material textures of a given type and loads the textures if they're not loaded yet.
    // the required info is returned as a Texture struct.
    std::vector<Texture> loadMaterialTextures(aiMaterial* mat, aiTextureType type, std::string typeName)
    {
        std::vector<Texture> textures;
        for (UINT i = 0; i < mat->GetTextureCount(type); i++)
        {
            aiString str;
            mat->GetTexture(type, i, &str);
            // check if texture was loaded before and if so, continue to next iteration: skip loading a new texture
            bool skip = false;
            for (UINT j = 0; j < textures_loaded.size(); j++)
            {
                if (std::strcmp(textures_loaded[j].path.data(), str.C_Str()) == 0)
                {
                    textures.push_back(textures_loaded[j]);
                    skip = true; // a texture with the same filepath has already been loaded, continue to next one. (optimization)
                    break;
                }
            }
            if (!skip)
            {   // if texture hasn't been loaded already, load it
                Texture texture;
                ComPtr<ID3D12Resource> uploadHeap;
                texture.resource = TextureFromFile(str.C_Str(), directory, m_device, m_commandList, uploadHeap);
                texture.type = typeName;
                texture.path = str.C_Str();
                textures.push_back(texture);
                textures_loaded.push_back(texture);  // store it as texture loaded for entire model, to ensure we won't unnecessary load duplicate textures.
                uploadHeaps.push_back(uploadHeap);
            }
        }
        return textures;
    }
};

// Loads an image file next to the model into a new texture: creates the texture in a default
// heap and records the copy of the pixels into it in the command list (the earlier chapters'
// LoadTexture, without the view: the meshes make their own). The copy reads from uploadHeap,
// so that must stay alive until the command list has executed.
ComPtr<ID3D12Resource> TextureFromFile(const char* path, const std::string& directory, ID3D12Device* device, ID3D12GraphicsCommandList* commandList, ComPtr<ID3D12Resource>& uploadHeap)
{
    // the file is next to the model
    std::string filename = directory + '/' + std::string(path);

    // Load the image as RGBA (4 channels), the layout of DXGI_FORMAT_R8G8B8A8_UNORM.
    // No vertical flip: in Direct3D, texture coordinate v = 0 is the image's top row
    // (aiProcess_FlipUVs turned the model's v around to match).
    int width, height, nrComponents;
    unsigned char* data = stbi_load(filename.c_str(), &width, &height, &nrComponents, 4);
    if (data == nullptr)
    {
        throw std::runtime_error("Texture failed to load at path: " + filename);
    }

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

    ComPtr<ID3D12Resource> texture;
    CD3DX12_HEAP_PROPERTIES heapProperties(D3D12_HEAP_TYPE_DEFAULT);
    ThrowIfFailed(device->CreateCommittedResource(
        &heapProperties,
        D3D12_HEAP_FLAG_NONE,
        &textureDesc,
        D3D12_RESOURCE_STATE_COPY_DEST,
        nullptr,
        IID_PPV_ARGS(&texture)));

    // The upload heap: a buffer in memory the CPU can write, big enough for the
    // texture's rows as the GPU lays them out (GetRequiredIntermediateSize).
    const UINT64 uploadBufferSize = GetRequiredIntermediateSize(texture.Get(), 0, 1);

    CD3DX12_HEAP_PROPERTIES uploadHeapProperties(D3D12_HEAP_TYPE_UPLOAD);
    CD3DX12_RESOURCE_DESC uploadBufferDesc = CD3DX12_RESOURCE_DESC::Buffer(uploadBufferSize);
    ThrowIfFailed(device->CreateCommittedResource(
        &uploadHeapProperties,
        D3D12_HEAP_FLAG_NONE,
        &uploadBufferDesc,
        D3D12_RESOURCE_STATE_GENERIC_READ,
        nullptr,
        IID_PPV_ARGS(&uploadHeap)));

    // Copy data to the intermediate upload heap (now, on the CPU) and schedule a copy
    // from the upload heap to the Texture2D (when the command list executes).
    D3D12_SUBRESOURCE_DATA textureData = {};
    textureData.pData = data;
    textureData.RowPitch = width * 4;                          // bytes per row: 4 per pixel
    textureData.SlicePitch = textureData.RowPitch * height;    // bytes in the whole image

    UpdateSubresources(commandList, texture.Get(), uploadHeap.Get(), 0, 0, 1, &textureData);

    // After the copy, the texture is read by the pixel shader.
    CD3DX12_RESOURCE_BARRIER barrier = CD3DX12_RESOURCE_BARRIER::Transition(texture.Get(), D3D12_RESOURCE_STATE_COPY_DEST, D3D12_RESOURCE_STATE_PIXEL_SHADER_RESOURCE);
    commandList->ResourceBarrier(1, &barrier);

    // Free the image memory.
    stbi_image_free(data);

    return texture;
}


// -------------------------------------------------------------------------------------------
// Bone: one bone's keyframes, and its local transform at the animation's current time
// (learnopengl's Bone class, written as a struct with free functions)
// -------------------------------------------------------------------------------------------
struct KeyPosition
{
    XMFLOAT3 position;
    float timeStamp;
};

struct KeyRotation
{
    XMFLOAT4 orientation;    // a quaternion
    float timeStamp;
};

struct KeyScale
{
    XMFLOAT3 scale;
    float timeStamp;
};

struct Bone
{
    std::vector<KeyPosition> m_Positions;
    std::vector<KeyRotation> m_Rotations;
    std::vector<KeyScale> m_Scales;
    int m_NumPositions;
    int m_NumRotations;
    int m_NumScalings;

    XMFLOAT4X4 m_LocalTransform;
    std::string m_Name;
    int m_ID;
};

// reads the keyframes of one animation channel (aiNodeAnim) into a Bone
Bone CreateBone(const std::string& name, int ID, const aiNodeAnim* channel)
{
    Bone bone;
    bone.m_Name = name;
    bone.m_ID = ID;
    XMStoreFloat4x4(&bone.m_LocalTransform, XMMatrixIdentity());

    bone.m_NumPositions = channel->mNumPositionKeys;
    for (int positionIndex = 0; positionIndex < bone.m_NumPositions; ++positionIndex)
    {
        aiVector3D aiPosition = channel->mPositionKeys[positionIndex].mValue;
        float timeStamp = static_cast<float>(channel->mPositionKeys[positionIndex].mTime);
        KeyPosition data;
        data.position = GetXMVec(aiPosition);
        data.timeStamp = timeStamp;
        bone.m_Positions.push_back(data);
    }

    bone.m_NumRotations = channel->mNumRotationKeys;
    for (int rotationIndex = 0; rotationIndex < bone.m_NumRotations; ++rotationIndex)
    {
        aiQuaternion aiOrientation = channel->mRotationKeys[rotationIndex].mValue;
        float timeStamp = static_cast<float>(channel->mRotationKeys[rotationIndex].mTime);
        KeyRotation data;
        data.orientation = GetXMQuat(aiOrientation);
        data.timeStamp = timeStamp;
        bone.m_Rotations.push_back(data);
    }

    bone.m_NumScalings = channel->mNumScalingKeys;
    for (int keyIndex = 0; keyIndex < bone.m_NumScalings; ++keyIndex)
    {
        aiVector3D scale = channel->mScalingKeys[keyIndex].mValue;
        float timeStamp = static_cast<float>(channel->mScalingKeys[keyIndex].mTime);
        KeyScale data;
        data.scale = GetXMVec(scale);
        data.timeStamp = timeStamp;
        bone.m_Scales.push_back(data);
    }
    return bone;
}

// the index of the key before animationTime (the key after it is index + 1)
int GetPositionIndex(const Bone& bone, float animationTime)
{
    for (int index = 0; index < bone.m_NumPositions - 1; ++index)
    {
        if (animationTime < bone.m_Positions[index + 1].timeStamp)
            return index;
    }
    return bone.m_NumPositions - 2;    // not reached: the animation's time stays below its duration
}

int GetRotationIndex(const Bone& bone, float animationTime)
{
    for (int index = 0; index < bone.m_NumRotations - 1; ++index)
    {
        if (animationTime < bone.m_Rotations[index + 1].timeStamp)
            return index;
    }
    return bone.m_NumRotations - 2;
}

int GetScaleIndex(const Bone& bone, float animationTime)
{
    for (int index = 0; index < bone.m_NumScalings - 1; ++index)
    {
        if (animationTime < bone.m_Scales[index + 1].timeStamp)
            return index;
    }
    return bone.m_NumScalings - 2;
}

// how far animationTime is from the last key to the next one: 0 at the last key, 1 at the next
float GetScaleFactor(float lastTimeStamp, float nextTimeStamp, float animationTime)
{
    float scaleFactor = 0.0f;
    float midWayLength = animationTime - lastTimeStamp;
    float framesDiff = nextTimeStamp - lastTimeStamp;
    scaleFactor = midWayLength / framesDiff;
    return scaleFactor;
}

// positions: linear interpolation (XMVectorLerp, GLSL's mix) between the two keys around animationTime
XMMATRIX InterpolatePosition(const Bone& bone, float animationTime)
{
    if (1 == bone.m_NumPositions)
        return XMMatrixTranslationFromVector(XMLoadFloat3(&bone.m_Positions[0].position));

    int p0Index = GetPositionIndex(bone, animationTime);
    int p1Index = p0Index + 1;
    float scaleFactor = GetScaleFactor(bone.m_Positions[p0Index].timeStamp,
        bone.m_Positions[p1Index].timeStamp, animationTime);
    XMVECTOR finalPosition = XMVectorLerp(XMLoadFloat3(&bone.m_Positions[p0Index].position), XMLoadFloat3(&bone.m_Positions[p1Index].position),
        scaleFactor);
    return XMMatrixTranslationFromVector(finalPosition);
}

// rotations: spherical linear interpolation (slerp) between the two quaternions
XMMATRIX InterpolateRotation(const Bone& bone, float animationTime)
{
    if (1 == bone.m_NumRotations)
    {
        XMVECTOR rotation = XMQuaternionNormalize(XMLoadFloat4(&bone.m_Rotations[0].orientation));
        return XMMatrixRotationQuaternion(rotation);
    }

    int p0Index = GetRotationIndex(bone, animationTime);
    int p1Index = p0Index + 1;
    float scaleFactor = GetScaleFactor(bone.m_Rotations[p0Index].timeStamp,
        bone.m_Rotations[p1Index].timeStamp, animationTime);
    XMVECTOR finalRotation = XMQuaternionSlerp(XMLoadFloat4(&bone.m_Rotations[p0Index].orientation), XMLoadFloat4(&bone.m_Rotations[p1Index].orientation),
        scaleFactor);
    finalRotation = XMQuaternionNormalize(finalRotation);
    return XMMatrixRotationQuaternion(finalRotation);
}

// scales: linear interpolation like the positions
XMMATRIX InterpolateScaling(const Bone& bone, float animationTime)
{
    if (1 == bone.m_NumScalings)
        return XMMatrixScalingFromVector(XMLoadFloat3(&bone.m_Scales[0].scale));

    int p0Index = GetScaleIndex(bone, animationTime);
    int p1Index = p0Index + 1;
    float scaleFactor = GetScaleFactor(bone.m_Scales[p0Index].timeStamp,
        bone.m_Scales[p1Index].timeStamp, animationTime);
    XMVECTOR finalScale = XMVectorLerp(XMLoadFloat3(&bone.m_Scales[p0Index].scale), XMLoadFloat3(&bone.m_Scales[p1Index].scale),
        scaleFactor);
    return XMMatrixScalingFromVector(finalScale);
}

// the bone's local transform at animationTime: learnopengl's translation * rotation * scale -
// with DirectXMath's row vectors the matrices apply from left to right: scale * rotation * translation
void UpdateBone(Bone& bone, float animationTime)
{
    XMMATRIX translation = InterpolatePosition(bone, animationTime);
    XMMATRIX rotation = InterpolateRotation(bone, animationTime);
    XMMATRIX scale = InterpolateScaling(bone, animationTime);
    XMStoreFloat4x4(&bone.m_LocalTransform, scale * rotation * translation);
}

// -------------------------------------------------------------------------------------------
// Animation: the bones' keyframes and the node hierarchy of the file (learnopengl's Animation class)
// -------------------------------------------------------------------------------------------
struct AssimpNodeData
{
    XMFLOAT4X4 transformation;
    std::string name;
    int childrenCount;
    std::vector<AssimpNodeData> children;
};

struct Animation
{
    float m_Duration;
    int m_TicksPerSecond;
    std::vector<Bone> m_Bones;
    AssimpNodeData m_RootNode;
    std::map<std::string, BoneInfo> m_BoneInfoMap;
};

// copies assimp's node tree (names, transformations, children) into our own AssimpNodeData tree
void ReadHierarchyData(AssimpNodeData& dest, const aiNode* src)
{
    dest.name = src->mName.data;
    dest.transformation = ConvertMatrixToXMFormat(src->mTransformation);
    dest.childrenCount = src->mNumChildren;

    for (UINT i = 0; i < src->mNumChildren; i++)
    {
        AssimpNodeData newData;
        ReadHierarchyData(newData, src->mChildren[i]);
        dest.children.push_back(newData);
    }
}

// one Bone per animation channel; a bone the mesh does not use (no weights) gets a new id too
void ReadMissingBones(Animation& animation, const aiAnimation* aiAnim, Model& model)
{
    int size = aiAnim->mNumChannels;

    auto& boneInfoMap = model.GetBoneInfoMap();    // getting m_BoneInfoMap from Model class
    int& boneCount = model.GetBoneCount();         // getting the m_BoneCounter from Model class

    // reading channels (bones engaged in an animation and their keyframes)
    for (int i = 0; i < size; i++)
    {
        auto channel = aiAnim->mChannels[i];
        std::string boneName = channel->mNodeName.data;

        if (boneInfoMap.find(boneName) == boneInfoMap.end())
        {
            boneInfoMap[boneName].id = boneCount;
            boneCount++;
        }
        animation.m_Bones.push_back(CreateBone(channel->mNodeName.data,
            boneInfoMap[channel->mNodeName.data].id, channel));
    }

    animation.m_BoneInfoMap = boneInfoMap;
}

// loads the file's first animation (the same file as the model)
void LoadAnimation(Animation& animation, const std::string& animationPath, Model& model)
{
    Assimp::Importer importer;
    const aiScene* scene = importer.ReadFile(animationPath, aiProcess_Triangulate);
    if (!scene || !scene->mRootNode || scene->mNumAnimations == 0)
    {
        throw std::runtime_error("ERROR::ASSIMP:: no animation in " + animationPath);
    }
    auto aiAnim = scene->mAnimations[0];
    animation.m_Duration = static_cast<float>(aiAnim->mDuration);
    animation.m_TicksPerSecond = static_cast<int>(aiAnim->mTicksPerSecond);
    ReadHierarchyData(animation.m_RootNode, scene->mRootNode);
    ReadMissingBones(animation, aiAnim, model);
}

// the animated bone with this name, or nullptr when the node is not animated
Bone* FindBone(Animation& animation, const std::string& name)
{
    for (Bone& bone : animation.m_Bones)
    {
        if (bone.m_Name == name)
            return &bone;
    }
    return nullptr;
}

// -------------------------------------------------------------------------------------------
// Animator: plays an animation and computes the final bone matrices (learnopengl's Animator class)
// -------------------------------------------------------------------------------------------
struct Animator
{
    std::vector<XMFLOAT4X4> m_FinalBoneMatrices;
    Animation* m_CurrentAnimation;
    float m_CurrentTime;
    float m_DeltaTime;
};

void InitAnimator(Animator& animator, Animation* animation)
{
    animator.m_CurrentTime = 0.0f;
    animator.m_CurrentAnimation = animation;

    animator.m_FinalBoneMatrices.reserve(100);

    XMFLOAT4X4 identity;
    XMStoreFloat4x4(&identity, XMMatrixIdentity());
    for (int i = 0; i < 100; i++)
        animator.m_FinalBoneMatrices.push_back(identity);
}

// walks the node tree from the root: every node's global transform is its own transform (the
// bone's interpolated transform when the node is animated), then its parent's - learnopengl's
// parentTransform * nodeTransform with column vectors; a bone's final matrix = its offset
// matrix, then the global transform (learnopengl's globalTransformation * offset)
void CalculateBoneTransform(Animator& animator, const AssimpNodeData* node, const XMMATRIX& parentTransform)
{
    std::string nodeName = node->name;
    XMMATRIX nodeTransform = XMLoadFloat4x4(&node->transformation);

    Bone* bone = FindBone(*animator.m_CurrentAnimation, nodeName);

    if (bone)
    {
        UpdateBone(*bone, animator.m_CurrentTime);
        nodeTransform = XMLoadFloat4x4(&bone->m_LocalTransform);
    }

    XMMATRIX globalTransformation = nodeTransform * parentTransform;

    auto& boneInfoMap = animator.m_CurrentAnimation->m_BoneInfoMap;
    if (boneInfoMap.find(nodeName) != boneInfoMap.end())
    {
        int index = boneInfoMap[nodeName].id;
        XMMATRIX offset = XMLoadFloat4x4(&boneInfoMap[nodeName].offset);
        XMStoreFloat4x4(&animator.m_FinalBoneMatrices[index], offset * globalTransformation);
    }

    for (int i = 0; i < node->childrenCount; i++)
        CalculateBoneTransform(animator, &node->children[i], globalTransformation);
}

// advances the animation by dt seconds (in the file's ticks, looping) and recomputes the bone matrices
void UpdateAnimation(Animator& animator, float dt)
{
    animator.m_DeltaTime = dt;
    if (animator.m_CurrentAnimation)
    {
        animator.m_CurrentTime += animator.m_CurrentAnimation->m_TicksPerSecond * dt;
        animator.m_CurrentTime = fmod(animator.m_CurrentTime, animator.m_CurrentAnimation->m_Duration);
        CalculateBoneTransform(animator, &animator.m_CurrentAnimation->m_RootNode, XMMatrixIdentity());
    }
}

// The root constants: what the vertex shader sees as cbuffer ModelConstants. A 4x4 matrix is
// 16 floats: 16 32-bit root constants.
struct ModelConstants
{
    XMFLOAT4X4 model;
};

// The most bones the shader takes.
const int MAX_BONES = 100;

class D3D12App
{
public:
    D3D12App(UINT width, UINT height);

    void OnInit(HWND hwnd);
    void OnUpdate();
    void OnRender();
    void OnDestroy();

private:
    static const UINT FrameCount = 2;

    // The most meshes a model can have here: each one takes two descriptors of the
    // CBV/SRV heap (the SRVs of its diffuse and specular maps).
    static const UINT MaxMeshes = 8;

    // The constant buffer: what the shaders see as cbuffer SceneConstantBuffer - the view and
    // projection matrices and the bones' final matrices (100 x 64 bytes).
    struct SceneConstantBuffer
    {
        XMFLOAT4X4 view;
        XMFLOAT4X4 projection;
        XMFLOAT4X4 finalBonesMatrices[MAX_BONES];
    };

    UINT m_width;
    UINT m_height;
    HWND m_hwnd = nullptr;

    // Pipeline objects.
    CD3DX12_VIEWPORT m_viewport;
    CD3DX12_RECT m_scissorRect;
    ComPtr<IDXGISwapChain3> m_swapChain;
    ComPtr<ID3D12Device> m_device;
    ComPtr<ID3D12Resource> m_renderTargets[FrameCount];
    ComPtr<ID3D12CommandAllocator> m_commandAllocator;
    ComPtr<ID3D12CommandQueue> m_commandQueue;
    ComPtr<ID3D12RootSignature> m_rootSignature;
    ComPtr<ID3D12DescriptorHeap> m_rtvHeap;
    ComPtr<ID3D12DescriptorHeap> m_dsvHeap;
    ComPtr<ID3D12DescriptorHeap> m_cbvSrvHeap;
    ComPtr<ID3D12PipelineState> m_pipelineState;
    ComPtr<ID3D12GraphicsCommandList> m_commandList;
    UINT m_rtvDescriptorSize = 0;
    UINT m_cbvSrvDescriptorSize = 0;

    // App resources.
    Model m_model;    // the model: its meshes and their textures
    Animation m_swayAnimation;    // the model's animation: its bones' keyframes
    Animator m_animator;          // plays the animation: the bones' final matrices
    ComPtr<ID3D12Resource> m_constantBuffer;
    ComPtr<ID3D12Resource> m_depthStencil;
    UINT8* m_pCbvDataBegin = nullptr;    // where the constant buffer is mapped (CPU address)

    // Synchronization objects.
    UINT m_frameIndex = 0;
    HANDLE m_fenceEvent = nullptr;
    ComPtr<ID3D12Fence> m_fence;
    UINT64 m_fenceValue = 0;

    void LoadPipeline();
    void LoadAssets();
    void PopulateCommandList();
    void WaitForPreviousFrame();
    void GetHardwareAdapter(IDXGIFactory1* pFactory, IDXGIAdapter1** ppAdapter);
};

D3D12App::D3D12App(UINT width, UINT height) :
    m_width(width),
    m_height(height),
    m_viewport(0.0f, 0.0f, static_cast<float>(width), static_cast<float>(height)),
    m_scissorRect(0, 0, static_cast<LONG>(width), static_cast<LONG>(height))
{
}

void D3D12App::OnInit(HWND hwnd)
{
    m_hwnd = hwnd;
    LoadPipeline();
    LoadAssets();
}

// Load the rendering pipeline dependencies.
void D3D12App::LoadPipeline()
{
    UINT dxgiFactoryFlags = 0;

#if defined(_DEBUG)
    // Enable the debug layer (requires the Graphics Tools "optional feature").
    // NOTE: Enabling the debug layer after device creation will invalidate the active device.
    {
        ComPtr<ID3D12Debug> debugController;
        if (SUCCEEDED(D3D12GetDebugInterface(IID_PPV_ARGS(&debugController))))
        {
            debugController->EnableDebugLayer();

            // Enable additional debug layers.
            dxgiFactoryFlags |= DXGI_CREATE_FACTORY_DEBUG;
        }
    }
#endif

    ComPtr<IDXGIFactory4> factory;
    ThrowIfFailed(CreateDXGIFactory2(dxgiFactoryFlags, IID_PPV_ARGS(&factory)));

    ComPtr<IDXGIAdapter1> hardwareAdapter;
    GetHardwareAdapter(factory.Get(), &hardwareAdapter);

    ThrowIfFailed(D3D12CreateDevice(
        hardwareAdapter.Get(),
        D3D_FEATURE_LEVEL_11_0,
        IID_PPV_ARGS(&m_device)
        ));

    // Describe and create the command queue.
    D3D12_COMMAND_QUEUE_DESC queueDesc = {};
    queueDesc.Flags = D3D12_COMMAND_QUEUE_FLAG_NONE;
    queueDesc.Type = D3D12_COMMAND_LIST_TYPE_DIRECT;

    ThrowIfFailed(m_device->CreateCommandQueue(&queueDesc, IID_PPV_ARGS(&m_commandQueue)));

    // Describe and create the swap chain.
    DXGI_SWAP_CHAIN_DESC1 swapChainDesc = {};
    swapChainDesc.BufferCount = FrameCount;
    swapChainDesc.Width = m_width;
    swapChainDesc.Height = m_height;
    swapChainDesc.Format = DXGI_FORMAT_R8G8B8A8_UNORM;
    swapChainDesc.BufferUsage = DXGI_USAGE_RENDER_TARGET_OUTPUT;
    swapChainDesc.SwapEffect = DXGI_SWAP_EFFECT_FLIP_DISCARD;
    swapChainDesc.SampleDesc.Count = 1;

    ComPtr<IDXGISwapChain1> swapChain;
    ThrowIfFailed(factory->CreateSwapChainForHwnd(
        m_commandQueue.Get(),        // Swap chain needs the queue so that it can force a flush on it.
        m_hwnd,
        &swapChainDesc,
        nullptr,
        nullptr,
        &swapChain
        ));

    // This program does not support fullscreen transitions (Alt+Enter).
    ThrowIfFailed(factory->MakeWindowAssociation(m_hwnd, DXGI_MWA_NO_ALT_ENTER));

    ThrowIfFailed(swapChain.As(&m_swapChain));
    m_frameIndex = m_swapChain->GetCurrentBackBufferIndex();

    // Create descriptor heaps.
    {
        // Describe and create a render target view (RTV) descriptor heap.
        D3D12_DESCRIPTOR_HEAP_DESC rtvHeapDesc = {};
        rtvHeapDesc.NumDescriptors = FrameCount;
        rtvHeapDesc.Type = D3D12_DESCRIPTOR_HEAP_TYPE_RTV;
        rtvHeapDesc.Flags = D3D12_DESCRIPTOR_HEAP_FLAG_NONE;
        ThrowIfFailed(m_device->CreateDescriptorHeap(&rtvHeapDesc, IID_PPV_ARGS(&m_rtvHeap)));

        // Describe and create a depth stencil view (DSV) descriptor heap.
        D3D12_DESCRIPTOR_HEAP_DESC dsvHeapDesc = {};
        dsvHeapDesc.NumDescriptors = 1;
        dsvHeapDesc.Type = D3D12_DESCRIPTOR_HEAP_TYPE_DSV;
        dsvHeapDesc.Flags = D3D12_DESCRIPTOR_HEAP_FLAG_NONE;
        ThrowIfFailed(m_device->CreateDescriptorHeap(&dsvHeapDesc, IID_PPV_ARGS(&m_dsvHeap)));

        // Describe and create a shader resource view (SRV) and constant buffer view
        // (CBV) heap. Shader visible: the shaders can read the descriptors in it.
        D3D12_DESCRIPTOR_HEAP_DESC cbvSrvHeapDesc = {};
        cbvSrvHeapDesc.NumDescriptors = 1 + 2 * MaxMeshes;    // one CBV + two SRVs per mesh
        cbvSrvHeapDesc.Type = D3D12_DESCRIPTOR_HEAP_TYPE_CBV_SRV_UAV;
        cbvSrvHeapDesc.Flags = D3D12_DESCRIPTOR_HEAP_FLAG_SHADER_VISIBLE;
        ThrowIfFailed(m_device->CreateDescriptorHeap(&cbvSrvHeapDesc, IID_PPV_ARGS(&m_cbvSrvHeap)));

        m_rtvDescriptorSize = m_device->GetDescriptorHandleIncrementSize(D3D12_DESCRIPTOR_HEAP_TYPE_RTV);
        m_cbvSrvDescriptorSize = m_device->GetDescriptorHandleIncrementSize(D3D12_DESCRIPTOR_HEAP_TYPE_CBV_SRV_UAV);
    }

    // Create frame resources.
    {
        CD3DX12_CPU_DESCRIPTOR_HANDLE rtvHandle(m_rtvHeap->GetCPUDescriptorHandleForHeapStart());

        // Create a RTV for each frame.
        for (UINT n = 0; n < FrameCount; n++)
        {
            ThrowIfFailed(m_swapChain->GetBuffer(n, IID_PPV_ARGS(&m_renderTargets[n])));
            m_device->CreateRenderTargetView(m_renderTargets[n].Get(), nullptr, rtvHandle);
            rtvHandle.Offset(1, m_rtvDescriptorSize);
        }
    }

    ThrowIfFailed(m_device->CreateCommandAllocator(D3D12_COMMAND_LIST_TYPE_DIRECT, IID_PPV_ARGS(&m_commandAllocator)));
}

// Load the assets.
void D3D12App::LoadAssets()
{
    // Create the root signature: what the shaders read besides the vertices.
    {
        // Descriptor ranges: 1 CBV at register b1, for the table of root parameter 1, and
        // the SRVs of a mesh's textures from register t0 on (2 SRVs: t0 the diffuse map,
        // t1 the specular map), for root parameter 2.
        CD3DX12_DESCRIPTOR_RANGE ranges[2];
        ranges[0].Init(D3D12_DESCRIPTOR_RANGE_TYPE_CBV, 1, 1);
        ranges[1].Init(D3D12_DESCRIPTOR_RANGE_TYPE_SRV, 2, 0);

        // Root parameter 0: root constants for register b0 (the model matrix).
        // Only the vertex shader reads them.
        // Root parameter 1: a descriptor table with the constant buffer view (b1: view
        // and projection), for the vertex and the pixel shader.
        // Root parameter 2: a descriptor table with a mesh's textures, for the pixel shader.
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

        ComPtr<ID3DBlob> signature;
        ComPtr<ID3DBlob> error;
        ThrowIfFailed(D3D12SerializeRootSignature(&rootSignatureDesc, D3D_ROOT_SIGNATURE_VERSION_1, &signature, &error));
        ThrowIfFailed(m_device->CreateRootSignature(0, signature->GetBufferPointer(), signature->GetBufferSize(), IID_PPV_ARGS(&m_rootSignature)));
    }

    // Create the pipeline state, which includes compiling and loading shaders.
    {
        ComPtr<ID3DBlob> vertexShader;
        ComPtr<ID3DBlob> pixelShader;

#if defined(_DEBUG)
        // Enable better shader debugging with the graphics debugging tools.
        UINT compileFlags = D3DCOMPILE_DEBUG | D3DCOMPILE_SKIP_OPTIMIZATION;
#else
        UINT compileFlags = 0;
#endif

        // The vertex shader (VSMain) and the pixel shader (PSMain) in anim_model.hlsl.
        ThrowIfFailed(D3DCompileFromFile(L"anim_model.hlsl", nullptr, nullptr, "VSMain", "vs_5_0", compileFlags, 0, &vertexShader, nullptr));
        ThrowIfFailed(D3DCompileFromFile(L"anim_model.hlsl", nullptr, nullptr, "PSMain", "ps_5_0", compileFlags, 0, &pixelShader, nullptr));

        // Define the vertex input layout: a vertex of a mesh is a position, a normal and
        // texture coordinates (3 + 3 + 2 floats, at byte offsets 0, 12 and 24), then its bones:
        // four 32-bit signed integers (BLENDINDICES, the shader reads an int4 - no conversion to
        // float) and four float weights (BLENDWEIGHT), at byte offsets 32 and 48.
        D3D12_INPUT_ELEMENT_DESC inputElementDescs[] =
        {
            { "POSITION", 0, DXGI_FORMAT_R32G32B32_FLOAT, 0, 0, D3D12_INPUT_CLASSIFICATION_PER_VERTEX_DATA, 0 },
            { "NORMAL", 0, DXGI_FORMAT_R32G32B32_FLOAT, 0, 12, D3D12_INPUT_CLASSIFICATION_PER_VERTEX_DATA, 0 },
            { "TEXCOORD", 0, DXGI_FORMAT_R32G32_FLOAT, 0, 24, D3D12_INPUT_CLASSIFICATION_PER_VERTEX_DATA, 0 },
            { "BLENDINDICES", 0, DXGI_FORMAT_R32G32B32A32_SINT, 0, 32, D3D12_INPUT_CLASSIFICATION_PER_VERTEX_DATA, 0 },
            { "BLENDWEIGHT", 0, DXGI_FORMAT_R32G32B32A32_FLOAT, 0, 48, D3D12_INPUT_CLASSIFICATION_PER_VERTEX_DATA, 0 }
        };

        // Describe and create the graphics pipeline state object (PSO).
        D3D12_GRAPHICS_PIPELINE_STATE_DESC psoDesc = {};
        psoDesc.InputLayout = { inputElementDescs, _countof(inputElementDescs) };
        psoDesc.pRootSignature = m_rootSignature.Get();
        psoDesc.VS = CD3DX12_SHADER_BYTECODE(vertexShader.Get());
        psoDesc.PS = CD3DX12_SHADER_BYTECODE(pixelShader.Get());
        psoDesc.RasterizerState = CD3DX12_RASTERIZER_DESC(D3D12_DEFAULT);
        psoDesc.RasterizerState.CullMode = D3D12_CULL_MODE_NONE;    // no culling, as in learnopengl
        psoDesc.BlendState = CD3DX12_BLEND_DESC(D3D12_DEFAULT);
        // The default depth stencil state: depth test on (a pixel is kept only if it is
        // nearer than the one already there, D3D12_COMPARISON_FUNC_LESS), depth writes on.
        psoDesc.DepthStencilState = CD3DX12_DEPTH_STENCIL_DESC(D3D12_DEFAULT);
        psoDesc.SampleMask = UINT_MAX;
        psoDesc.PrimitiveTopologyType = D3D12_PRIMITIVE_TOPOLOGY_TYPE_TRIANGLE;
        psoDesc.NumRenderTargets = 1;
        psoDesc.RTVFormats[0] = DXGI_FORMAT_R8G8B8A8_UNORM;
        psoDesc.DSVFormat = DXGI_FORMAT_D32_FLOAT;
        psoDesc.SampleDesc.Count = 1;
        ThrowIfFailed(m_device->CreateGraphicsPipelineState(&psoDesc, IID_PPV_ARGS(&m_pipelineState)));
    }

    // Create the command list.
    ThrowIfFailed(m_device->CreateCommandList(0, D3D12_COMMAND_LIST_TYPE_DIRECT, m_commandAllocator.Get(), m_pipelineState.Get(), IID_PPV_ARGS(&m_commandList)));

    // Command lists are created in the recording state. This one stays open until the
    // end of LoadAssets, where it is closed and executed once.

    // Load the model: its meshes (vertex and index buffers) and its textures, whose copies
    // are recorded in this command list. The meshes' texture views go into the CBV/SRV heap
    // from slot 1 on (slot 0 is the CBV).
    m_model.Load("models/tentacle.gltf", m_device.Get(), m_commandList.Get(), m_cbvSrvHeap.Get(), 1);

    // the model's animation (from the same file) and the animator that plays it
    LoadAnimation(m_swayAnimation, "models/tentacle.gltf", m_model);
    InitAnimator(m_animator, &m_swayAnimation);

    // Create the constant buffer.
    {
        const UINT constantBufferSize = CalculateConstantBufferByteSize(sizeof(SceneConstantBuffer));    // CB size is required to be 256-byte aligned.

        // An upload heap: the CPU writes the buffer every frame, the GPU reads it.
        CD3DX12_HEAP_PROPERTIES heapProperties(D3D12_HEAP_TYPE_UPLOAD);
        CD3DX12_RESOURCE_DESC bufferDesc = CD3DX12_RESOURCE_DESC::Buffer(constantBufferSize);
        ThrowIfFailed(m_device->CreateCommittedResource(
            &heapProperties,
            D3D12_HEAP_FLAG_NONE,
            &bufferDesc,
            D3D12_RESOURCE_STATE_GENERIC_READ,
            nullptr,
            IID_PPV_ARGS(&m_constantBuffer)));

        // Describe and create a constant buffer view (CBV) in the first slot of the
        // CBV/SRV heap (descriptor 0).
        D3D12_CONSTANT_BUFFER_VIEW_DESC cbvDesc = {};
        cbvDesc.BufferLocation = m_constantBuffer->GetGPUVirtualAddress();
        cbvDesc.SizeInBytes = constantBufferSize;
        m_device->CreateConstantBufferView(&cbvDesc, m_cbvSrvHeap->GetCPUDescriptorHandleForHeapStart());

        // Map the constant buffer. We don't unmap this until the app closes.
        // Keeping things mapped for the lifetime of the resource is okay.
        CD3DX12_RANGE readRange(0, 0);        // We do not intend to read from this resource on the CPU.
        ThrowIfFailed(m_constantBuffer->Map(0, &readRange, reinterpret_cast<void**>(&m_pCbvDataBegin)));
    }

    // Create the depth buffer and its depth stencil view.
    {
        D3D12_DEPTH_STENCIL_VIEW_DESC depthStencilDesc = {};
        depthStencilDesc.Format = DXGI_FORMAT_D32_FLOAT;
        depthStencilDesc.ViewDimension = D3D12_DSV_DIMENSION_TEXTURE2D;
        depthStencilDesc.Flags = D3D12_DSV_FLAG_NONE;

        // The value the depth buffer is usually cleared to: 1.0, the far plane.
        D3D12_CLEAR_VALUE depthOptimizedClearValue = {};
        depthOptimizedClearValue.Format = DXGI_FORMAT_D32_FLOAT;
        depthOptimizedClearValue.DepthStencil.Depth = 1.0f;
        depthOptimizedClearValue.DepthStencil.Stencil = 0;

        // A texture as big as the window, one 32-bit float depth per pixel (1 array
        // slice, 1 mip level), in a default heap and in the DEPTH_WRITE state.
        CD3DX12_HEAP_PROPERTIES heapProperties(D3D12_HEAP_TYPE_DEFAULT);
        CD3DX12_RESOURCE_DESC depthDesc = CD3DX12_RESOURCE_DESC::Tex2D(DXGI_FORMAT_D32_FLOAT, m_width, m_height, 1, 1, 1, 0, D3D12_RESOURCE_FLAG_ALLOW_DEPTH_STENCIL);
        ThrowIfFailed(m_device->CreateCommittedResource(
            &heapProperties,
            D3D12_HEAP_FLAG_NONE,
            &depthDesc,
            D3D12_RESOURCE_STATE_DEPTH_WRITE,
            &depthOptimizedClearValue,
            IID_PPV_ARGS(&m_depthStencil)));

        m_device->CreateDepthStencilView(m_depthStencil.Get(), &depthStencilDesc, m_dsvHeap->GetCPUDescriptorHandleForHeapStart());
    }

    // Close the command list and execute it to begin the initial GPU setup.
    ThrowIfFailed(m_commandList->Close());
    ID3D12CommandList* ppCommandLists[] = { m_commandList.Get() };
    m_commandQueue->ExecuteCommandLists(_countof(ppCommandLists), ppCommandLists);

    // Create synchronization objects and wait until assets have been uploaded to the GPU.
    {
        ThrowIfFailed(m_device->CreateFence(0, D3D12_FENCE_FLAG_NONE, IID_PPV_ARGS(&m_fence)));
        m_fenceValue = 1;

        // Create an event handle to use for frame synchronization.
        m_fenceEvent = CreateEvent(nullptr, FALSE, FALSE, nullptr);
        if (m_fenceEvent == nullptr)
        {
            ThrowIfFailed(HRESULT_FROM_WIN32(GetLastError()));
        }

        // Wait for the command list to execute; we are reusing the same command
        // list in our main loop but for now, we just want to wait for setup to
        // complete before continuing.
        WaitForPreviousFrame();

        // The textures have been copied: their upload buffers can go.
        m_model.uploadHeaps.clear();
    }
}

// Update frame-based values.
void D3D12App::OnUpdate()
{
    // Per-frame time logic: deltaTime is the time since the last frame, in seconds.
    static auto lastFrame = std::chrono::high_resolution_clock::now();
    auto currentFrame = std::chrono::high_resolution_clock::now();
    float deltaTime = std::chrono::duration<float, std::chrono::seconds::period>(currentFrame - lastFrame).count();
    lastFrame = currentFrame;

    // Move the camera with W, A, S and D: 2.5 units per second, however fast the frames are.
    float cameraSpeed = 2.5f * deltaTime;
    if (keys['W'])
        cameraPos += cameraSpeed * cameraFront;
    if (keys['S'])
        cameraPos -= cameraSpeed * cameraFront;
    if (keys['A'])
        cameraPos -= XMVector3Normalize(XMVector3Cross(cameraFront, cameraUp)) * cameraSpeed;
    if (keys['D'])
        cameraPos += XMVector3Normalize(XMVector3Cross(cameraFront, cameraUp)) * cameraSpeed;

    // play the animation: deltaTime further, and the bones' final matrices at that time
    UpdateAnimation(m_animator, deltaTime);

    // The view matrix: look from cameraPos in the direction of cameraFront.
    XMMATRIX view = XMMatrixLookAtRH(cameraPos, cameraPos + cameraFront, cameraUp);

    // The projection matrix adds perspective: a field of view of fov degrees (the
    // zoom), the window's aspect ratio, and the near and far planes at 0.1 and 100 units.
    XMMATRIX projection = XMMatrixPerspectiveFovRH(XMConvertToRadians(fov), static_cast<float>(m_width) / static_cast<float>(m_height), 0.1f, 100.0f);

    // Copy both into the constant buffer, transposed like the model matrix. The GPU
    // has finished the previous frame (OnRender waits for it), so it is not reading it.
    SceneConstantBuffer constantBufferData = {};
    XMStoreFloat4x4(&constantBufferData.view, XMMatrixTranspose(view));
    XMStoreFloat4x4(&constantBufferData.projection, XMMatrixTranspose(projection));

    // the bones' final matrices, transposed like the others
    for (int i = 0; i < static_cast<int>(m_animator.m_FinalBoneMatrices.size()); ++i)
        XMStoreFloat4x4(&constantBufferData.finalBonesMatrices[i], XMMatrixTranspose(XMLoadFloat4x4(&m_animator.m_FinalBoneMatrices[i])));

    memcpy(m_pCbvDataBegin, &constantBufferData, sizeof(constantBufferData));
}

// Render the scene.
void D3D12App::OnRender()
{
    // Record all the commands we need to render the scene into the command list.
    PopulateCommandList();

    // Execute the command list.
    ID3D12CommandList* ppCommandLists[] = { m_commandList.Get() };
    m_commandQueue->ExecuteCommandLists(_countof(ppCommandLists), ppCommandLists);

    // Present the frame.
    ThrowIfFailed(m_swapChain->Present(1, 0));

    WaitForPreviousFrame();
}

void D3D12App::OnDestroy()
{
    // Ensure that the GPU is no longer referencing resources that are about to be
    // cleaned up by the destructor.
    WaitForPreviousFrame();

    CloseHandle(m_fenceEvent);
}

void D3D12App::PopulateCommandList()
{
    // Command list allocators can only be reset when the associated
    // command lists have finished execution on the GPU; apps should use
    // fences to determine GPU execution progress.
    ThrowIfFailed(m_commandAllocator->Reset());

    // However, when ExecuteCommandList() is called on a particular command
    // list, that command list can then be reset at any time and must be before
    // re-recording.
    ThrowIfFailed(m_commandList->Reset(m_commandAllocator.Get(), m_pipelineState.Get()));

    // Set necessary state.
    m_commandList->SetGraphicsRootSignature(m_rootSignature.Get());

    // The CBV/SRV heap the descriptor tables point into, and root parameter 1: the
    // table with the constant buffer view, the heap's first descriptor. (Each mesh
    // sets root parameter 2, the table with its textures, when it is drawn.)
    ID3D12DescriptorHeap* ppHeaps[] = { m_cbvSrvHeap.Get() };
    m_commandList->SetDescriptorHeaps(_countof(ppHeaps), ppHeaps);
    m_commandList->SetGraphicsRootDescriptorTable(1, m_cbvSrvHeap->GetGPUDescriptorHandleForHeapStart());

    m_commandList->RSSetViewports(1, &m_viewport);
    m_commandList->RSSetScissorRects(1, &m_scissorRect);

    // Indicate that the back buffer will be used as a render target.
    CD3DX12_RESOURCE_BARRIER barrier = CD3DX12_RESOURCE_BARRIER::Transition(m_renderTargets[m_frameIndex].Get(), D3D12_RESOURCE_STATE_PRESENT, D3D12_RESOURCE_STATE_RENDER_TARGET);
    m_commandList->ResourceBarrier(1, &barrier);

    CD3DX12_CPU_DESCRIPTOR_HANDLE rtvHandle(m_rtvHeap->GetCPUDescriptorHandleForHeapStart(), m_frameIndex, m_rtvDescriptorSize);
    CD3DX12_CPU_DESCRIPTOR_HANDLE dsvHandle(m_dsvHeap->GetCPUDescriptorHandleForHeapStart());
    m_commandList->OMSetRenderTargets(1, &rtvHandle, FALSE, &dsvHandle);

    // Record commands.
    const float clearColor[] = { 0.05f, 0.05f, 0.05f, 1.0f };
    m_commandList->ClearRenderTargetView(rtvHandle, clearColor, 0, nullptr);
    m_commandList->ClearDepthStencilView(dsvHandle, D3D12_CLEAR_FLAG_DEPTH, 1.0f, 0, 0, nullptr);
    m_commandList->IASetPrimitiveTopology(D3D_PRIMITIVE_TOPOLOGY_TRIANGLELIST);

    // render the loaded model: its model matrix as the root constants (root parameter 0,
    // transposed for HLSL) - learnopengl's translate(0, -1, 0) * scale(0.9): moved down so it
    // stands in the middle of the window, a little smaller
    XMMATRIX model = XMMatrixScaling(0.9f, 0.9f, 0.9f) * XMMatrixTranslation(0.0f, -1.0f, 0.0f);
    ModelConstants modelConstants = {};
    XMStoreFloat4x4(&modelConstants.model, XMMatrixTranspose(model));
    m_commandList->SetGraphicsRoot32BitConstants(0, sizeof(ModelConstants) / 4, &modelConstants, 0);
    m_model.Draw(m_commandList.Get());

    // Indicate that the back buffer will now be used to present.
    barrier = CD3DX12_RESOURCE_BARRIER::Transition(m_renderTargets[m_frameIndex].Get(), D3D12_RESOURCE_STATE_RENDER_TARGET, D3D12_RESOURCE_STATE_PRESENT);
    m_commandList->ResourceBarrier(1, &barrier);

    ThrowIfFailed(m_commandList->Close());
}

void D3D12App::WaitForPreviousFrame()
{
    // WAITING FOR THE FRAME TO COMPLETE BEFORE CONTINUING IS NOT BEST PRACTICE.
    // This is code implemented as such for simplicity. The D3D12HelloFrameBuffering
    // sample illustrates how to use fences for efficient resource usage and to
    // maximize GPU utilization.

    // Signal and increment the fence value.
    const UINT64 fence = m_fenceValue;
    ThrowIfFailed(m_commandQueue->Signal(m_fence.Get(), fence));
    m_fenceValue++;

    // Wait until the previous frame is finished.
    if (m_fence->GetCompletedValue() < fence)
    {
        ThrowIfFailed(m_fence->SetEventOnCompletion(fence, m_fenceEvent));
        WaitForSingleObject(m_fenceEvent, INFINITE);
    }

    m_frameIndex = m_swapChain->GetCurrentBackBufferIndex();
}

// Helper function for acquiring the first available hardware adapter that supports Direct3D 12.
// If no such adapter can be found, *ppAdapter will be set to nullptr (D3D12CreateDevice then
// uses the default adapter).
void D3D12App::GetHardwareAdapter(IDXGIFactory1* pFactory, IDXGIAdapter1** ppAdapter)
{
    *ppAdapter = nullptr;

    ComPtr<IDXGIAdapter1> adapter;
    for (UINT adapterIndex = 0; SUCCEEDED(pFactory->EnumAdapters1(adapterIndex, &adapter)); ++adapterIndex)
    {
        DXGI_ADAPTER_DESC1 desc;
        adapter->GetDesc1(&desc);

        if (desc.Flags & DXGI_ADAPTER_FLAG_SOFTWARE)
        {
            // Don't select the Basic Render Driver adapter.
            continue;
        }

        // Check to see whether the adapter supports Direct3D 12, but don't create the
        // actual device yet.
        if (SUCCEEDED(D3D12CreateDevice(adapter.Get(), D3D_FEATURE_LEVEL_11_0, __uuidof(ID3D12Device), nullptr)))
        {
            break;
        }
    }

    *ppAdapter = adapter.Detach();
}

// Mouse look: WindowProc calls this whenever the mouse moves, with the cursor's
// position in the window's client area (in pixels from its top left corner).
void OnMouseMove(float xpos, float ypos)
{
    // The first time, the cursor can be anywhere: start from there instead of
    // jumping from (lastX, lastY).
    if (firstMouse)
    {
        lastX = xpos;
        lastY = ypos;
        firstMouse = false;
    }

    float xoffset = xpos - lastX;
    float yoffset = lastY - ypos;    // reversed since y-coordinates go from top to bottom
    lastX = xpos;
    lastY = ypos;

    float sensitivity = 0.1f;    // change this value to your liking
    xoffset *= sensitivity;
    yoffset *= sensitivity;

    yaw += xoffset;
    pitch += yoffset;

    // Make sure that when pitch is out of bounds, the screen doesn't get flipped.
    if (pitch > 89.0f)
        pitch = 89.0f;
    if (pitch < -89.0f)
        pitch = -89.0f;

    XMVECTOR front = XMVectorSet(
        std::cos(XMConvertToRadians(yaw)) * std::cos(XMConvertToRadians(pitch)),
        std::sin(XMConvertToRadians(pitch)),
        std::sin(XMConvertToRadians(yaw)) * std::cos(XMConvertToRadians(pitch)),
        0.0f);
    cameraFront = XMVector3Normalize(front);
}

// Zoom: WindowProc calls this when the mouse wheel turns, with the number of notches
// (positive: turned away from you, which zooms in).
void OnMouseWheel(float yoffset)
{
    fov -= yoffset;
    if (fov < 1.0f)
        fov = 1.0f;
    if (fov > 45.0f)
        fov = 45.0f;
}

// Main message handler for the window.
LRESULT CALLBACK WindowProc(HWND hWnd, UINT message, WPARAM wParam, LPARAM lParam)
{
    switch (message)
    {
    case WM_KEYDOWN:
        // Escape closes the window; any key pressed is held down until its WM_KEYUP.
        if (wParam == VK_ESCAPE)
        {
            DestroyWindow(hWnd);
        }
        keys[static_cast<UINT8>(wParam)] = true;
        return 0;

    case WM_KEYUP:
        keys[static_cast<UINT8>(wParam)] = false;
        return 0;

    case WM_MOUSEMOVE:
        // Only while the window is the active one, so the mouse is free otherwise.
        if (GetForegroundWindow() == hWnd)
        {
            int xpos = GET_X_LPARAM(lParam);
            int ypos = GET_Y_LPARAM(lParam);
            OnMouseMove(static_cast<float>(xpos), static_cast<float>(ypos));

            // Capture the cursor: put it back in the middle of the window, so it never
            // reaches an edge. lastX and lastY move with it, so the jump does not turn
            // the camera (the WM_MOUSEMOVE it causes has an offset of 0).
            RECT clientRect = {};
            GetClientRect(hWnd, &clientRect);
            POINT centre = { clientRect.right / 2, clientRect.bottom / 2 };
            if (xpos != centre.x || ypos != centre.y)
            {
                lastX = static_cast<float>(centre.x);
                lastY = static_cast<float>(centre.y);
                ClientToScreen(hWnd, &centre);
                SetCursorPos(centre.x, centre.y);
            }
        }
        return 0;

    case WM_MOUSEWHEEL:
        // One notch of the wheel is WHEEL_DELTA (120); a fine wheel sends less.
        OnMouseWheel(static_cast<float>(GET_WHEEL_DELTA_WPARAM(wParam)) / WHEEL_DELTA);
        return 0;

    case WM_DESTROY:
        PostQuitMessage(0);
        return 0;
    }

    // Handle any messages the switch statement didn't.
    return DefWindowProc(hWnd, message, wParam, lParam);
}

int WINAPI wWinMain(HINSTANCE hInstance, HINSTANCE, LPWSTR, int nCmdShow)
{
    const UINT width = 800;
    const UINT height = 600;

    // Initialize the window class.
    WNDCLASSEXW windowClass = {};
    windowClass.cbSize = sizeof(WNDCLASSEXW);
    windowClass.style = CS_HREDRAW | CS_VREDRAW;
    windowClass.lpfnWndProc = WindowProc;
    windowClass.hInstance = hInstance;
    windowClass.hCursor = LoadCursor(nullptr, IDC_ARROW);
    windowClass.lpszClassName = L"DXSampleClass";
    RegisterClassExW(&windowClass);

    // The window is bigger than the area we draw in (title bar, borders):
    // compute the window size for a client area of width x height.
    RECT windowRect = { 0, 0, static_cast<LONG>(width), static_cast<LONG>(height) };
    AdjustWindowRect(&windowRect, WS_OVERLAPPEDWINDOW, FALSE);

    // Create the window and store a handle to it.
    HWND hwnd = CreateWindowW(
        windowClass.lpszClassName,
        L"LearnDirectX",
        WS_OVERLAPPEDWINDOW,
        CW_USEDEFAULT,
        CW_USEDEFAULT,
        windowRect.right - windowRect.left,
        windowRect.bottom - windowRect.top,
        nullptr,        // We have no parent window.
        nullptr,        // We aren't using menus.
        hInstance,
        nullptr);
    if (hwnd == nullptr)
    {
        MessageBoxW(nullptr, L"Failed to create the window", L"Error", MB_OK | MB_ICONERROR);
        return EXIT_FAILURE;
    }

    D3D12App app(width, height);
    try
    {
        app.OnInit(hwnd);

        ShowWindow(hwnd, nCmdShow);

        // Hide the cursor over the window: the mouse turns the camera now.
        ShowCursor(FALSE);

        // Main loop: process the window's messages until the window is closed (WM_QUIT).
        MSG msg = {};
        while (msg.message != WM_QUIT)
        {
            if (PeekMessage(&msg, nullptr, 0, 0, PM_REMOVE))
            {
                TranslateMessage(&msg);
                DispatchMessage(&msg);
            }
            else
            {
                // No messages waiting: update and render a frame.
                app.OnUpdate();
                app.OnRender();
            }
        }

        app.OnDestroy();

        // Return this part of the WM_QUIT message to Windows.
        return static_cast<int>(msg.wParam);
    }
    catch (const std::exception& e)
    {
        MessageBoxA(nullptr, e.what(), "Error", MB_OK | MB_ICONERROR);
        return EXIT_FAILURE;
    }
}

