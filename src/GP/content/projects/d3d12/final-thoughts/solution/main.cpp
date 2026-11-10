// A Direct3D 12 program in one file, modelled on Microsoft's D3D12HelloWorld samples
// (D3D12HelloWindow, D3D12HelloTriangle, D3D12HelloTexture, D3D12HelloConstBuffers).

#include <windows.h>
#include <d3d12.h>
#include <dxgi1_6.h>
#include <d3dcompiler.h>
#include <DirectXMath.h>
#include <wrl.h>
#include "d3dx12.h"

// FreeType loads fonts and renders their glyphs into bitmaps.
#include <ft2build.h>
#include FT_FREETYPE_H

// stb_image loads image files (PNG, JPEG ...). STB_IMAGE_IMPLEMENTATION makes this file
// compile the library's code as well (do that in exactly one .cpp file).
#define STB_IMAGE_IMPLEMENTATION
#include <stb_image.h>

#include <algorithm>
#include <chrono>
#include <climits>
#include <cmath>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <fstream>
#include <map>
#include <sstream>
#include <stdexcept>
#include <string>
#include <tuple>
#include <vector>

// The libraries to link: d3d12.lib, dxgi.lib and d3dcompiler.lib (Visual Studio reads these lines).
#if defined(_MSC_VER)
#pragma comment(lib, "d3d12.lib")
#pragma comment(lib, "dxgi.lib")
#pragma comment(lib, "d3dcompiler.lib")
#pragma comment(lib, "freetype.lib")
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

// Hedgerow: a ball, a paddle and a wall of blocks.
// learnopengl splits its game into classes and files (Game, ResourceManager, Shader, Texture2D, SpriteRenderer ...);
// here each of those classes is a plain struct with free functions, in one file, in the order of learnopengl's
// files - next to the Direct3D 12 application class of the earlier chapters (D3D12App, further down).

// The width of the screen
const unsigned int SCREEN_WIDTH = 800;
// The height of the screen
const unsigned int SCREEN_HEIGHT = 600;

// The Direct3D 12 objects the game's functions create resources with and draw with.
// learnopengl's classes reach OpenGL through its global context; Direct3D 12 passes its
// objects around instead, so D3D12App::LoadAssets puts the ones the game needs here
// (plain pointers: D3D12App owns the objects).
struct GraphicsContext
{
    ID3D12Device*              Device = nullptr;
    ID3D12GraphicsCommandList* CommandList = nullptr;      // the one command list: setup, then every frame
    ID3D12RootSignature*       RootSignature = nullptr;    // the root signature of every pipeline state
    ID3D12DescriptorHeap*      SrvHeap = nullptr;          // the shader-visible CBV/SRV heap
    UINT                       SrvDescriptorSize = 0;
    UINT                       SrvCount = 1;               // the descriptors in use (slot 0: the CBV)
    D3D12_CPU_DESCRIPTOR_HANDLE BackBufferRtv = {};        // this frame's back buffer (the window's render target)
};

GraphicsContext Graphics;

// Shader (learnopengl: shader.h, shader.cpp)
// ------------------------------------------
// a compiled shader program: in Direct3D 12 the vertex and the pixel shader are part of a
// pipeline state object (PSO), together with the input layout and the fixed-function states
struct Shader
{
    ComPtr<ID3D12PipelineState> PipelineState;
};

// sets the current shader as active
void Use(Shader& shader)
{
    Graphics.CommandList->SetPipelineState(shader.PipelineState.Get());
}

// creates the pipeline state from the compiled vertex and pixel shader, with the states 2D
// sprites need: alpha blending on (learnopengl's glEnable(GL_BLEND) and glBlendFunc), no
// depth buffer, no culling. destBlend is the blend function's second factor: the default
// INV_SRC_ALPHA mixes by alpha (GL_ONE_MINUS_SRC_ALPHA), ONE adds the colour (GL_ONE).
// sampleCount: the samples per pixel of the render target it draws into
void Compile(Shader& shader, ID3DBlob* vertexShader, ID3DBlob* pixelShader, D3D12_BLEND destBlend = D3D12_BLEND_INV_SRC_ALPHA, UINT sampleCount = 1)
{
    // the vertex input layout: a position and texture coordinates, two floats each
    // (learnopengl's vec4 vertex <vec2 position, vec2 texCoords>)
    D3D12_INPUT_ELEMENT_DESC inputElementDescs[] =
    {
        { "POSITION", 0, DXGI_FORMAT_R32G32_FLOAT, 0, 0, D3D12_INPUT_CLASSIFICATION_PER_VERTEX_DATA, 0 },
        { "TEXCOORD", 0, DXGI_FORMAT_R32G32_FLOAT, 0, 8, D3D12_INPUT_CLASSIFICATION_PER_VERTEX_DATA, 0 }
    };

    D3D12_GRAPHICS_PIPELINE_STATE_DESC psoDesc = {};
    psoDesc.InputLayout = { inputElementDescs, _countof(inputElementDescs) };
    psoDesc.pRootSignature = Graphics.RootSignature;
    psoDesc.VS = CD3DX12_SHADER_BYTECODE(vertexShader);
    psoDesc.PS = CD3DX12_SHADER_BYTECODE(pixelShader);
    psoDesc.RasterizerState = CD3DX12_RASTERIZER_DESC(D3D12_DEFAULT);
    psoDesc.RasterizerState.CullMode = D3D12_CULL_MODE_NONE;
    psoDesc.BlendState = CD3DX12_BLEND_DESC(D3D12_DEFAULT);
    psoDesc.BlendState.RenderTarget[0].BlendEnable = TRUE;
    psoDesc.BlendState.RenderTarget[0].SrcBlend = D3D12_BLEND_SRC_ALPHA;
    psoDesc.BlendState.RenderTarget[0].DestBlend = destBlend;
    psoDesc.BlendState.RenderTarget[0].BlendOp = D3D12_BLEND_OP_ADD;
    psoDesc.BlendState.RenderTarget[0].SrcBlendAlpha = D3D12_BLEND_SRC_ALPHA;
    psoDesc.BlendState.RenderTarget[0].DestBlendAlpha = destBlend;
    psoDesc.BlendState.RenderTarget[0].BlendOpAlpha = D3D12_BLEND_OP_ADD;
    psoDesc.DepthStencilState.DepthEnable = FALSE;
    psoDesc.DepthStencilState.StencilEnable = FALSE;
    psoDesc.SampleMask = UINT_MAX;
    psoDesc.PrimitiveTopologyType = D3D12_PRIMITIVE_TOPOLOGY_TYPE_TRIANGLE;
    psoDesc.NumRenderTargets = 1;
    psoDesc.RTVFormats[0] = DXGI_FORMAT_R8G8B8A8_UNORM;
    psoDesc.SampleDesc.Count = sampleCount;
    ThrowIfFailed(Graphics.Device->CreateGraphicsPipelineState(&psoDesc, IID_PPV_ARGS(&shader.PipelineState)));
}

// Texture2D (learnopengl: texture.h, texture.cpp)
// -----------------------------------------------
// a texture and its shader resource view (wrapping and filtering are the root signature's
// static sampler in Direct3D 12: linear, wrapping - learnopengl's defaults)
struct Texture2D
{
    // the texture's shader resource view: its slot in the CBV/SRV heap, used for all texture
    // operations to reference to this particular texture (learnopengl's texture ID)
    unsigned int ID = 0;
    // texture image dimensions
    unsigned int Width = 0, Height = 0; // width and height of loaded image in pixels
    // texture Format (8 bits per channel, RGBA: Direct3D has no 8-bit RGB format)
    DXGI_FORMAT Internal_Format = DXGI_FORMAT_R8G8B8A8_UNORM;
    // the texture in a default heap, and the upload buffer its pixels are copied from (it
    // must stay alive until the setup's command list has executed)
    ComPtr<ID3D12Resource> Resource;
    ComPtr<ID3D12Resource> UploadHeap;
};

// generates texture from image data: creates the texture, records the copy of the pixels into
// it in the setup's command list and creates its shader resource view in slot texture.ID
void Generate(Texture2D& texture, unsigned int width, unsigned int height, unsigned char* data)
{
    texture.Width = width;
    texture.Height = height;

    // create Texture: a Texture2D in a default heap, in the COPY_DEST state for the copy
    CD3DX12_RESOURCE_DESC textureDesc = CD3DX12_RESOURCE_DESC::Tex2D(texture.Internal_Format, width, height, 1, 1);
    CD3DX12_HEAP_PROPERTIES heapProperties(D3D12_HEAP_TYPE_DEFAULT);
    ThrowIfFailed(Graphics.Device->CreateCommittedResource(
        &heapProperties,
        D3D12_HEAP_FLAG_NONE,
        &textureDesc,
        D3D12_RESOURCE_STATE_COPY_DEST,
        nullptr,
        IID_PPV_ARGS(&texture.Resource)));

    // the upload heap, big enough for the texture's rows as the GPU lays them out
    const UINT64 uploadBufferSize = GetRequiredIntermediateSize(texture.Resource.Get(), 0, 1);
    CD3DX12_HEAP_PROPERTIES uploadHeapProperties(D3D12_HEAP_TYPE_UPLOAD);
    CD3DX12_RESOURCE_DESC uploadBufferDesc = CD3DX12_RESOURCE_DESC::Buffer(uploadBufferSize);
    ThrowIfFailed(Graphics.Device->CreateCommittedResource(
        &uploadHeapProperties,
        D3D12_HEAP_FLAG_NONE,
        &uploadBufferDesc,
        D3D12_RESOURCE_STATE_GENERIC_READ,
        nullptr,
        IID_PPV_ARGS(&texture.UploadHeap)));

    // copy the pixels to the upload heap now, and from there to the texture when the
    // command list executes
    D3D12_SUBRESOURCE_DATA textureData = {};
    textureData.pData = data;
    textureData.RowPitch = width * 4;                          // bytes per row: 4 per pixel
    textureData.SlicePitch = textureData.RowPitch * height;    // bytes in the whole image
    UpdateSubresources(Graphics.CommandList, texture.Resource.Get(), texture.UploadHeap.Get(), 0, 0, 1, &textureData);

    // after the copy, the texture is read by the pixel shader
    CD3DX12_RESOURCE_BARRIER barrier = CD3DX12_RESOURCE_BARRIER::Transition(texture.Resource.Get(), D3D12_RESOURCE_STATE_COPY_DEST, D3D12_RESOURCE_STATE_PIXEL_SHADER_RESOURCE);
    Graphics.CommandList->ResourceBarrier(1, &barrier);

    // the shader resource view, in slot texture.ID of the CBV/SRV heap
    D3D12_SHADER_RESOURCE_VIEW_DESC srvDesc = {};
    srvDesc.Shader4ComponentMapping = D3D12_DEFAULT_SHADER_4_COMPONENT_MAPPING;
    srvDesc.Format = texture.Internal_Format;
    srvDesc.ViewDimension = D3D12_SRV_DIMENSION_TEXTURE2D;
    srvDesc.Texture2D.MipLevels = 1;
    CD3DX12_CPU_DESCRIPTOR_HANDLE srvHandle(Graphics.SrvHeap->GetCPUDescriptorHandleForHeapStart(), texture.ID, Graphics.SrvDescriptorSize);
    Graphics.Device->CreateShaderResourceView(texture.Resource.Get(), &srvDesc, srvHandle);
}

// ResourceManager (learnopengl: resource_manager.h, resource_manager.cpp)
// -----------------------------------------------------------------------
// resource storage
std::map<std::string, Shader>    Shaders;
std::map<std::string, Texture2D> Textures;

// loads and generates a shader from file: the vertex shader VSMain and the pixel shader
// PSMain of an HLSL file, blending with destBlend, for sampleCount samples per pixel (see Compile)
Shader loadShaderFromFile(const wchar_t* shaderFile, D3D12_BLEND destBlend, UINT sampleCount)
{
#if defined(_DEBUG)
    // Enable better shader debugging with the graphics debugging tools.
    UINT compileFlags = D3DCOMPILE_DEBUG | D3DCOMPILE_SKIP_OPTIMIZATION;
#else
    UINT compileFlags = 0;
#endif

    // 1. compile the vertex and the pixel shader; on errors print the compiler's messages
    ComPtr<ID3DBlob> vertexShader;
    ComPtr<ID3DBlob> pixelShader;
    ComPtr<ID3DBlob> errors;
    if (FAILED(D3DCompileFromFile(shaderFile, nullptr, nullptr, "VSMain", "vs_5_0", compileFlags, 0, &vertexShader, &errors)))
    {
        OutputDebugStringA(errors ? static_cast<const char*>(errors->GetBufferPointer()) : "ERROR::SHADER: Failed to read shader file\n");
        throw std::runtime_error("ERROR::SHADER: Compile-time error: Type: VERTEX");
    }
    if (FAILED(D3DCompileFromFile(shaderFile, nullptr, nullptr, "PSMain", "ps_5_0", compileFlags, 0, &pixelShader, &errors)))
    {
        OutputDebugStringA(errors ? static_cast<const char*>(errors->GetBufferPointer()) : "ERROR::SHADER: Failed to read shader file\n");
        throw std::runtime_error("ERROR::SHADER: Compile-time error: Type: PIXEL");
    }
    // 2. now create shader object (the pipeline state) from the compiled shaders
    Shader shader;
    Compile(shader, vertexShader.Get(), pixelShader.Get(), destBlend, sampleCount);
    return shader;
}

// loads a single texture from file
Texture2D loadTextureFromFile(const char* file, bool alpha)
{
    // create texture object: its view takes the next free slot of the CBV/SRV heap
    Texture2D texture;
    texture.ID = Graphics.SrvCount++;
    // load image, always as RGBA (an image without alpha gets alpha 255, so alpha = false
    // needs nothing more: it only says the image has no transparent parts)
    int width, height, nrChannels;
    unsigned char* data = stbi_load(file, &width, &height, &nrChannels, 4);
    if (data == nullptr)
    {
        throw std::runtime_error(std::string("Failed to load texture ") + file);
    }
    // now generate texture
    Generate(texture, width, height, data);
    // and finally free image data
    stbi_image_free(data);
    return texture;
}

// loads (and generates) a shader program from file
Shader LoadShader(const wchar_t* shaderFile, std::string name, D3D12_BLEND destBlend = D3D12_BLEND_INV_SRC_ALPHA, UINT sampleCount = 1)
{
    Shaders[name] = loadShaderFromFile(shaderFile, destBlend, sampleCount);
    return Shaders[name];
}

// retrieves a stored shader
Shader& GetShader(std::string name)
{
    return Shaders[name];
}

// loads (and generates) a texture from file
Texture2D LoadTexture(const char* file, bool alpha, std::string name)
{
    Textures[name] = loadTextureFromFile(file, alpha);
    return Textures[name];
}

// retrieves a stored texture
Texture2D& GetTexture(std::string name)
{
    return Textures[name];
}

// properly de-allocates all loaded resources (ComPtr releases each object when it is erased)
void ClearResources()
{
    Shaders.clear();
    Textures.clear();
}

// SpriteRenderer (learnopengl: sprite_renderer.h, sprite_renderer.cpp)
// ---------------------------------------------------------------------
// renders textured quads (sprites) with one shader
struct SpriteRenderer
{
    // render state
    Shader                   shader;
    ComPtr<ID3D12Resource>   quadVertexBuffer;
    D3D12_VERTEX_BUFFER_VIEW quadVertexBufferView = {};
};

// the root constants of a sprite: what the shaders see as cbuffer SpriteConstants
struct SpriteConstants
{
    XMFLOAT4X4 model;
    XMFLOAT3   spriteColor;
};

// initializes and configures the quad's buffer and its view (learnopengl's SpriteRenderer constructor calls it)
void InitRenderData(SpriteRenderer& renderer)
{
    // the unit quad: two triangles with the corners (0, 0) to (1, 1) and their texture
    // coordinates (v = 0 is the image's top row, and y = 0 is the window's top)
    float vertices[] = {
        // pos      // tex
        0.0f, 1.0f, 0.0f, 1.0f,
        1.0f, 0.0f, 1.0f, 0.0f,
        0.0f, 0.0f, 0.0f, 0.0f,

        0.0f, 1.0f, 0.0f, 1.0f,
        1.0f, 1.0f, 1.0f, 1.0f,
        1.0f, 0.0f, 1.0f, 0.0f
    };

    // an upload heap, like the vertex buffers of the earlier chapters
    CD3DX12_HEAP_PROPERTIES heapProperties(D3D12_HEAP_TYPE_UPLOAD);
    CD3DX12_RESOURCE_DESC bufferDesc = CD3DX12_RESOURCE_DESC::Buffer(sizeof(vertices));
    ThrowIfFailed(Graphics.Device->CreateCommittedResource(
        &heapProperties,
        D3D12_HEAP_FLAG_NONE,
        &bufferDesc,
        D3D12_RESOURCE_STATE_GENERIC_READ,
        nullptr,
        IID_PPV_ARGS(&renderer.quadVertexBuffer)));

    UINT8* pVertexDataBegin = nullptr;
    CD3DX12_RANGE readRange(0, 0);        // We do not intend to read from this resource on the CPU.
    ThrowIfFailed(renderer.quadVertexBuffer->Map(0, &readRange, reinterpret_cast<void**>(&pVertexDataBegin)));
    memcpy(pVertexDataBegin, vertices, sizeof(vertices));
    renderer.quadVertexBuffer->Unmap(0, nullptr);

    renderer.quadVertexBufferView.BufferLocation = renderer.quadVertexBuffer->GetGPUVirtualAddress();
    renderer.quadVertexBufferView.StrideInBytes = 4 * sizeof(float);
    renderer.quadVertexBufferView.SizeInBytes = sizeof(vertices);
}

// renders a defined quad textured with given sprite (texture: the slot of its view in the heap)
void DrawSprite(SpriteRenderer& renderer, unsigned int texture, XMFLOAT2 position, XMFLOAT2 size = XMFLOAT2(10.0f, 10.0f), float rotate = 0.0f, XMFLOAT3 color = XMFLOAT3(1.0f, 1.0f, 1.0f))
{
    // prepare transformations (DirectXMath applies the matrices from left to right: first
    // scale, then rotation, and then final translation happens - learnopengl's reversed order)
    XMMATRIX model = XMMatrixScaling(size.x, size.y, 1.0f); // first scale

    model = model * XMMatrixTranslation(-0.5f * size.x, -0.5f * size.y, 0.0f);   // move origin of rotation to center of quad
    model = model * XMMatrixRotationZ(XMConvertToRadians(rotate));             // then rotate
    model = model * XMMatrixTranslation(0.5f * size.x, 0.5f * size.y, 0.0f);     // move origin back

    model = model * XMMatrixTranslation(position.x, position.y, 0.0f); // last translate

    SpriteConstants constants = {};
    XMStoreFloat4x4(&constants.model, XMMatrixTranspose(model));
    constants.spriteColor = color;

    // render textured quad: the shader, its root constants (root parameter 0) and the
    // texture's view (root parameter 2)
    Use(renderer.shader);
    Graphics.CommandList->SetGraphicsRoot32BitConstants(0, sizeof(SpriteConstants) / 4, &constants, 0);
    CD3DX12_GPU_DESCRIPTOR_HANDLE textureHandle(Graphics.SrvHeap->GetGPUDescriptorHandleForHeapStart(), texture, Graphics.SrvDescriptorSize);
    Graphics.CommandList->SetGraphicsRootDescriptorTable(2, textureHandle);

    Graphics.CommandList->IASetVertexBuffers(0, 1, &renderer.quadVertexBufferView);
    Graphics.CommandList->DrawInstanced(6, 1, 0, 0);
}

// GameObject (learnopengl: game_object.h, game_object.cpp)
// --------------------------------------------------------
// Container object for holding all state relevant for a single
// game object entity. Each object in the game likely needs the
// minimal of state as described within GameObject.
struct GameObject
{
    // object state
    XMFLOAT2     Position = XMFLOAT2(0.0f, 0.0f), Size = XMFLOAT2(1.0f, 1.0f), Velocity = XMFLOAT2(0.0f, 0.0f);
    XMFLOAT3     Color = XMFLOAT3(1.0f, 1.0f, 1.0f);
    float        Rotation = 0.0f;
    bool         IsSolid = false;
    bool         Destroyed = false;
    // render state
    unsigned int Sprite = 0; // the texture's ID (its view's slot in the heap)
};

// creates a game object (learnopengl's GameObject constructor)
GameObject MakeGameObject(XMFLOAT2 pos, XMFLOAT2 size, unsigned int sprite, XMFLOAT3 color = XMFLOAT3(1.0f, 1.0f, 1.0f), XMFLOAT2 velocity = XMFLOAT2(0.0f, 0.0f))
{
    GameObject obj;
    obj.Position = pos;
    obj.Size = size;
    obj.Velocity = velocity;
    obj.Color = color;
    obj.Sprite = sprite;
    return obj;
}

// draw sprite
void DrawObject(GameObject& obj, SpriteRenderer& renderer)
{
    DrawSprite(renderer, obj.Sprite, obj.Position, obj.Size, obj.Rotation, obj.Color);
}

// BallObject (learnopengl: ball_object.h, ball_object.cpp)
// --------------------------------------------------------
// BallObject holds the state of the Ball object inheriting
// relevant state data from GameObject. Contains some extra
// functionality specific to Hedgerow's ball object that
// were too specific for within GameObject alone.
struct BallObject : GameObject
{
    // ball state
    float Radius = 12.5f;
    bool  Stuck = true;
    bool  Sticky = false, PassThrough = false;
};

// creates a ball (learnopengl's BallObject constructor): its size is the circle's bounding square
BallObject MakeBallObject(XMFLOAT2 pos, float radius, XMFLOAT2 velocity, unsigned int sprite)
{
    BallObject ball;
    ball.Position = pos;
    ball.Size = XMFLOAT2(radius * 2.0f, radius * 2.0f);
    ball.Velocity = velocity;
    ball.Sprite = sprite;
    ball.Radius = radius;
    ball.Stuck = true;
    return ball;
}

// moves the ball, keeping it constrained within the window bounds (except bottom edge)
void Move(BallObject& ball, float dt, unsigned int window_width)
{
    // if not stuck to player board
    if (!ball.Stuck)
    {
        // move the ball (DirectXMath computes with XMVECTOR: load the stored XMFLOAT2s, compute, store)
        XMStoreFloat2(&ball.Position, XMLoadFloat2(&ball.Position) + XMLoadFloat2(&ball.Velocity) * dt);
        // then check if outside window bounds and if so, reverse velocity and restore at correct position
        if (ball.Position.x <= 0.0f)
        {
            ball.Velocity.x = -ball.Velocity.x;
            ball.Position.x = 0.0f;
        }
        else if (ball.Position.x + ball.Size.x >= window_width)
        {
            ball.Velocity.x = -ball.Velocity.x;
            ball.Position.x = window_width - ball.Size.x;
        }
        if (ball.Position.y <= 0.0f)
        {
            ball.Velocity.y = -ball.Velocity.y;
            ball.Position.y = 0.0f;
        }
    }
}

// resets the ball to initial Stuck Position (if ball is outside window bounds)
void Reset(BallObject& ball, XMFLOAT2 position, XMFLOAT2 velocity)
{
    ball.Position = position;
    ball.Velocity = velocity;
    ball.Stuck = true;
    ball.Sticky = false;
    ball.PassThrough = false;
}

// PowerUp (learnopengl: power_up.h)
// ---------------------------------
// The size of a PowerUp block
const XMFLOAT2 POWERUP_SIZE(60.0f, 20.0f);
// Velocity a PowerUp block has when spawned
const XMFLOAT2 VELOCITY(0.0f, 150.0f);

// PowerUp inherits its state and rendering functions from
// GameObject but also holds extra information to state its
// active duration and whether it is activated or not.
// The type of PowerUp is stored as a string.
struct PowerUp : GameObject
{
    // powerup state
    std::string Type;
    float       Duration = 0.0f;
    bool        Activated = false;
};

// creates a power-up (learnopengl's PowerUp constructor)
PowerUp MakePowerUp(std::string type, XMFLOAT3 color, float duration, XMFLOAT2 position, unsigned int sprite)
{
    PowerUp powerUp;
    powerUp.Position = position;
    powerUp.Size = POWERUP_SIZE;
    powerUp.Velocity = VELOCITY;
    powerUp.Color = color;
    powerUp.Sprite = sprite;
    powerUp.Type = type;
    powerUp.Duration = duration;
    powerUp.Activated = false;
    return powerUp;
}

// GameLevel (learnopengl: game_level.h, game_level.cpp)
// -----------------------------------------------------
/// GameLevel holds all Tiles as part of a level and
/// hosts functionality to Load/render levels from the harddisk.
struct GameLevel
{
    // level state
    std::vector<GameObject> Bricks;
};

// initialize level from tile data
void InitLevel(GameLevel& level, std::vector<std::vector<unsigned int>> tileData, unsigned int levelWidth, unsigned int levelHeight)
{
    // calculate dimensions
    unsigned int height = tileData.size();
    unsigned int width = tileData[0].size(); // note we can index vector at [0] since this function is only called if height > 0
    float unit_width = levelWidth / static_cast<float>(width), unit_height = levelHeight / static_cast<float>(height);
    // initialize level tiles based on tileData
    for (unsigned int y = 0; y < height; ++y)
    {
        for (unsigned int x = 0; x < width; ++x)
        {
            // check block type from level data (2D level array)
            if (tileData[y][x] == 1) // solid
            {
                XMFLOAT2 pos(unit_width * x, unit_height * y);
                XMFLOAT2 size(unit_width, unit_height);
                GameObject obj = MakeGameObject(pos, size, GetTexture("block_solid").ID, XMFLOAT3(0.8f, 0.8f, 0.7f));
                obj.IsSolid = true;
                level.Bricks.push_back(obj);
            }
            else if (tileData[y][x] > 1) // non-solid; now determine its color based on level data
            {
                XMFLOAT3 color = XMFLOAT3(1.0f, 1.0f, 1.0f); // original: white
                if (tileData[y][x] == 2)
                    color = XMFLOAT3(0.2f, 0.6f, 1.0f);
                else if (tileData[y][x] == 3)
                    color = XMFLOAT3(0.0f, 0.7f, 0.0f);
                else if (tileData[y][x] == 4)
                    color = XMFLOAT3(0.8f, 0.8f, 0.4f);
                else if (tileData[y][x] == 5)
                    color = XMFLOAT3(1.0f, 0.5f, 0.0f);

                XMFLOAT2 pos(unit_width * x, unit_height * y);
                XMFLOAT2 size(unit_width, unit_height);
                level.Bricks.push_back(MakeGameObject(pos, size, GetTexture("block").ID, color));
            }
        }
    }
}

// loads level from file
void LoadLevel(GameLevel& level, const char *file, unsigned int levelWidth, unsigned int levelHeight)
{
    // clear old data
    level.Bricks.clear();
    // load from file
    unsigned int tileCode;
    std::string line;
    std::ifstream fstream(file);
    std::vector<std::vector<unsigned int>> tileData;
    if (fstream)
    {
        while (std::getline(fstream, line)) // read each line from level file
        {
            std::istringstream sstream(line);
            std::vector<unsigned int> row;
            while (sstream >> tileCode) // read each word separated by spaces
                row.push_back(tileCode);
            tileData.push_back(row);
        }
        if (tileData.size() > 0)
            InitLevel(level, tileData, levelWidth, levelHeight);
    }
}

// check if the level is completed (all non-solid tiles are destroyed)
bool IsCompleted(GameLevel& level)
{
    for (GameObject& tile : level.Bricks)
        if (!tile.IsSolid && !tile.Destroyed)
            return false;
    return true;
}

// render level
void DrawLevel(GameLevel& level, SpriteRenderer& renderer)
{
    for (GameObject& tile : level.Bricks)
        if (!tile.Destroyed)
            DrawObject(tile, renderer);
}

// ParticleGenerator (learnopengl: particle_generator.h, particle_generator.cpp)
// -----------------------------------------------------------------------------
// Represents a single particle and its state
struct Particle
{
    XMFLOAT2 Position = XMFLOAT2(0.0f, 0.0f), Velocity = XMFLOAT2(0.0f, 0.0f);
    XMFLOAT4 Color = XMFLOAT4(1.0f, 1.0f, 1.0f, 1.0f);
    float    Life = 0.0f;
};

// ParticleGenerator acts as a container for rendering a large number of
// particles by repeatedly spawning and updating particles and killing
// them after a given amount of time.
struct ParticleGenerator
{
    // state
    std::vector<Particle>    particles;
    unsigned int             amount = 0;
    // render state
    Shader                   shader;
    unsigned int             texture = 0; // the texture's ID (its view's slot in the heap)
    ComPtr<ID3D12Resource>   quadVertexBuffer;
    D3D12_VERTEX_BUFFER_VIEW quadVertexBufferView = {};
};

// initializes the quad's buffer and its view and creates the particles (learnopengl's ParticleGenerator constructor calls it)
void InitParticles(ParticleGenerator& generator)
{
    // set up mesh and attribute properties: the same unit quad as the sprites, in an upload heap
    float particle_quad[] = {
        0.0f, 1.0f, 0.0f, 1.0f,
        1.0f, 0.0f, 1.0f, 0.0f,
        0.0f, 0.0f, 0.0f, 0.0f,

        0.0f, 1.0f, 0.0f, 1.0f,
        1.0f, 1.0f, 1.0f, 1.0f,
        1.0f, 0.0f, 1.0f, 0.0f
    };
    CD3DX12_HEAP_PROPERTIES heapProperties(D3D12_HEAP_TYPE_UPLOAD);
    CD3DX12_RESOURCE_DESC bufferDesc = CD3DX12_RESOURCE_DESC::Buffer(sizeof(particle_quad));
    ThrowIfFailed(Graphics.Device->CreateCommittedResource(
        &heapProperties,
        D3D12_HEAP_FLAG_NONE,
        &bufferDesc,
        D3D12_RESOURCE_STATE_GENERIC_READ,
        nullptr,
        IID_PPV_ARGS(&generator.quadVertexBuffer)));

    UINT8* pVertexDataBegin = nullptr;
    CD3DX12_RANGE readRange(0, 0);        // We do not intend to read from this resource on the CPU.
    ThrowIfFailed(generator.quadVertexBuffer->Map(0, &readRange, reinterpret_cast<void**>(&pVertexDataBegin)));
    memcpy(pVertexDataBegin, particle_quad, sizeof(particle_quad));
    generator.quadVertexBuffer->Unmap(0, nullptr);

    generator.quadVertexBufferView.BufferLocation = generator.quadVertexBuffer->GetGPUVirtualAddress();
    generator.quadVertexBufferView.StrideInBytes = 4 * sizeof(float);
    generator.quadVertexBufferView.SizeInBytes = sizeof(particle_quad);

    // create generator.amount default particle instances
    for (unsigned int i = 0; i < generator.amount; ++i)
        generator.particles.push_back(Particle());
}

// stores the index of the last particle used (for quick access to next dead particle)
unsigned int lastUsedParticle = 0;
// returns the first Particle index that's currently unused e.g. Life <= 0.0f or 0 if no particle is currently inactive
unsigned int firstUnusedParticle(ParticleGenerator& generator)
{
    // first search from last used particle, this will usually return almost instantly
    for (unsigned int i = lastUsedParticle; i < generator.amount; ++i)
    {
        if (generator.particles[i].Life <= 0.0f)
        {
            lastUsedParticle = i;
            return i;
        }
    }
    // otherwise, do a linear search
    for (unsigned int i = 0; i < lastUsedParticle; ++i)
    {
        if (generator.particles[i].Life <= 0.0f)
        {
            lastUsedParticle = i;
            return i;
        }
    }
    // all particles are taken, override the first one (note that if it repeatedly hits this case, more particles should be reserved)
    lastUsedParticle = 0;
    return 0;
}

// respawns particle
void respawnParticle(Particle& particle, GameObject& object, XMFLOAT2 offset = XMFLOAT2(0.0f, 0.0f))
{
    float random = ((rand() % 100) - 50) / 10.0f;
    float rColor = 0.5f + ((rand() % 100) / 100.0f);
    XMStoreFloat2(&particle.Position, XMLoadFloat2(&object.Position) + XMVectorReplicate(random) + XMLoadFloat2(&offset));
    particle.Color = XMFLOAT4(rColor, rColor, rColor, 1.0f);
    particle.Life = 1.0f;
    XMStoreFloat2(&particle.Velocity, XMLoadFloat2(&object.Velocity) * 0.1f);
}

// update all particles: spawn newParticles at the object, age and move the living ones
void Update(ParticleGenerator& generator, float dt, GameObject& object, unsigned int newParticles, XMFLOAT2 offset = XMFLOAT2(0.0f, 0.0f))
{
    // add new particles
    for (unsigned int i = 0; i < newParticles; ++i)
    {
        int unusedParticle = firstUnusedParticle(generator);
        respawnParticle(generator.particles[unusedParticle], object, offset);
    }
    // update all particles
    for (unsigned int i = 0; i < generator.amount; ++i)
    {
        Particle& p = generator.particles[i];
        p.Life -= dt; // reduce life
        if (p.Life > 0.0f)
        {   // particle is alive, thus update
            XMStoreFloat2(&p.Position, XMLoadFloat2(&p.Position) - XMLoadFloat2(&p.Velocity) * dt);
            p.Color.w -= dt * 2.5f;
        }
    }
}

// the root constants of a particle: what the particle shaders see as cbuffer ParticleConstants.
// HLSL packs a constant buffer in rows of 16 bytes and a float4 never straddles two rows: after
// the float2 offset, color starts in the next row - so the C++ struct pads 8 bytes before it
struct ParticleConstants
{
    XMFLOAT2 offset;
    XMFLOAT2 padding;
    XMFLOAT4 color;
};

// render all particles
void DrawParticles(ParticleGenerator& generator)
{
    // use additive blending to give it a 'glow' effect: the particle shader's pipeline state
    // blends with SRC_ALPHA and ONE (learnopengl's glBlendFunc(GL_SRC_ALPHA, GL_ONE)); the
    // sprites' pipeline state keeps its own blending, so nothing needs to be reset afterwards
    Use(generator.shader);
    for (Particle particle : generator.particles)
    {
        if (particle.Life > 0.0f)
        {
            ParticleConstants constants = {};
            constants.offset = particle.Position;
            constants.color = particle.Color;
            Graphics.CommandList->SetGraphicsRoot32BitConstants(0, sizeof(ParticleConstants) / 4, &constants, 0);
            CD3DX12_GPU_DESCRIPTOR_HANDLE textureHandle(Graphics.SrvHeap->GetGPUDescriptorHandleForHeapStart(), generator.texture, Graphics.SrvDescriptorSize);
            Graphics.CommandList->SetGraphicsRootDescriptorTable(2, textureHandle);
            Graphics.CommandList->IASetVertexBuffers(0, 1, &generator.quadVertexBufferView);
            Graphics.CommandList->DrawInstanced(6, 1, 0, 0);
        }
    }
}

// PostProcessor (learnopengl: post_processor.h, post_processor.cpp)
// -----------------------------------------------------------------
// PostProcessor hosts all PostProcessing effects for the Hedgerow
// Game. It renders the game on a textured quad after which one can
// enable specific effects by enabling either the Confuse, Chaos or
// Shake boolean.
// It is required to call BeginRender() before rendering the game
// and EndRender() after rendering the game for the struct to work.
struct PostProcessor
{
    // state
    Shader                       PostProcessingShader;
    Texture2D                    Texture;
    unsigned int                 Width = 0, Height = 0;
    // options
    bool                         Confuse = false, Chaos = false, Shake = false;
    // render state
    ComPtr<ID3D12Resource>       MSRenderTarget;  // the multisampled colour buffer the game is drawn into (learnopengl's MSFBO with its RBO)
    ComPtr<ID3D12DescriptorHeap> RtvHeap;         // its render target view
    ComPtr<ID3D12Resource>       quadVertexBuffer;
    D3D12_VERTEX_BUFFER_VIEW     quadVertexBufferView = {};
};

// initialize quad for rendering postprocessing texture
void InitRenderData(PostProcessor& effects)
{
    // the screen quad: the corners in normalized device coordinates (-1 to 1, y up) and the
    // texture coordinates (v = 0 is the texture's top row, which is the window's top row)
    float vertices[] = {
        // pos        // tex
        -1.0f, -1.0f, 0.0f, 1.0f,
         1.0f,  1.0f, 1.0f, 0.0f,
        -1.0f,  1.0f, 0.0f, 0.0f,

        -1.0f, -1.0f, 0.0f, 1.0f,
         1.0f, -1.0f, 1.0f, 1.0f,
         1.0f,  1.0f, 1.0f, 0.0f
    };

    // an upload heap, like the sprites' quad
    CD3DX12_HEAP_PROPERTIES heapProperties(D3D12_HEAP_TYPE_UPLOAD);
    CD3DX12_RESOURCE_DESC bufferDesc = CD3DX12_RESOURCE_DESC::Buffer(sizeof(vertices));
    ThrowIfFailed(Graphics.Device->CreateCommittedResource(
        &heapProperties,
        D3D12_HEAP_FLAG_NONE,
        &bufferDesc,
        D3D12_RESOURCE_STATE_GENERIC_READ,
        nullptr,
        IID_PPV_ARGS(&effects.quadVertexBuffer)));

    UINT8* pVertexDataBegin = nullptr;
    CD3DX12_RANGE readRange(0, 0);        // We do not intend to read from this resource on the CPU.
    ThrowIfFailed(effects.quadVertexBuffer->Map(0, &readRange, reinterpret_cast<void**>(&pVertexDataBegin)));
    memcpy(pVertexDataBegin, vertices, sizeof(vertices));
    effects.quadVertexBuffer->Unmap(0, nullptr);

    effects.quadVertexBufferView.BufferLocation = effects.quadVertexBuffer->GetGPUVirtualAddress();
    effects.quadVertexBufferView.StrideInBytes = 4 * sizeof(float);
    effects.quadVertexBufferView.SizeInBytes = sizeof(vertices);
}

// creates the render targets and the quad (learnopengl's PostProcessor constructor)
void InitPostProcessor(PostProcessor& effects, Shader shader, unsigned int width, unsigned int height)
{
    effects.PostProcessingShader = shader;
    effects.Width = width;
    effects.Height = height;
    // initialize the multisampled colour buffer: a texture with 4 samples per pixel that can
    // be a render target (don't need a depth/stencil buffer). Every Direct3D 11-class GPU can
    // draw 4 samples per pixel in this format; check it anyway.
    D3D12_FEATURE_DATA_MULTISAMPLE_QUALITY_LEVELS qualityLevels = {};
    qualityLevels.Format = DXGI_FORMAT_R8G8B8A8_UNORM;
    qualityLevels.SampleCount = 4;
    qualityLevels.Flags = D3D12_MULTISAMPLE_QUALITY_LEVELS_FLAG_NONE;
    ThrowIfFailed(Graphics.Device->CheckFeatureSupport(D3D12_FEATURE_MULTISAMPLE_QUALITY_LEVELS, &qualityLevels, sizeof(qualityLevels)));
    if (qualityLevels.NumQualityLevels == 0)
        throw std::runtime_error("ERROR::POSTPROCESSOR: Failed to initialize the multisampled render target");
    const float clearColor[] = { 0.0f, 0.0f, 0.0f, 1.0f };    // the colour BeginRender clears it to (fastest)
    CD3DX12_CLEAR_VALUE clearValue(DXGI_FORMAT_R8G8B8A8_UNORM, clearColor);
    CD3DX12_HEAP_PROPERTIES heapProperties(D3D12_HEAP_TYPE_DEFAULT);
    CD3DX12_RESOURCE_DESC msDesc = CD3DX12_RESOURCE_DESC::Tex2D(DXGI_FORMAT_R8G8B8A8_UNORM, width, height, 1, 1, 4, 0, D3D12_RESOURCE_FLAG_ALLOW_RENDER_TARGET);
    ThrowIfFailed(Graphics.Device->CreateCommittedResource(
        &heapProperties,
        D3D12_HEAP_FLAG_NONE,
        &msDesc,
        D3D12_RESOURCE_STATE_RENDER_TARGET,
        &clearValue,
        IID_PPV_ARGS(&effects.MSRenderTarget)));
    // its render target view, in a small RTV heap of its own
    D3D12_DESCRIPTOR_HEAP_DESC rtvHeapDesc = {};
    rtvHeapDesc.NumDescriptors = 1;
    rtvHeapDesc.Type = D3D12_DESCRIPTOR_HEAP_TYPE_RTV;
    rtvHeapDesc.Flags = D3D12_DESCRIPTOR_HEAP_FLAG_NONE;
    ThrowIfFailed(Graphics.Device->CreateDescriptorHeap(&rtvHeapDesc, IID_PPV_ARGS(&effects.RtvHeap)));
    Graphics.Device->CreateRenderTargetView(effects.MSRenderTarget.Get(), nullptr, effects.RtvHeap->GetCPUDescriptorHandleForHeapStart());
    // also initialize the texture to resolve the multisampled colour buffer into; used for
    // shader operations (for postprocessing effects): one sample per pixel, its view in the
    // next free slot of the CBV/SRV heap
    effects.Texture.ID = Graphics.SrvCount++;
    effects.Texture.Width = width;
    effects.Texture.Height = height;
    CD3DX12_RESOURCE_DESC textureDesc = CD3DX12_RESOURCE_DESC::Tex2D(effects.Texture.Internal_Format, width, height, 1, 1);
    ThrowIfFailed(Graphics.Device->CreateCommittedResource(
        &heapProperties,
        D3D12_HEAP_FLAG_NONE,
        &textureDesc,
        D3D12_RESOURCE_STATE_PIXEL_SHADER_RESOURCE,
        nullptr,
        IID_PPV_ARGS(&effects.Texture.Resource)));
    D3D12_SHADER_RESOURCE_VIEW_DESC srvDesc = {};
    srvDesc.Shader4ComponentMapping = D3D12_DEFAULT_SHADER_4_COMPONENT_MAPPING;
    srvDesc.Format = effects.Texture.Internal_Format;
    srvDesc.ViewDimension = D3D12_SRV_DIMENSION_TEXTURE2D;
    srvDesc.Texture2D.MipLevels = 1;
    CD3DX12_CPU_DESCRIPTOR_HANDLE srvHandle(Graphics.SrvHeap->GetCPUDescriptorHandleForHeapStart(), effects.Texture.ID, Graphics.SrvDescriptorSize);
    Graphics.Device->CreateShaderResourceView(effects.Texture.Resource.Get(), &srvDesc, srvHandle);
    // initialize render data (the kernels are constants in post_processing.hlsl)
    InitRenderData(effects);
}

// prepares the postprocessor's render target before rendering the game
void BeginRender(PostProcessor& effects)
{
    CD3DX12_CPU_DESCRIPTOR_HANDLE rtvHandle(effects.RtvHeap->GetCPUDescriptorHandleForHeapStart());
    Graphics.CommandList->OMSetRenderTargets(1, &rtvHandle, FALSE, nullptr);
    const float clearColor[] = { 0.0f, 0.0f, 0.0f, 1.0f };
    Graphics.CommandList->ClearRenderTargetView(rtvHandle, clearColor, 0, nullptr);
}

// should be called after rendering the game, so it stores all the rendered data into a texture object
void EndRender(PostProcessor& effects)
{
    // now resolve the multisampled colour buffer into the texture: each pixel gets the average
    // of its samples. The render target becomes the resolve's source, the texture its destination.
    CD3DX12_RESOURCE_BARRIER barriers[2] =
    {
        CD3DX12_RESOURCE_BARRIER::Transition(effects.MSRenderTarget.Get(), D3D12_RESOURCE_STATE_RENDER_TARGET, D3D12_RESOURCE_STATE_RESOLVE_SOURCE),
        CD3DX12_RESOURCE_BARRIER::Transition(effects.Texture.Resource.Get(), D3D12_RESOURCE_STATE_PIXEL_SHADER_RESOURCE, D3D12_RESOURCE_STATE_RESOLVE_DEST)
    };
    Graphics.CommandList->ResourceBarrier(_countof(barriers), barriers);
    Graphics.CommandList->ResolveSubresource(effects.Texture.Resource.Get(), 0, effects.MSRenderTarget.Get(), 0, effects.Texture.Internal_Format);
    // and back: the render target for the next frame, the texture for the pixel shader
    barriers[0] = CD3DX12_RESOURCE_BARRIER::Transition(effects.MSRenderTarget.Get(), D3D12_RESOURCE_STATE_RESOLVE_SOURCE, D3D12_RESOURCE_STATE_RENDER_TARGET);
    barriers[1] = CD3DX12_RESOURCE_BARRIER::Transition(effects.Texture.Resource.Get(), D3D12_RESOURCE_STATE_RESOLVE_DEST, D3D12_RESOURCE_STATE_PIXEL_SHADER_RESOURCE);
    Graphics.CommandList->ResourceBarrier(_countof(barriers), barriers);
    // draw into the back buffer again (learnopengl: the default framebuffer)
    Graphics.CommandList->OMSetRenderTargets(1, &Graphics.BackBufferRtv, FALSE, nullptr);
}

// the root constants of the postprocessing quad: what the postprocessing shaders see as
// cbuffer PostProcessingConstants (the bools as ints: 4 bytes each, like HLSL's)
struct PostProcessingConstants
{
    float time;
    int   confuse;
    int   chaos;
    int   shake;
};

// renders the PostProcessor texture quad (as a screen-encompassing large sprite)
void Render(PostProcessor& effects, float time)
{
    // set the shader and its options (root constants)
    Use(effects.PostProcessingShader);
    PostProcessingConstants constants = {};
    constants.time = time;
    constants.confuse = effects.Confuse;
    constants.chaos = effects.Chaos;
    constants.shake = effects.Shake;
    Graphics.CommandList->SetGraphicsRoot32BitConstants(0, sizeof(PostProcessingConstants) / 4, &constants, 0);
    // render textured quad
    CD3DX12_GPU_DESCRIPTOR_HANDLE textureHandle(Graphics.SrvHeap->GetGPUDescriptorHandleForHeapStart(), effects.Texture.ID, Graphics.SrvDescriptorSize);
    Graphics.CommandList->SetGraphicsRootDescriptorTable(2, textureHandle);
    Graphics.CommandList->IASetVertexBuffers(0, 1, &effects.quadVertexBufferView);
    Graphics.CommandList->DrawInstanced(6, 1, 0, 0);
}

// TextRenderer (learnopengl: text_renderer.h, text_renderer.cpp)
// ---------------------------------------------------------------
/// Holds all state information relevant to a character as loaded using FreeType
struct Character {
    XMINT2       AtlasPos;  // the glyph's place (top-left corner) in the glyph atlas, in texels
    XMINT2       Size;      // size of glyph
    XMINT2       Bearing;   // offset from baseline to left/top of glyph
    unsigned int Advance;   // horizontal offset to advance to next glyph
};

// The glyph atlas: one texture with all glyphs, in a grid of 16 x 8 cells of 64 x 64 texels
// (character c in cell (c % 16, c / 16)) - see the text rendering chapter.
const unsigned int AtlasCellSize = 64;
const unsigned int AtlasWidth = 16 * AtlasCellSize;
const unsigned int AtlasHeight = 8 * AtlasCellSize;
// Room for the quads of 256 characters a frame (6 vertices each).
const unsigned int MaxTextVertices = 6 * 256;

// A renderer for rendering text displayed by a font loaded using the
// FreeType library. A single font is loaded, processed into a list of Character
// items for later rendering.
struct TextRenderer
{
    // holds a list of pre-compiled Characters
    std::map<char, Character> Characters;
    // shader used for text rendering
    Shader                   TextShader;
    // render state
    Texture2D                Atlas;                 // the glyph atlas (its ID: its view's slot in the heap)
    ComPtr<ID3D12Resource>   VertexBuffer;          // the quads of this frame's text: an upload heap, mapped for good
    D3D12_VERTEX_BUFFER_VIEW VertexBufferView = {};
    UINT8*                   pVertexDataBegin = nullptr;
    unsigned int             VertexCount = 0;       // the vertices written into it this frame
};

// loads the text shader and creates the quads' vertex buffer (learnopengl's TextRenderer constructor)
void InitTextRenderer(TextRenderer& renderer, unsigned int width, unsigned int height)
{
    // load shader (its projection is the game's - 0 to width, 0 to height, y down -, the
    // constant buffer the game's OnUpdate writes, so there is nothing to configure here)
    renderer.TextShader = LoadShader(L"text_2d.hlsl", "text");
    // the vertex buffer for the texture quads: in an upload heap, mapped as long as it lives -
    // RenderText writes each frame's quads into it
    const UINT vertexBufferSize = MaxTextVertices * 4 * sizeof(float);
    CD3DX12_HEAP_PROPERTIES heapProperties(D3D12_HEAP_TYPE_UPLOAD);
    CD3DX12_RESOURCE_DESC bufferDesc = CD3DX12_RESOURCE_DESC::Buffer(vertexBufferSize);
    ThrowIfFailed(Graphics.Device->CreateCommittedResource(
        &heapProperties,
        D3D12_HEAP_FLAG_NONE,
        &bufferDesc,
        D3D12_RESOURCE_STATE_GENERIC_READ,
        nullptr,
        IID_PPV_ARGS(&renderer.VertexBuffer)));
    CD3DX12_RANGE readRange(0, 0);        // We do not intend to read from this resource on the CPU.
    ThrowIfFailed(renderer.VertexBuffer->Map(0, &readRange, reinterpret_cast<void**>(&renderer.pVertexDataBegin)));
    renderer.VertexBufferView.BufferLocation = renderer.VertexBuffer->GetGPUVirtualAddress();
    renderer.VertexBufferView.StrideInBytes = 4 * sizeof(float);
    renderer.VertexBufferView.SizeInBytes = vertexBufferSize;
}

// pre-compiles a list of characters from the given font into the glyph atlas
void Load(TextRenderer& renderer, std::string font, unsigned int fontSize)
{
    // first clear the previously loaded Characters
    renderer.Characters.clear();
    // then initialize and load the FreeType library
    FT_Library ft;
    if (FT_Init_FreeType(&ft)) // all functions return a value different than 0 whenever an error occurred
        throw std::runtime_error("ERROR::FREETYPE: Could not init FreeType Library");
    // load font as face
    FT_Face face;
    if (FT_New_Face(ft, font.c_str(), 0, &face))
        throw std::runtime_error("ERROR::FREETYPE: Failed to load font");
    // set size to load glyphs as
    FT_Set_Pixel_Sizes(face, 0, fontSize);
    // the atlas's texels on the CPU, one byte each (so no row alignment is needed: learnopengl's
    // GL_UNPACK_ALIGNMENT 1), all 0 (nothing covered) to begin with
    std::vector<unsigned char> atlas(AtlasWidth * AtlasHeight, 0);
    // then for the first 128 ASCII characters, pre-load/compile their characters and store them
    for (unsigned char c = 0; c < 128; c++)
    {
        // load character glyph
        if (FT_Load_Char(face, c, FT_LOAD_RENDER))
        {
            OutputDebugStringA("ERROR::FREETYPE: Failed to load Glyph\n");
            continue;
        }
        // the glyph's cell in the atlas: 16 characters a row; copy the bitmap into it row by
        // row (a row of the bitmap is pitch bytes long, a row of the atlas AtlasWidth bytes)
        int cellX = (c % 16) * AtlasCellSize;
        int cellY = (c / 16) * AtlasCellSize;
        for (unsigned int row = 0; row < face->glyph->bitmap.rows; row++)
        {
            memcpy(&atlas[(cellY + row) * AtlasWidth + cellX],
                face->glyph->bitmap.buffer + row * face->glyph->bitmap.pitch,
                face->glyph->bitmap.width);
        }
        // now store character for later use
        Character character = {
            XMINT2(cellX, cellY),
            XMINT2(face->glyph->bitmap.width, face->glyph->bitmap.rows),
            XMINT2(face->glyph->bitmap_left, face->glyph->bitmap_top),
            static_cast<unsigned int>(face->glyph->advance.x)
        };
        renderer.Characters.insert(std::pair<char, Character>(c, character));
    }
    // destroy FreeType once we're finished
    FT_Done_Face(face);
    FT_Done_FreeType(ft);

    // the atlas texture: one 8-bit channel (DXGI_FORMAT_R8_UNORM, learnopengl's GL_RED), in a
    // default heap, filled from an upload heap by the setup's command list, its view in the
    // next free slot of the CBV/SRV heap
    renderer.Atlas.ID = Graphics.SrvCount++;
    renderer.Atlas.Width = AtlasWidth;
    renderer.Atlas.Height = AtlasHeight;
    renderer.Atlas.Internal_Format = DXGI_FORMAT_R8_UNORM;
    CD3DX12_RESOURCE_DESC textureDesc = CD3DX12_RESOURCE_DESC::Tex2D(renderer.Atlas.Internal_Format, AtlasWidth, AtlasHeight, 1, 1);
    CD3DX12_HEAP_PROPERTIES heapProperties(D3D12_HEAP_TYPE_DEFAULT);
    ThrowIfFailed(Graphics.Device->CreateCommittedResource(
        &heapProperties,
        D3D12_HEAP_FLAG_NONE,
        &textureDesc,
        D3D12_RESOURCE_STATE_COPY_DEST,
        nullptr,
        IID_PPV_ARGS(&renderer.Atlas.Resource)));
    const UINT64 uploadBufferSize = GetRequiredIntermediateSize(renderer.Atlas.Resource.Get(), 0, 1);
    CD3DX12_HEAP_PROPERTIES uploadHeapProperties(D3D12_HEAP_TYPE_UPLOAD);
    CD3DX12_RESOURCE_DESC uploadBufferDesc = CD3DX12_RESOURCE_DESC::Buffer(uploadBufferSize);
    ThrowIfFailed(Graphics.Device->CreateCommittedResource(
        &uploadHeapProperties,
        D3D12_HEAP_FLAG_NONE,
        &uploadBufferDesc,
        D3D12_RESOURCE_STATE_GENERIC_READ,
        nullptr,
        IID_PPV_ARGS(&renderer.Atlas.UploadHeap)));
    D3D12_SUBRESOURCE_DATA textureData = {};
    textureData.pData = atlas.data();
    textureData.RowPitch = AtlasWidth;                         // bytes per row: 1 per texel
    textureData.SlicePitch = textureData.RowPitch * AtlasHeight;
    UpdateSubresources(Graphics.CommandList, renderer.Atlas.Resource.Get(), renderer.Atlas.UploadHeap.Get(), 0, 0, 1, &textureData);
    CD3DX12_RESOURCE_BARRIER barrier = CD3DX12_RESOURCE_BARRIER::Transition(renderer.Atlas.Resource.Get(), D3D12_RESOURCE_STATE_COPY_DEST, D3D12_RESOURCE_STATE_PIXEL_SHADER_RESOURCE);
    Graphics.CommandList->ResourceBarrier(1, &barrier);
    D3D12_SHADER_RESOURCE_VIEW_DESC srvDesc = {};
    srvDesc.Shader4ComponentMapping = D3D12_DEFAULT_SHADER_4_COMPONENT_MAPPING;
    srvDesc.Format = renderer.Atlas.Internal_Format;
    srvDesc.ViewDimension = D3D12_SRV_DIMENSION_TEXTURE2D;
    srvDesc.Texture2D.MipLevels = 1;
    CD3DX12_CPU_DESCRIPTOR_HANDLE srvHandle(Graphics.SrvHeap->GetCPUDescriptorHandleForHeapStart(), renderer.Atlas.ID, Graphics.SrvDescriptorSize);
    Graphics.Device->CreateShaderResourceView(renderer.Atlas.Resource.Get(), &srvDesc, srvHandle);
}

// the root constants of a line of text: what the text shaders see as cbuffer TextConstants
struct TextConstants
{
    XMFLOAT3 textColor;
};

// renders a string of text using the precompiled list of characters (x, y: its top-left corner)
void RenderText(TextRenderer& renderer, std::string text, float x, float y, float scale, XMFLOAT3 color = XMFLOAT3(1.0f, 1.0f, 1.0f))
{
    // activate corresponding render state: the shader, the colour (root constants), the atlas
    Use(renderer.TextShader);
    TextConstants constants = {};
    constants.textColor = color;
    Graphics.CommandList->SetGraphicsRoot32BitConstants(0, sizeof(TextConstants) / 4, &constants, 0);
    CD3DX12_GPU_DESCRIPTOR_HANDLE textureHandle(Graphics.SrvHeap->GetGPUDescriptorHandleForHeapStart(), renderer.Atlas.ID, Graphics.SrvDescriptorSize);
    Graphics.CommandList->SetGraphicsRootDescriptorTable(2, textureHandle);
    Graphics.CommandList->IASetVertexBuffers(0, 1, &renderer.VertexBufferView);

    // this line's quads come after the ones already written this frame
    unsigned int firstVertex = renderer.VertexCount;

    // iterate through all characters
    std::string::const_iterator c;
    for (c = text.begin(); c != text.end(); c++)
    {
        if (renderer.VertexCount + 6 > MaxTextVertices)
            break; // the vertex buffer is full
        Character ch = renderer.Characters[*c];

        float xpos = x + ch.Bearing.x * scale;
        float ypos = y + (renderer.Characters['H'].Bearing.y - ch.Bearing.y) * scale;

        float w = ch.Size.x * scale;
        float h = ch.Size.y * scale;
        // the glyph's rectangle in the atlas, in texture coordinates (v = 0 is the atlas's top
        // row, where each bitmap's top row is)
        float u0 = static_cast<float>(ch.AtlasPos.x) / AtlasWidth;
        float v0 = static_cast<float>(ch.AtlasPos.y) / AtlasHeight;
        float u1 = static_cast<float>(ch.AtlasPos.x + ch.Size.x) / AtlasWidth;
        float v1 = static_cast<float>(ch.AtlasPos.y + ch.Size.y) / AtlasHeight;
        // the character's quad
        float vertices[6][4] = {
            { xpos,     ypos + h,   u0, v1 },
            { xpos + w, ypos,       u1, v0 },
            { xpos,     ypos,       u0, v0 },

            { xpos,     ypos + h,   u0, v1 },
            { xpos + w, ypos + h,   u1, v1 },
            { xpos + w, ypos,       u1, v0 }
        };
        // write it into the vertex buffer after the ones before: the GPU reads the buffer only
        // when the command list executes, so every quad needs its own place (learnopengl
        // overwrites one quad with glBufferSubData before each draw)
        memcpy(renderer.pVertexDataBegin + renderer.VertexCount * 4 * sizeof(float), vertices, sizeof(vertices));
        renderer.VertexCount += 6;
        // now advance cursors for next glyph
        x += (ch.Advance >> 6) * scale; // bitshift by 6 to get value in pixels (1/64th times 2^6 = 64)
    }
    // render the line's quads: one draw for the whole line
    Graphics.CommandList->DrawInstanced(renderer.VertexCount - firstVertex, 1, firstVertex, 0);
}

// Game (learnopengl: game.h, game.cpp)
// ------------------------------------
// Represents the current state of the game
enum GameState {
    GAME_ACTIVE,
    GAME_MENU,
    GAME_WIN
};

// Represents the four possible (collision) directions
enum Direction {
    UP,
    RIGHT,
    DOWN,
    LEFT
};
// Defines a Collision typedef that represents collision data
typedef std::tuple<bool, Direction, XMFLOAT2> Collision; // <collision?, what direction?, difference vector center - closest point>

// Initial size of the player paddle
const XMFLOAT2 PLAYER_SIZE(100.0f, 20.0f);
// Initial velocity of the player paddle
const float PLAYER_VELOCITY(500.0f);
// Initial velocity of the Ball
const XMFLOAT2 INITIAL_BALL_VELOCITY(100.0f, -350.0f);
// Radius of the ball object
const float BALL_RADIUS = 12.5f;

// Game holds all game-related state.
// Combines all game-related data into a single struct for
// easy access to each of the components and manageability.
struct Game
{
    // game state
    GameState               State = GAME_MENU;
    bool                    Keys[1024] = {};
    bool                    KeysProcessed[1024] = {};
    unsigned int            Width = SCREEN_WIDTH, Height = SCREEN_HEIGHT;
    std::vector<GameLevel>  Levels;
    unsigned int            Level = 0;
    std::vector<PowerUp>    PowerUps;
    unsigned int            Lives = 3;
};

// Game-related State data
Game           Hedgerow;
SpriteRenderer Renderer;
GameObject     Player;
BallObject     Ball;
ParticleGenerator Particles;
PostProcessor  Effects;
TextRenderer   Text;

float ShakeTime = 0.0f;

// PowerUps (learnopengl: game.cpp)
// --------------------------------
// Check if another PowerUp of the same type is still active
// in which case we don't disable its effect (yet)
bool IsOtherPowerUpActive(std::vector<PowerUp>& powerUps, std::string type)
{
    for (const PowerUp& powerUp : powerUps)
    {
        if (powerUp.Activated)
            if (powerUp.Type == type)
                return true;
    }
    return false;
}

// moves the power-ups, counts down the active ones and removes the ones that are done
void UpdatePowerUps(Game& game, float dt)
{
    for (PowerUp& powerUp : game.PowerUps)
    {
        XMStoreFloat2(&powerUp.Position, XMLoadFloat2(&powerUp.Position) + XMLoadFloat2(&powerUp.Velocity) * dt);
        if (powerUp.Activated)
        {
            powerUp.Duration -= dt;

            if (powerUp.Duration <= 0.0f)
            {
                // remove powerup from list (will later be removed)
                powerUp.Activated = false;
                // deactivate effects
                if (powerUp.Type == "sticky")
                {
                    if (!IsOtherPowerUpActive(game.PowerUps, "sticky"))
                    {   // only reset if no other PowerUp of type sticky is active
                        Ball.Sticky = false;
                        Player.Color = XMFLOAT3(1.0f, 1.0f, 1.0f);
                    }
                }
                else if (powerUp.Type == "pass-through")
                {
                    if (!IsOtherPowerUpActive(game.PowerUps, "pass-through"))
                    {   // only reset if no other PowerUp of type pass-through is active
                        Ball.PassThrough = false;
                        Ball.Color = XMFLOAT3(1.0f, 1.0f, 1.0f);
                    }
                }
                else if (powerUp.Type == "confuse")
                {
                    if (!IsOtherPowerUpActive(game.PowerUps, "confuse"))
                    {   // only reset if no other PowerUp of type confuse is active
                        Effects.Confuse = false;
                    }
                }
                else if (powerUp.Type == "chaos")
                {
                    if (!IsOtherPowerUpActive(game.PowerUps, "chaos"))
                    {   // only reset if no other PowerUp of type chaos is active
                        Effects.Chaos = false;
                    }
                }
            }
        }
    }
    // Remove all PowerUps from vector that are destroyed AND !activated (thus either off the map or finished)
    // Note we use a lambda expression to remove each PowerUp which is destroyed and not activated
    game.PowerUps.erase(std::remove_if(game.PowerUps.begin(), game.PowerUps.end(),
        [](const PowerUp& powerUp) { return powerUp.Destroyed && !powerUp.Activated; }
    ), game.PowerUps.end());
}

// true with a chance of 1 in chance
bool ShouldSpawn(unsigned int chance)
{
    unsigned int random = rand() % chance;
    return random == 0;
}

// spawns power-ups (each with its own chance) at a destroyed block
void SpawnPowerUps(Game& game, GameObject& block)
{
    if (ShouldSpawn(75)) // 1 in 75 chance
        game.PowerUps.push_back(MakePowerUp("speed", XMFLOAT3(0.5f, 0.5f, 1.0f), 0.0f, block.Position, GetTexture("powerup_speed").ID));
    if (ShouldSpawn(75))
        game.PowerUps.push_back(MakePowerUp("sticky", XMFLOAT3(1.0f, 0.5f, 1.0f), 20.0f, block.Position, GetTexture("powerup_sticky").ID));
    if (ShouldSpawn(75))
        game.PowerUps.push_back(MakePowerUp("pass-through", XMFLOAT3(0.5f, 1.0f, 0.5f), 10.0f, block.Position, GetTexture("powerup_pass").ID));
    if (ShouldSpawn(75))
        game.PowerUps.push_back(MakePowerUp("pad-size-increase", XMFLOAT3(1.0f, 0.6f, 0.4f), 0.0f, block.Position, GetTexture("powerup_increase").ID));
    if (ShouldSpawn(15)) // Negative powerups should spawn more often
        game.PowerUps.push_back(MakePowerUp("confuse", XMFLOAT3(1.0f, 0.3f, 0.3f), 15.0f, block.Position, GetTexture("powerup_confuse").ID));
    if (ShouldSpawn(15))
        game.PowerUps.push_back(MakePowerUp("chaos", XMFLOAT3(0.9f, 0.25f, 0.25f), 15.0f, block.Position, GetTexture("powerup_chaos").ID));
}

// switches a power-up's effect on
void ActivatePowerUp(PowerUp& powerUp)
{
    if (powerUp.Type == "speed")
    {
        XMStoreFloat2(&Ball.Velocity, XMLoadFloat2(&Ball.Velocity) * 1.2f);
    }
    else if (powerUp.Type == "sticky")
    {
        Ball.Sticky = true;
        Player.Color = XMFLOAT3(1.0f, 0.5f, 1.0f);
    }
    else if (powerUp.Type == "pass-through")
    {
        Ball.PassThrough = true;
        Ball.Color = XMFLOAT3(1.0f, 0.5f, 0.5f);
    }
    else if (powerUp.Type == "pad-size-increase")
    {
        Player.Size.x += 50;
    }
    else if (powerUp.Type == "confuse")
    {
        if (!Effects.Chaos)
            Effects.Confuse = true; // only activate if chaos wasn't already active
    }
    else if (powerUp.Type == "chaos")
    {
        if (!Effects.Confuse)
            Effects.Chaos = true;
    }
}

// Collision detection (learnopengl: game.cpp)
// -------------------------------------------
// AABB - AABB collision
bool CheckCollision(GameObject& one, GameObject& two)
{
    // collision x-axis?
    bool collisionX = one.Position.x + one.Size.x >= two.Position.x &&
        two.Position.x + two.Size.x >= one.Position.x;
    // collision y-axis?
    bool collisionY = one.Position.y + one.Size.y >= two.Position.y &&
        two.Position.y + two.Size.y >= one.Position.y;
    // collision only if on both axes
    return collisionX && collisionY;
}

// calculates which direction a vector is facing (N,E,S or W)
Direction VectorDirection(XMFLOAT2 target)
{
    XMFLOAT2 compass[] = {
        XMFLOAT2(0.0f, 1.0f),  // up
        XMFLOAT2(1.0f, 0.0f),  // right
        XMFLOAT2(0.0f, -1.0f), // down
        XMFLOAT2(-1.0f, 0.0f)  // left
    };
    float max = 0.0f;
    unsigned int best_match = -1;
    for (unsigned int i = 0; i < 4; i++)
    {
        float dot_product = XMVectorGetX(XMVector2Dot(XMVector2Normalize(XMLoadFloat2(&target)), XMLoadFloat2(&compass[i])));
        if (dot_product > max)
        {
            max = dot_product;
            best_match = i;
        }
    }
    return (Direction)best_match;
}

// AABB - Circle collision
Collision CheckCollision(BallObject& one, GameObject& two)
{
    // get center point circle first (DirectXMath computes with XMVECTOR: load the stored XMFLOAT2s)
    XMVECTOR center = XMLoadFloat2(&one.Position) + XMVectorReplicate(one.Radius);
    // calculate AABB info (center, half-extents)
    XMVECTOR aabb_half_extents = XMVectorSet(two.Size.x / 2.0f, two.Size.y / 2.0f, 0.0f, 0.0f);
    XMVECTOR aabb_center = XMVectorSet(two.Position.x + two.Size.x / 2.0f, two.Position.y + two.Size.y / 2.0f, 0.0f, 0.0f);
    // get difference vector between both centers
    XMVECTOR difference = center - aabb_center;
    XMVECTOR clamped = XMVectorClamp(difference, -aabb_half_extents, aabb_half_extents);
    // add clamped value to AABB_center and we get the value of box closest to circle
    XMVECTOR closest = aabb_center + clamped;
    // retrieve vector between center circle and closest point AABB and check if length < radius
    difference = closest - center;

    if (XMVectorGetX(XMVector2Length(difference)) < one.Radius) // not <= since in that case a collision also occurs when object one exactly touches object two, which they are at the end of each collision resolution stage.
    {
        XMFLOAT2 diff;
        XMStoreFloat2(&diff, difference);
        return std::make_tuple(true, VectorDirection(diff), diff);
    }
    else
        return std::make_tuple(false, UP, XMFLOAT2(0.0f, 0.0f));
}

// destroys every brick the ball collides with (unless it is solid) and bounces the ball off bricks and the paddle
void DoCollisions(Game& game)
{
    for (GameObject& box : game.Levels[game.Level].Bricks)
    {
        if (!box.Destroyed)
        {
            Collision collision = CheckCollision(Ball, box);
            if (std::get<0>(collision)) // if collision is true
            {
                // destroy block if not solid
                if (!box.IsSolid)
                {
                    box.Destroyed = true;
                    SpawnPowerUps(game, box);
                }
                else
                {   // if block is solid, enable shake effect
                    ShakeTime = 0.05f;
                    Effects.Shake = true;
                }
                // collision resolution
                Direction dir = std::get<1>(collision);
                XMFLOAT2 diff_vector = std::get<2>(collision);
                if (!(Ball.PassThrough && !box.IsSolid)) // don't do collision resolution on non-solid bricks if pass-through is activated
                {
                    if (dir == LEFT || dir == RIGHT) // horizontal collision
                    {
                        Ball.Velocity.x = -Ball.Velocity.x; // reverse horizontal velocity
                        // relocate
                        float penetration = Ball.Radius - std::abs(diff_vector.x);
                        if (dir == LEFT)
                            Ball.Position.x += penetration; // move ball to right
                        else
                            Ball.Position.x -= penetration; // move ball to left;
                    }
                    else // vertical collision
                    {
                        Ball.Velocity.y = -Ball.Velocity.y; // reverse vertical velocity
                        // relocate
                        float penetration = Ball.Radius - std::abs(diff_vector.y);
                        if (dir == UP)
                            Ball.Position.y -= penetration; // move ball back up
                        else
                            Ball.Position.y += penetration; // move ball back down
                    }
                }
            }
        }
    }
    // also check collisions on PowerUps and if so, activate them
    for (PowerUp& powerUp : game.PowerUps)
    {
        if (!powerUp.Destroyed)
        {
            // first check if powerup passed bottom edge, if so: keep as inactive and destroy
            if (powerUp.Position.y >= game.Height)
                powerUp.Destroyed = true;

            if (CheckCollision(Player, powerUp))
            {   // collided with player, now activate powerup
                ActivatePowerUp(powerUp);
                powerUp.Destroyed = true;
                powerUp.Activated = true;
            }
        }
    }
    // and finally check collisions for player pad (unless stuck)
    Collision result = CheckCollision(Ball, Player);
    if (!Ball.Stuck && std::get<0>(result))
    {
        // check where it hit the board, and change velocity based on where it hit the board
        float centerBoard = Player.Position.x + Player.Size.x / 2.0f;
        float distance = (Ball.Position.x + Ball.Radius) - centerBoard;
        float percentage = distance / (Player.Size.x / 2.0f);
        // then move accordingly
        float strength = 2.0f;
        XMVECTOR oldVelocity = XMLoadFloat2(&Ball.Velocity);
        Ball.Velocity.x = INITIAL_BALL_VELOCITY.x * percentage * strength;
        // keep speed consistent over both axes (multiply by length of old velocity, so total strength is not changed)
        XMStoreFloat2(&Ball.Velocity, XMVector2Normalize(XMLoadFloat2(&Ball.Velocity)) * XMVector2Length(oldVelocity));
        // fix sticky paddle: always bounce upwards
        Ball.Velocity.y = -1.0f * std::abs(Ball.Velocity.y);
        // if Sticky powerup is activated, also stick ball to paddle once new velocity vectors were calculated
        Ball.Stuck = Ball.Sticky;
    }
}

// reloads the current level (every brick back in place)
void ResetLevel(Game& game)
{
    if (game.Level == 0)
        LoadLevel(game.Levels[0], "levels/one.lvl", game.Width, game.Height / 2);
    else if (game.Level == 1)
        LoadLevel(game.Levels[1], "levels/two.lvl", game.Width, game.Height / 2);
    else if (game.Level == 2)
        LoadLevel(game.Levels[2], "levels/three.lvl", game.Width, game.Height / 2);
    else if (game.Level == 3)
        LoadLevel(game.Levels[3], "levels/four.lvl", game.Width, game.Height / 2);

    game.Lives = 3;
}

// puts the paddle back at the bottom centre and the ball back on it (stuck)
void ResetPlayer(Game& game)
{
    // reset player/ball stats
    Player.Size = PLAYER_SIZE;
    Player.Position = XMFLOAT2(game.Width / 2.0f - PLAYER_SIZE.x / 2.0f, game.Height - PLAYER_SIZE.y);
    Reset(Ball, XMFLOAT2(Player.Position.x + PLAYER_SIZE.x / 2.0f - BALL_RADIUS, Player.Position.y - BALL_RADIUS * 2.0f), INITIAL_BALL_VELOCITY);
    // also disable all active powerups
    Effects.Chaos = Effects.Confuse = false;
    Ball.PassThrough = Ball.Sticky = false;
    Player.Color = XMFLOAT3(1.0f, 1.0f, 1.0f);
    Ball.Color = XMFLOAT3(1.0f, 1.0f, 1.0f);
}

// the time since the game started, in seconds (learnopengl's glfwGetTime()): the clock of
// OnUpdate's deltaTime, started at the first call
float GetTime()
{
    static auto startTime = std::chrono::high_resolution_clock::now();
    return std::chrono::duration<float, std::chrono::seconds::period>(std::chrono::high_resolution_clock::now() - startTime).count();
}

// initialize game state (load all shaders/textures/levels)
void Init(Game& game)
{
    // load shaders
    // (the game is drawn into the postprocessor's 4x multisampled render target: their pipeline
    // states must say so; the postprocessing quad is drawn into the window: 1 sample)
    LoadShader(L"sprite.hlsl", "sprite", D3D12_BLEND_INV_SRC_ALPHA, 4);
    LoadShader(L"particle.hlsl", "particle", D3D12_BLEND_ONE, 4);
    LoadShader(L"post_processing.hlsl", "postprocessing");
    // set render-specific controls
    Renderer.shader = GetShader("sprite");
    InitRenderData(Renderer);
    // load textures
    LoadTexture("textures/ball.png", true, "ball");
    LoadTexture("textures/background.png", false, "background");
    LoadTexture("textures/block.png", false, "block");
    LoadTexture("textures/block_solid.png", false, "block_solid");
    LoadTexture("textures/paddle.png", true, "paddle");
    LoadTexture("textures/particle.png", true, "particle");
    LoadTexture("textures/powerup_speed.png", true, "powerup_speed");
    LoadTexture("textures/powerup_sticky.png", true, "powerup_sticky");
    LoadTexture("textures/powerup_increase.png", true, "powerup_increase");
    LoadTexture("textures/powerup_confuse.png", true, "powerup_confuse");
    LoadTexture("textures/powerup_chaos.png", true, "powerup_chaos");
    LoadTexture("textures/powerup_pass.png", true, "powerup_pass");
    // set up the particle generator (learnopengl's ParticleGenerator constructor): 500 particles
    Particles.shader = GetShader("particle");
    Particles.texture = GetTexture("particle").ID;
    Particles.amount = 500;
    InitParticles(Particles);
    // set up the postprocessor (learnopengl's PostProcessor constructor)
    InitPostProcessor(Effects, GetShader("postprocessing"), game.Width, game.Height);
    // set up the text renderer (learnopengl's TextRenderer constructor) and load the font at 24 pixels
    InitTextRenderer(Text, game.Width, game.Height);
    Load(Text, "fonts/Inter-Bold.otf", 24);
    // load levels
    GameLevel one; LoadLevel(one, "levels/one.lvl", game.Width, game.Height / 2);
    GameLevel two; LoadLevel(two, "levels/two.lvl", game.Width, game.Height / 2);
    GameLevel three; LoadLevel(three, "levels/three.lvl", game.Width, game.Height / 2);
    GameLevel four; LoadLevel(four, "levels/four.lvl", game.Width, game.Height / 2);
    game.Levels.push_back(one);
    game.Levels.push_back(two);
    game.Levels.push_back(three);
    game.Levels.push_back(four);
    game.Level = 0;
    // configure game objects
    XMFLOAT2 playerPos = XMFLOAT2(game.Width / 2.0f - PLAYER_SIZE.x / 2.0f, game.Height - PLAYER_SIZE.y);
    Player = MakeGameObject(playerPos, PLAYER_SIZE, GetTexture("paddle").ID);
    XMFLOAT2 ballPos = XMFLOAT2(playerPos.x + PLAYER_SIZE.x / 2.0f - BALL_RADIUS, playerPos.y - BALL_RADIUS * 2.0f);
    Ball = MakeBallObject(ballPos, BALL_RADIUS, INITIAL_BALL_VELOCITY, GetTexture("ball").ID);
}

// game loop
void ProcessInput(Game& game, float dt)
{
    if (game.State == GAME_MENU)
    {
        if (game.Keys[VK_RETURN] && !game.KeysProcessed[VK_RETURN])
        {
            game.State = GAME_ACTIVE;
            game.KeysProcessed[VK_RETURN] = true;
        }
        if (game.Keys['W'] && !game.KeysProcessed['W'])
        {
            game.Level = (game.Level + 1) % 4;
            game.KeysProcessed['W'] = true;
        }
        if (game.Keys['S'] && !game.KeysProcessed['S'])
        {
            if (game.Level > 0)
                --game.Level;
            else
                game.Level = 3;
            game.KeysProcessed['S'] = true;
        }
    }
    if (game.State == GAME_WIN)
    {
        if (game.Keys[VK_RETURN])
        {
            game.KeysProcessed[VK_RETURN] = true;
            Effects.Chaos = false;
            game.State = GAME_MENU;
        }
    }
    if (game.State == GAME_ACTIVE)
    {
        float velocity = PLAYER_VELOCITY * dt;
        // move playerboard
        if (game.Keys['A'])
        {
            if (Player.Position.x >= 0.0f)
            {
                Player.Position.x -= velocity;
                if (Ball.Stuck)
                    Ball.Position.x -= velocity;
            }
        }
        if (game.Keys['D'])
        {
            if (Player.Position.x <= game.Width - Player.Size.x)
            {
                Player.Position.x += velocity;
                if (Ball.Stuck)
                    Ball.Position.x += velocity;
            }
        }
        // release the ball
        if (game.Keys[VK_SPACE])
            Ball.Stuck = false;
    }
}

void Update(Game& game, float dt)
{
    // update objects
    Move(Ball, dt, game.Width);
    // check for collisions
    DoCollisions(game);
    // update particles
    Update(Particles, dt, Ball, 2, XMFLOAT2(Ball.Radius / 2.0f, Ball.Radius / 2.0f));
    // update PowerUps
    UpdatePowerUps(game, dt);
    // reduce shake time
    if (ShakeTime > 0.0f)
    {
        ShakeTime -= dt;
        if (ShakeTime <= 0.0f)
            Effects.Shake = false;
    }
    // check loss condition
    if (Ball.Position.y >= game.Height) // did ball reach bottom edge?
    {
        --game.Lives;
        // did the player lose all his lives? : game over
        if (game.Lives == 0)
        {
            ResetLevel(game);
            game.State = GAME_MENU;
        }
        ResetPlayer(game);
    }
    // check win condition
    if (game.State == GAME_ACTIVE && IsCompleted(game.Levels[game.Level]))
    {
        ResetLevel(game);
        ResetPlayer(game);
        Effects.Chaos = true;
        game.State = GAME_WIN;
    }
}

void Render(Game& game)
{
    // the text's quads of this frame start at the vertex buffer's beginning (the GPU has finished the last frame)
    Text.VertexCount = 0;
    if (game.State == GAME_ACTIVE || game.State == GAME_MENU || game.State == GAME_WIN)
    {
        // begin rendering to postprocessing render target
        BeginRender(Effects);
        // draw background
        DrawSprite(Renderer, GetTexture("background").ID, XMFLOAT2(0.0f, 0.0f), XMFLOAT2(static_cast<float>(game.Width), static_cast<float>(game.Height)), 0.0f);
        // draw level
        DrawLevel(game.Levels[game.Level], Renderer);
        // draw player
        DrawObject(Player, Renderer);
        // draw PowerUps
        for (PowerUp& powerUp : game.PowerUps)
            if (!powerUp.Destroyed)
                DrawObject(powerUp, Renderer);
        // draw particles
        DrawParticles(Particles);
        // draw ball
        DrawObject(Ball, Renderer);
        // end rendering to postprocessing render target
        EndRender(Effects);
        // render postprocessing quad
        Render(Effects, GetTime());
        // render text (don't include in postprocessing)
        RenderText(Text, "Lives:" + std::to_string(game.Lives), 5.0f, 5.0f, 1.0f);
    }
    if (game.State == GAME_MENU)
    {
        RenderText(Text, "Press ENTER to start", 250.0f, game.Height / 2.0f, 1.0f);
        RenderText(Text, "Press W or S to select level", 245.0f, game.Height / 2.0f + 20.0f, 0.75f);
    }
    if (game.State == GAME_WIN)
    {
        RenderText(Text, "You WON!!!", 320.0f, game.Height / 2.0f - 20.0f, 1.0f, XMFLOAT3(0.0f, 1.0f, 0.0f));
        RenderText(Text, "Press ENTER to retry or ESC to quit", 130.0f, game.Height / 2.0f, 1.0f, XMFLOAT3(1.0f, 1.0f, 0.0f));
    }
}

// Program (learnopengl: program.cpp)
// ----------------------------------
// The window procedure calls these with each key press and release (virtual-key codes,
// 'A' ... 'Z', VK_SPACE ...; the same numbers as GLFW's keys for the letters and the space).
void OnKeyDown(UINT8 key)
{
    Hedgerow.Keys[key] = true;
}

void OnKeyUp(UINT8 key)
{
    Hedgerow.Keys[key] = false;
    Hedgerow.KeysProcessed[key] = false;
}

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

    // Room in the CBV/SRV heap: the constant buffer view and the game's textures.
    static const UINT MaxDescriptors = 32;

    // The constant buffer: what the vertex shader sees as cbuffer SceneConstantBuffer.
    struct SceneConstantBuffer
    {
        XMFLOAT4X4 projection;
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
    ComPtr<ID3D12DescriptorHeap> m_cbvSrvHeap;
    ComPtr<ID3D12GraphicsCommandList> m_commandList;
    UINT m_rtvDescriptorSize = 0;
    UINT m_cbvSrvDescriptorSize = 0;

    // App resources.
    ComPtr<ID3D12Resource> m_constantBuffer;
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

        // Describe and create a shader resource view (SRV) and constant buffer view
        // (CBV) heap. Shader visible: the shaders can read the descriptors in it.
        D3D12_DESCRIPTOR_HEAP_DESC cbvSrvHeapDesc = {};
        cbvSrvHeapDesc.NumDescriptors = MaxDescriptors;
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
    // Create the root signature: what the game's shaders read besides the vertices.
    {
        // Descriptor ranges: 1 CBV at register b1, for the table of root parameter 1, and
        // 1 SRV at register t0 (the texture of the draw), for root parameter 2.
        CD3DX12_DESCRIPTOR_RANGE ranges[2];
        ranges[0].Init(D3D12_DESCRIPTOR_RANGE_TYPE_CBV, 1, 1);
        ranges[1].Init(D3D12_DESCRIPTOR_RANGE_TYPE_SRV, 1, 0);

        // Root parameter 0: 19 root constants for register b0 (a sprite's model matrix: 16,
        // and colour: 3), for both shaders.
        // Root parameter 1: a descriptor table with the constant buffer view (b1: the
        // projection), for the vertex shader.
        // Root parameter 2: a descriptor table with the texture's SRV, for the pixel shader.
        // Each draw points it at the SRV of its own texture (like glBindTexture).
        CD3DX12_ROOT_PARAMETER rootParameters[3];
        rootParameters[0].InitAsConstants(19, 0, 0, D3D12_SHADER_VISIBILITY_ALL);
        rootParameters[1].InitAsDescriptorTable(1, &ranges[0], D3D12_SHADER_VISIBILITY_VERTEX);
        rootParameters[2].InitAsDescriptorTable(1, &ranges[1], D3D12_SHADER_VISIBILITY_PIXEL);

        // A static sampler is part of the root signature itself (no descriptor needed).
        // Sampler s0: linear filtering; texture coordinates outside 0..1 wrap around
        // (learnopengl's Texture2D defaults: GL_LINEAR, GL_REPEAT).
        D3D12_STATIC_SAMPLER_DESC sampler = {};
        sampler.Filter = D3D12_FILTER_MIN_MAG_MIP_LINEAR;
        sampler.AddressU = D3D12_TEXTURE_ADDRESS_MODE_WRAP;
        sampler.AddressV = D3D12_TEXTURE_ADDRESS_MODE_WRAP;
        sampler.AddressW = D3D12_TEXTURE_ADDRESS_MODE_WRAP;
        sampler.MipLODBias = 0;
        sampler.MaxAnisotropy = 0;
        sampler.ComparisonFunc = D3D12_COMPARISON_FUNC_NEVER;
        sampler.BorderColor = D3D12_STATIC_BORDER_COLOR_TRANSPARENT_BLACK;
        sampler.MinLOD = 0.0f;
        sampler.MaxLOD = D3D12_FLOAT32_MAX;
        sampler.ShaderRegister = 0;
        sampler.RegisterSpace = 0;
        sampler.ShaderVisibility = D3D12_SHADER_VISIBILITY_PIXEL;

        CD3DX12_ROOT_SIGNATURE_DESC rootSignatureDesc;
        rootSignatureDesc.Init(_countof(rootParameters), rootParameters, 1, &sampler, D3D12_ROOT_SIGNATURE_FLAG_ALLOW_INPUT_ASSEMBLER_INPUT_LAYOUT);

        ComPtr<ID3DBlob> signature;
        ComPtr<ID3DBlob> error;
        ThrowIfFailed(D3D12SerializeRootSignature(&rootSignatureDesc, D3D_ROOT_SIGNATURE_VERSION_1, &signature, &error));
        ThrowIfFailed(m_device->CreateRootSignature(0, signature->GetBufferPointer(), signature->GetBufferSize(), IID_PPV_ARGS(&m_rootSignature)));
    }

    // Create the command list, without a pipeline state (the game's shaders set theirs).
    ThrowIfFailed(m_device->CreateCommandList(0, D3D12_COMMAND_LIST_TYPE_DIRECT, m_commandAllocator.Get(), nullptr, IID_PPV_ARGS(&m_commandList)));

    // Command lists are created in the recording state. This one stays open until the
    // end of LoadAssets, where it is closed and executed once: the game's textures are
    // uploaded with it.

    // Create the constant buffer.
    {
        const UINT constantBufferSize = CalculateConstantBufferByteSize(sizeof(SceneConstantBuffer));    // CB size is required to be 256-byte aligned.

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
        CD3DX12_RANGE readRange(0, 0);        // We do not intend to read from this resource on the CPU.
        ThrowIfFailed(m_constantBuffer->Map(0, &readRange, reinterpret_cast<void**>(&m_pCbvDataBegin)));
    }

    // What the game creates its resources with and draws with.
    Graphics.Device = m_device.Get();
    Graphics.CommandList = m_commandList.Get();
    Graphics.RootSignature = m_rootSignature.Get();
    Graphics.SrvHeap = m_cbvSrvHeap.Get();
    Graphics.SrvDescriptorSize = m_cbvSrvDescriptorSize;

    // initialize game
    // ---------------
    Init(Hedgerow);

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
    }
}

// Update frame-based values: the game loop's input and update steps.
void D3D12App::OnUpdate()
{
    // calculate delta time: the time since the last frame, in seconds
    // --------------------
    static auto lastFrame = std::chrono::high_resolution_clock::now();
    auto currentFrame = std::chrono::high_resolution_clock::now();
    float deltaTime = std::chrono::duration<float, std::chrono::seconds::period>(currentFrame - lastFrame).count();
    lastFrame = currentFrame;

    // manage user input
    // -----------------
    ProcessInput(Hedgerow, deltaTime);

    // update game state
    // -----------------
    Update(Hedgerow, deltaTime);

    // configure shaders: the orthographic projection - x from 0 (left) to Width, y from
    // 0 (top) to Height (bottom), learnopengl's glm::ortho(0, Width, Height, 0, -1, 1)
    XMMATRIX projection = XMMatrixOrthographicOffCenterRH(0.0f, static_cast<float>(Hedgerow.Width), static_cast<float>(Hedgerow.Height), 0.0f, -1.0f, 1.0f);
    SceneConstantBuffer constantBufferData = {};
    XMStoreFloat4x4(&constantBufferData.projection, XMMatrixTranspose(projection));
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

    // delete all resources as loaded using the resource manager
    // ---------------------------------------------------------
    ClearResources();
    Renderer = SpriteRenderer();
    Particles = ParticleGenerator();
    Effects = PostProcessor();
    Text = TextRenderer();

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
    // re-recording. (No pipeline state yet: the game's shaders set theirs.)
    ThrowIfFailed(m_commandList->Reset(m_commandAllocator.Get(), nullptr));

    // Set necessary state.
    m_commandList->SetGraphicsRootSignature(m_rootSignature.Get());

    // The CBV/SRV heap the descriptor tables point into, and root parameter 1: the
    // table with the constant buffer view, the heap's first descriptor.
    ID3D12DescriptorHeap* ppHeaps[] = { m_cbvSrvHeap.Get() };
    m_commandList->SetDescriptorHeaps(_countof(ppHeaps), ppHeaps);
    m_commandList->SetGraphicsRootDescriptorTable(1, m_cbvSrvHeap->GetGPUDescriptorHandleForHeapStart());

    m_commandList->RSSetViewports(1, &m_viewport);
    m_commandList->RSSetScissorRects(1, &m_scissorRect);

    // Indicate that the back buffer will be used as a render target.
    CD3DX12_RESOURCE_BARRIER barrier = CD3DX12_RESOURCE_BARRIER::Transition(m_renderTargets[m_frameIndex].Get(), D3D12_RESOURCE_STATE_PRESENT, D3D12_RESOURCE_STATE_RENDER_TARGET);
    m_commandList->ResourceBarrier(1, &barrier);

    CD3DX12_CPU_DESCRIPTOR_HANDLE rtvHandle(m_rtvHeap->GetCPUDescriptorHandleForHeapStart(), m_frameIndex, m_rtvDescriptorSize);
    m_commandList->OMSetRenderTargets(1, &rtvHandle, FALSE, nullptr);

    // render
    // ------
    const float clearColor[] = { 0.0f, 0.0f, 0.0f, 1.0f };
    m_commandList->ClearRenderTargetView(rtvHandle, clearColor, 0, nullptr);
    m_commandList->IASetPrimitiveTopology(D3D_PRIMITIVE_TOPOLOGY_TRIANGLELIST);
    Graphics.BackBufferRtv = rtvHandle;
    Render(Hedgerow);

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

// Main message handler for the window.
LRESULT CALLBACK WindowProc(HWND hWnd, UINT message, WPARAM wParam, LPARAM lParam)
{
    switch (message)
    {
    case WM_KEYDOWN:
        // when a user presses the escape key, close the window (and so the application)
        if (wParam == VK_ESCAPE)
        {
            DestroyWindow(hWnd);
        }
        OnKeyDown(static_cast<UINT8>(wParam));
        return 0;

    case WM_KEYUP:
        OnKeyUp(static_cast<UINT8>(wParam));
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
    // Initialize the window class.
    WNDCLASSEXW windowClass = {};
    windowClass.cbSize = sizeof(WNDCLASSEXW);
    windowClass.style = CS_HREDRAW | CS_VREDRAW;
    windowClass.lpfnWndProc = WindowProc;
    windowClass.hInstance = hInstance;
    windowClass.hCursor = LoadCursor(nullptr, IDC_ARROW);
    windowClass.lpszClassName = L"DXSampleClass";
    RegisterClassExW(&windowClass);

    // The window is bigger than the area we draw in (title bar, borders): compute the
    // window size for a client area of SCREEN_WIDTH x SCREEN_HEIGHT. Not resizable
    // (learnopengl's GLFW_RESIZABLE false): no maximize box, no sizing border.
    const DWORD style = WS_OVERLAPPEDWINDOW & ~(WS_THICKFRAME | WS_MAXIMIZEBOX);
    RECT windowRect = { 0, 0, static_cast<LONG>(SCREEN_WIDTH), static_cast<LONG>(SCREEN_HEIGHT) };
    AdjustWindowRect(&windowRect, style, FALSE);

    // Create the window and store a handle to it.
    HWND hwnd = CreateWindowW(
        windowClass.lpszClassName,
        L"Hedgerow",
        style,
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

    D3D12App app(SCREEN_WIDTH, SCREEN_HEIGHT);
    try
    {
        app.OnInit(hwnd);

        ShowWindow(hwnd, nCmdShow);

        // The game loop: process the window's messages until the window is closed
        // (WM_QUIT); when none are waiting, update and render a frame.
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
