// A Direct3D 12 program in one file, modelled on Microsoft's D3D12HelloWorld samples
// (D3D12HelloWindow, D3D12HelloTriangle, D3D12HelloTexture, D3D12HelloConstBuffers),
// the depth buffer of the D3D12Bundles sample and the shadow map of the D3D12Multithreading
// sample: a room with five cubes in it, lit by a point light in the middle.

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

#include <chrono>
#include <climits>
#include <cmath>
#include <cstdio>
#include <cstring>
#include <stdexcept>
#include <string>

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

// The light's position (learnopengl: glm::vec3 lightPos(0.0f, 0.0f, 0.0f)): a point light in
// the middle of the room. learnopengl moves it back and forth every frame
// (lightPos.z = sin(glfwGetTime() * 0.5) * 3.0); here it stays still.
XMFLOAT3 lightPos(0.0f, 0.0f, 0.0f);

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
    static const UINT SHADOW_WIDTH = 1024, SHADOW_HEIGHT = 1024;    // the size of each face of the depth cubemap, in texels

    struct Vertex
    {
        XMFLOAT3 position;
        XMFLOAT3 normal;
        XMFLOAT2 texCoord;
    };

    // The root constants: what the vertex shaders see as cbuffer ModelConstants. Two 4x4
    // matrices and a BOOL are 33 32-bit values: 33 32-bit root constants.
    struct ModelConstants
    {
        XMFLOAT4X4 model;
        XMFLOAT4X4 normalMatrix;    // transpose(inverse(model)), for the normals
        BOOL reverseNormals;        // TRUE: the normals point the other way (learnopengl's reverse_normals)
    };

    // The constant buffer: what the shaders see as cbuffer SceneConstantBuffer. Laid out
    // as HLSL packs it: a float3 never crosses a 16-byte row, so lightPos starts a new row;
    // far_plane fills the rest of viewPos's row, a float of padding the rest of lightPos's.
    struct SceneConstantBuffer
    {
        XMFLOAT4X4 view;
        XMFLOAT4X4 projection;
        XMFLOAT4X4 shadowMatrices[6];    // the light's view and projection, one per cube face
        XMFLOAT3 viewPos;
        float far_plane;                 // the depth cubemap holds distance / far_plane
        XMFLOAT3 lightPos;
        float padding1;
    };

    UINT m_width;
    UINT m_height;
    HWND m_hwnd = nullptr;

    // Pipeline objects.
    CD3DX12_VIEWPORT m_viewport;
    CD3DX12_RECT m_scissorRect;
    CD3DX12_VIEWPORT m_shadowViewport;    // the depth pass draws into whole cube faces
    CD3DX12_RECT m_shadowScissorRect;
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
    ComPtr<ID3D12PipelineState> m_depthPipelineState;    // the depth pass's (learnopengl's simpleDepthShader)
    ComPtr<ID3D12GraphicsCommandList> m_commandList;
    UINT m_rtvDescriptorSize = 0;
    UINT m_cbvSrvDescriptorSize = 0;
    UINT m_dsvDescriptorSize = 0;

    // App resources.
    ComPtr<ID3D12Resource> m_vertexBuffer;
    D3D12_VERTEX_BUFFER_VIEW m_vertexBufferView = {};
    ComPtr<ID3D12Resource> m_woodTexture;
    ComPtr<ID3D12Resource> m_constantBuffer;
    ComPtr<ID3D12Resource> m_depthStencil;
    ComPtr<ID3D12Resource> m_depthCubemap;    // the distance to the closest surface in every direction from the light
    UINT8* m_pCbvDataBegin = nullptr;    // where the constant buffer is mapped (CPU address)

    // Synchronization objects.
    UINT m_frameIndex = 0;
    HANDLE m_fenceEvent = nullptr;
    ComPtr<ID3D12Fence> m_fence;
    UINT64 m_fenceValue = 0;

    void LoadPipeline();
    void LoadAssets();
    void PopulateCommandList();
    void RenderScene();
    void WaitForPreviousFrame();
    void GetHardwareAdapter(IDXGIFactory1* pFactory, IDXGIAdapter1** ppAdapter);
    void LoadTexture(const char* path, ComPtr<ID3D12Resource>& texture, ComPtr<ID3D12Resource>& uploadHeap, UINT descriptorIndex);
};

D3D12App::D3D12App(UINT width, UINT height) :
    m_width(width),
    m_height(height),
    m_viewport(0.0f, 0.0f, static_cast<float>(width), static_cast<float>(height)),
    m_scissorRect(0, 0, static_cast<LONG>(width), static_cast<LONG>(height)),
    m_shadowViewport(0.0f, 0.0f, static_cast<float>(SHADOW_WIDTH), static_cast<float>(SHADOW_HEIGHT)),
    m_shadowScissorRect(0, 0, static_cast<LONG>(SHADOW_WIDTH), static_cast<LONG>(SHADOW_HEIGHT))
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
        dsvHeapDesc.NumDescriptors = 2;    // the depth buffer + the depth cubemap
        dsvHeapDesc.Type = D3D12_DESCRIPTOR_HEAP_TYPE_DSV;
        dsvHeapDesc.Flags = D3D12_DESCRIPTOR_HEAP_FLAG_NONE;
        ThrowIfFailed(m_device->CreateDescriptorHeap(&dsvHeapDesc, IID_PPV_ARGS(&m_dsvHeap)));

        // Describe and create a shader resource view (SRV) and constant buffer view
        // (CBV) heap. Shader visible: the shaders can read the descriptors in it.
        D3D12_DESCRIPTOR_HEAP_DESC cbvSrvHeapDesc = {};
        cbvSrvHeapDesc.NumDescriptors = 3;    // one CBV + the wood texture's SRV + the depth cubemap's SRV
        cbvSrvHeapDesc.Type = D3D12_DESCRIPTOR_HEAP_TYPE_CBV_SRV_UAV;
        cbvSrvHeapDesc.Flags = D3D12_DESCRIPTOR_HEAP_FLAG_SHADER_VISIBLE;
        ThrowIfFailed(m_device->CreateDescriptorHeap(&cbvSrvHeapDesc, IID_PPV_ARGS(&m_cbvSrvHeap)));

        m_rtvDescriptorSize = m_device->GetDescriptorHandleIncrementSize(D3D12_DESCRIPTOR_HEAP_TYPE_RTV);
        m_cbvSrvDescriptorSize = m_device->GetDescriptorHandleIncrementSize(D3D12_DESCRIPTOR_HEAP_TYPE_CBV_SRV_UAV);
        m_dsvDescriptorSize = m_device->GetDescriptorHandleIncrementSize(D3D12_DESCRIPTOR_HEAP_TYPE_DSV);
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
        // 2 SRVs at registers t0 and t1 (the wood texture and the depth cubemap: consecutive
        // descriptors in the heap), for root parameter 2.
        CD3DX12_DESCRIPTOR_RANGE ranges[2];
        ranges[0].Init(D3D12_DESCRIPTOR_RANGE_TYPE_CBV, 1, 1);
        ranges[1].Init(D3D12_DESCRIPTOR_RANGE_TYPE_SRV, 2, 0);

        // Root parameter 0: root constants for register b0 (the model and normal matrices of
        // the draw, and reverseNormals), for the vertex shaders.
        // Root parameter 1: a descriptor table with the constant buffer view (b1: the
        // matrices and the positions of the camera and the light), for all shaders.
        // Root parameter 2: a descriptor table with the textures' SRVs, for the pixel shaders.
        CD3DX12_ROOT_PARAMETER rootParameters[3];
        rootParameters[0].InitAsConstants(sizeof(ModelConstants) / 4, 0, 0, D3D12_SHADER_VISIBILITY_VERTEX);
        rootParameters[1].InitAsDescriptorTable(1, &ranges[0], D3D12_SHADER_VISIBILITY_ALL);
        rootParameters[2].InitAsDescriptorTable(1, &ranges[1], D3D12_SHADER_VISIBILITY_PIXEL);

        // A static sampler is part of the root signature itself (no descriptor needed).
        // Sampler s0: linear filtering; texture coordinates outside 0..1 wrap around
        // (learnopengl: GL_REPEAT).
        D3D12_STATIC_SAMPLER_DESC samplers[2] = {};
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

        // Sampler s1, for the depth cubemap: no filtering (learnopengl: GL_NEAREST) - a
        // distance is compared with another distance, it is not a colour to blend with its
        // neighbours - and clamped to the edge (learnopengl: GL_CLAMP_TO_EDGE).
        samplers[1] = samplers[0];
        samplers[1].Filter = D3D12_FILTER_MIN_MAG_MIP_POINT;
        samplers[1].AddressU = D3D12_TEXTURE_ADDRESS_MODE_CLAMP;
        samplers[1].AddressV = D3D12_TEXTURE_ADDRESS_MODE_CLAMP;
        samplers[1].AddressW = D3D12_TEXTURE_ADDRESS_MODE_CLAMP;
        samplers[1].ShaderRegister = 1;

        CD3DX12_ROOT_SIGNATURE_DESC rootSignatureDesc;
        rootSignatureDesc.Init(_countof(rootParameters), rootParameters, _countof(samplers), samplers, D3D12_ROOT_SIGNATURE_FLAG_ALLOW_INPUT_ASSEMBLER_INPUT_LAYOUT);

        ComPtr<ID3DBlob> signature;
        ComPtr<ID3DBlob> error;
        ThrowIfFailed(D3D12SerializeRootSignature(&rootSignatureDesc, D3D_ROOT_SIGNATURE_VERSION_1, &signature, &error));
        ThrowIfFailed(m_device->CreateRootSignature(0, signature->GetBufferPointer(), signature->GetBufferSize(), IID_PPV_ARGS(&m_rootSignature)));
    }

    // Create the pipeline states, which includes compiling and loading shaders.
    {
        ComPtr<ID3DBlob> vertexShader;
        ComPtr<ID3DBlob> pixelShader;

#if defined(_DEBUG)
        // Enable better shader debugging with the graphics debugging tools.
        UINT compileFlags = D3DCOMPILE_DEBUG | D3DCOMPILE_SKIP_OPTIMIZATION;
#else
        UINT compileFlags = 0;
#endif

        // Compile the vertex shader (VSMain) and the pixel shader (PSMain) in point_shadows.hlsl.
        ThrowIfFailed(D3DCompileFromFile(L"point_shadows.hlsl", nullptr, nullptr, "VSMain", "vs_5_0", compileFlags, 0, &vertexShader, nullptr));
        ThrowIfFailed(D3DCompileFromFile(L"point_shadows.hlsl", nullptr, nullptr, "PSMain", "ps_5_0", compileFlags, 0, &pixelShader, nullptr));

        // Define the vertex input layout: position, normal and texture coordinates (8 floats).
        D3D12_INPUT_ELEMENT_DESC inputElementDescs[] =
        {
            { "POSITION", 0, DXGI_FORMAT_R32G32B32_FLOAT, 0, 0, D3D12_INPUT_CLASSIFICATION_PER_VERTEX_DATA, 0 },
            { "NORMAL", 0, DXGI_FORMAT_R32G32B32_FLOAT, 0, 12, D3D12_INPUT_CLASSIFICATION_PER_VERTEX_DATA, 0 },
            { "TEXCOORD", 0, DXGI_FORMAT_R32G32_FLOAT, 0, 24, D3D12_INPUT_CLASSIFICATION_PER_VERTEX_DATA, 0 }
        };

        // Describe and create the graphics pipeline state object (PSO).
        D3D12_GRAPHICS_PIPELINE_STATE_DESC psoDesc = {};
        psoDesc.InputLayout = { inputElementDescs, _countof(inputElementDescs) };
        psoDesc.pRootSignature = m_rootSignature.Get();
        psoDesc.VS = CD3DX12_SHADER_BYTECODE(vertexShader.Get());
        psoDesc.PS = CD3DX12_SHADER_BYTECODE(pixelShader.Get());
        psoDesc.RasterizerState = CD3DX12_RASTERIZER_DESC(D3D12_DEFAULT);
        // No face culling: the room is seen from the inside (learnopengl turns culling off for
        // it; the small cubes look the same with or without it).
        psoDesc.RasterizerState.CullMode = D3D12_CULL_MODE_NONE;
        psoDesc.BlendState = CD3DX12_BLEND_DESC(D3D12_DEFAULT);
        psoDesc.DepthStencilState = CD3DX12_DEPTH_STENCIL_DESC(D3D12_DEFAULT);    // depth test (LESS) and depth writes on
        psoDesc.SampleMask = UINT_MAX;
        psoDesc.PrimitiveTopologyType = D3D12_PRIMITIVE_TOPOLOGY_TYPE_TRIANGLE;
        psoDesc.NumRenderTargets = 1;
        psoDesc.RTVFormats[0] = DXGI_FORMAT_R8G8B8A8_UNORM;
        psoDesc.DSVFormat = DXGI_FORMAT_D32_FLOAT;
        psoDesc.SampleDesc.Count = 1;
        ThrowIfFailed(m_device->CreateGraphicsPipelineState(&psoDesc, IID_PPV_ARGS(&m_pipelineState)));

        // The depth pass's pipeline state (learnopengl's simpleDepthShader): the three shaders
        // of point_shadows_depth.hlsl - a geometry shader sends every triangle to all six cube
        // faces, the pixel shader writes the distance to the light as the depth. No render
        // target, only the depth cubemap's depth stencil view (D32_FLOAT).
        ComPtr<ID3DBlob> depthVertexShader;
        ComPtr<ID3DBlob> depthGeometryShader;
        ComPtr<ID3DBlob> depthPixelShader;
        ThrowIfFailed(D3DCompileFromFile(L"point_shadows_depth.hlsl", nullptr, nullptr, "VSMain", "vs_5_0", compileFlags, 0, &depthVertexShader, nullptr));
        ThrowIfFailed(D3DCompileFromFile(L"point_shadows_depth.hlsl", nullptr, nullptr, "GSMain", "gs_5_0", compileFlags, 0, &depthGeometryShader, nullptr));
        ThrowIfFailed(D3DCompileFromFile(L"point_shadows_depth.hlsl", nullptr, nullptr, "PSMain", "ps_5_0", compileFlags, 0, &depthPixelShader, nullptr));
        psoDesc.VS = CD3DX12_SHADER_BYTECODE(depthVertexShader.Get());
        psoDesc.GS = CD3DX12_SHADER_BYTECODE(depthGeometryShader.Get());
        psoDesc.PS = CD3DX12_SHADER_BYTECODE(depthPixelShader.Get());
        psoDesc.NumRenderTargets = 0;
        psoDesc.RTVFormats[0] = DXGI_FORMAT_UNKNOWN;
        psoDesc.DSVFormat = DXGI_FORMAT_D32_FLOAT;
        ThrowIfFailed(m_device->CreateGraphicsPipelineState(&psoDesc, IID_PPV_ARGS(&m_depthPipelineState)));
    }

    // Create the command list.
    ThrowIfFailed(m_device->CreateCommandList(0, D3D12_COMMAND_LIST_TYPE_DIRECT, m_commandAllocator.Get(), m_pipelineState.Get(), IID_PPV_ARGS(&m_commandList)));

    // Command lists are created in the recording state. This one stays open until the
    // end of LoadAssets, where it is closed and executed once.

    // Create the vertex buffer.
    {
        // The cube (learnopengl's renderCube): 36 vertices, from -1 to 1 (2 units), every
        // object of the scene is drawn with it. The texture coordinates are learnopengl.com's
        // with v flipped (1 - v): Direct3D's v = 0 is the image's top.
        Vertex vertices[] =
        {
            // positions                 normals                  texcoords
            // back face
            { { -1.0f, -1.0f, -1.0f }, {  0.0f,  0.0f, -1.0f }, {  0.0f,  1.0f } },
            { {  1.0f,  1.0f, -1.0f }, {  0.0f,  0.0f, -1.0f }, {  1.0f,  0.0f } },
            { {  1.0f, -1.0f, -1.0f }, {  0.0f,  0.0f, -1.0f }, {  1.0f,  1.0f } },
            { {  1.0f,  1.0f, -1.0f }, {  0.0f,  0.0f, -1.0f }, {  1.0f,  0.0f } },
            { { -1.0f, -1.0f, -1.0f }, {  0.0f,  0.0f, -1.0f }, {  0.0f,  1.0f } },
            { { -1.0f,  1.0f, -1.0f }, {  0.0f,  0.0f, -1.0f }, {  0.0f,  0.0f } },
            // front face
            { { -1.0f, -1.0f,  1.0f }, {  0.0f,  0.0f,  1.0f }, {  0.0f,  1.0f } },
            { {  1.0f, -1.0f,  1.0f }, {  0.0f,  0.0f,  1.0f }, {  1.0f,  1.0f } },
            { {  1.0f,  1.0f,  1.0f }, {  0.0f,  0.0f,  1.0f }, {  1.0f,  0.0f } },
            { {  1.0f,  1.0f,  1.0f }, {  0.0f,  0.0f,  1.0f }, {  1.0f,  0.0f } },
            { { -1.0f,  1.0f,  1.0f }, {  0.0f,  0.0f,  1.0f }, {  0.0f,  0.0f } },
            { { -1.0f, -1.0f,  1.0f }, {  0.0f,  0.0f,  1.0f }, {  0.0f,  1.0f } },
            // left face
            { { -1.0f,  1.0f,  1.0f }, { -1.0f,  0.0f,  0.0f }, {  1.0f,  1.0f } },
            { { -1.0f,  1.0f, -1.0f }, { -1.0f,  0.0f,  0.0f }, {  1.0f,  0.0f } },
            { { -1.0f, -1.0f, -1.0f }, { -1.0f,  0.0f,  0.0f }, {  0.0f,  0.0f } },
            { { -1.0f, -1.0f, -1.0f }, { -1.0f,  0.0f,  0.0f }, {  0.0f,  0.0f } },
            { { -1.0f, -1.0f,  1.0f }, { -1.0f,  0.0f,  0.0f }, {  0.0f,  1.0f } },
            { { -1.0f,  1.0f,  1.0f }, { -1.0f,  0.0f,  0.0f }, {  1.0f,  1.0f } },
            // right face
            { {  1.0f,  1.0f,  1.0f }, {  1.0f,  0.0f,  0.0f }, {  1.0f,  1.0f } },
            { {  1.0f, -1.0f, -1.0f }, {  1.0f,  0.0f,  0.0f }, {  0.0f,  0.0f } },
            { {  1.0f,  1.0f, -1.0f }, {  1.0f,  0.0f,  0.0f }, {  1.0f,  0.0f } },
            { {  1.0f, -1.0f, -1.0f }, {  1.0f,  0.0f,  0.0f }, {  0.0f,  0.0f } },
            { {  1.0f,  1.0f,  1.0f }, {  1.0f,  0.0f,  0.0f }, {  1.0f,  1.0f } },
            { {  1.0f, -1.0f,  1.0f }, {  1.0f,  0.0f,  0.0f }, {  0.0f,  1.0f } },
            // bottom face
            { { -1.0f, -1.0f, -1.0f }, {  0.0f, -1.0f,  0.0f }, {  0.0f,  0.0f } },
            { {  1.0f, -1.0f, -1.0f }, {  0.0f, -1.0f,  0.0f }, {  1.0f,  0.0f } },
            { {  1.0f, -1.0f,  1.0f }, {  0.0f, -1.0f,  0.0f }, {  1.0f,  1.0f } },
            { {  1.0f, -1.0f,  1.0f }, {  0.0f, -1.0f,  0.0f }, {  1.0f,  1.0f } },
            { { -1.0f, -1.0f,  1.0f }, {  0.0f, -1.0f,  0.0f }, {  0.0f,  1.0f } },
            { { -1.0f, -1.0f, -1.0f }, {  0.0f, -1.0f,  0.0f }, {  0.0f,  0.0f } },
            // top face
            { { -1.0f,  1.0f, -1.0f }, {  0.0f,  1.0f,  0.0f }, {  0.0f,  0.0f } },
            { {  1.0f,  1.0f,  1.0f }, {  0.0f,  1.0f,  0.0f }, {  1.0f,  1.0f } },
            { {  1.0f,  1.0f, -1.0f }, {  0.0f,  1.0f,  0.0f }, {  1.0f,  0.0f } },
            { {  1.0f,  1.0f,  1.0f }, {  0.0f,  1.0f,  0.0f }, {  1.0f,  1.0f } },
            { { -1.0f,  1.0f, -1.0f }, {  0.0f,  1.0f,  0.0f }, {  0.0f,  0.0f } },
            { { -1.0f,  1.0f,  1.0f }, {  0.0f,  1.0f,  0.0f }, {  0.0f,  1.0f } }
        };

        const UINT vertexBufferSize = sizeof(vertices);

        // Note: using upload heaps to transfer static data like vert buffers is not
        // recommended. Every time the GPU needs it, the upload heap will be marshalled
        // over. Please read up on Default Heap usage. An upload heap is used here for
        // code simplicity and because there are very few verts to actually transfer.
        CD3DX12_HEAP_PROPERTIES heapProperties(D3D12_HEAP_TYPE_UPLOAD);
        CD3DX12_RESOURCE_DESC bufferDesc = CD3DX12_RESOURCE_DESC::Buffer(vertexBufferSize);
        ThrowIfFailed(m_device->CreateCommittedResource(
            &heapProperties,
            D3D12_HEAP_FLAG_NONE,
            &bufferDesc,
            D3D12_RESOURCE_STATE_GENERIC_READ,
            nullptr,
            IID_PPV_ARGS(&m_vertexBuffer)));

        // Copy the vertex data to the vertex buffer.
        UINT8* pVertexDataBegin = nullptr;
        CD3DX12_RANGE readRange(0, 0);        // We do not intend to read from this resource on the CPU.
        ThrowIfFailed(m_vertexBuffer->Map(0, &readRange, reinterpret_cast<void**>(&pVertexDataBegin)));
        memcpy(pVertexDataBegin, vertices, sizeof(vertices));
        m_vertexBuffer->Unmap(0, nullptr);

        // Initialize the vertex buffer view.
        m_vertexBufferView.BufferLocation = m_vertexBuffer->GetGPUVirtualAddress();
        m_vertexBufferView.StrideInBytes = sizeof(Vertex);
        m_vertexBufferView.SizeInBytes = vertexBufferSize;
    }

    // Load the wood texture: its SRV goes into the heap after the CBV (slot 1). The upload
    // buffer must stay alive until the command list that copies from it has executed (the
    // end of this method waits for it).
    ComPtr<ID3D12Resource> woodTextureUploadHeap;
    LoadTexture("wood.png", m_woodTexture, woodTextureUploadHeap, 1);

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

    // Create the depth cubemap: six depth textures in one resource, an array of 6 slices (the
    // cube's faces +X, -X, +Y, -Y, +Z, -Z), that the depth pass draws the scene into from the
    // light, and the camera's pass reads as a cube map.
    {
        // R32_TYPELESS: the same 32 bits per texel are a D32_FLOAT depth to the depth stencil
        // view and an R32_FLOAT colour to the shader resource view. DepthOrArraySize = 6.
        CD3DX12_HEAP_PROPERTIES heapProperties(D3D12_HEAP_TYPE_DEFAULT);
        CD3DX12_RESOURCE_DESC cubemapDesc = CD3DX12_RESOURCE_DESC::Tex2D(DXGI_FORMAT_R32_TYPELESS, SHADOW_WIDTH, SHADOW_HEIGHT, 6, 1, 1, 0, D3D12_RESOURCE_FLAG_ALLOW_DEPTH_STENCIL);

        // It is cleared to 1.0 (the farthest distance it holds: far_plane) every frame.
        D3D12_CLEAR_VALUE clearValue = {};
        clearValue.Format = DXGI_FORMAT_D32_FLOAT;
        clearValue.DepthStencil.Depth = 1.0f;
        clearValue.DepthStencil.Stencil = 0;

        // It starts in the DEPTH_WRITE state: each frame the depth pass draws into it, a
        // barrier turns it into a PIXEL_SHADER_RESOURCE for the camera's pass, and another
        // one back at the end of the frame.
        ThrowIfFailed(m_device->CreateCommittedResource(
            &heapProperties,
            D3D12_HEAP_FLAG_NONE,
            &cubemapDesc,
            D3D12_RESOURCE_STATE_DEPTH_WRITE,
            &clearValue,
            IID_PPV_ARGS(&m_depthCubemap)));

        // One depth stencil view over all six slices (a Texture2DArray view), slot 1 of the DSV
        // heap: the geometry shader picks the slice of each triangle (SV_RenderTargetArrayIndex)
        // - learnopengl: glFramebufferTexture with the whole cube map, a layered attachment.
        D3D12_DEPTH_STENCIL_VIEW_DESC dsvDesc = {};
        dsvDesc.Format = DXGI_FORMAT_D32_FLOAT;
        dsvDesc.ViewDimension = D3D12_DSV_DIMENSION_TEXTURE2DARRAY;
        dsvDesc.Flags = D3D12_DSV_FLAG_NONE;
        dsvDesc.Texture2DArray.MipSlice = 0;
        dsvDesc.Texture2DArray.FirstArraySlice = 0;
        dsvDesc.Texture2DArray.ArraySize = 6;
        CD3DX12_CPU_DESCRIPTOR_HANDLE dsvHandle(m_dsvHeap->GetCPUDescriptorHandleForHeapStart(), 1, m_dsvDescriptorSize);
        m_device->CreateDepthStencilView(m_depthCubemap.Get(), &dsvDesc, dsvHandle);

        // A cube map shader resource view, slot 2 of the CBV/SRV heap, right after the wood's,
        // so that one descriptor table holds both (t0 and t1): the shaders read it with a
        // direction (TextureCube).
        D3D12_SHADER_RESOURCE_VIEW_DESC srvDesc = {};
        srvDesc.Shader4ComponentMapping = D3D12_DEFAULT_SHADER_4_COMPONENT_MAPPING;
        srvDesc.Format = DXGI_FORMAT_R32_FLOAT;
        srvDesc.ViewDimension = D3D12_SRV_DIMENSION_TEXTURECUBE;
        srvDesc.TextureCube.MostDetailedMip = 0;
        srvDesc.TextureCube.MipLevels = 1;
        CD3DX12_CPU_DESCRIPTOR_HANDLE srvHandle(m_cbvSrvHeap->GetCPUDescriptorHandleForHeapStart(), 2, m_cbvSrvDescriptorSize);
        m_device->CreateShaderResourceView(m_depthCubemap.Get(), &srvDesc, srvHandle);
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

    // The view matrix: look from cameraPos in the direction of cameraFront.
    XMMATRIX view = XMMatrixLookAtRH(cameraPos, cameraPos + cameraFront, cameraUp);

    // The projection matrix adds perspective: a field of view of fov degrees (the
    // zoom), the window's aspect ratio, and the near and far planes at 0.1 and 100 units.
    XMMATRIX projection = XMMatrixPerspectiveFovRH(XMConvertToRadians(fov), static_cast<float>(m_width) / static_cast<float>(m_height), 0.1f, 100.0f);

    // Copy both into the constant buffer, transposed for HLSL. The GPU has finished
    // the previous frame (OnRender waits for it), so it is not reading the buffer.
    SceneConstantBuffer constantBufferData = {};
    XMStoreFloat4x4(&constantBufferData.view, XMMatrixTranspose(view));
    XMStoreFloat4x4(&constantBufferData.projection, XMMatrixTranspose(projection));

    // 0. create depth cubemap transformation matrices: a perspective projection with a field
    // of view of 90 degrees and an aspect ratio of 1 sees exactly one face of a cube around
    // the light. Then Direct3D flips it upside down (y -> -y): its render targets have row 0
    // at the top (NDC y = +1), OpenGL's at the bottom, and the cube map's faces are laid out
    // the same in both - so the flip makes learnopengl's six directions and ups fit.
    float near_plane = 1.0f;
    float far_plane = 25.0f;
    XMMATRIX shadowProj = XMMatrixPerspectiveFovRH(XMConvertToRadians(90.0f), static_cast<float>(SHADOW_WIDTH) / static_cast<float>(SHADOW_HEIGHT), near_plane, far_plane)
        * XMMatrixScaling(1.0f, -1.0f, 1.0f);
    XMVECTOR light = XMLoadFloat3(&lightPos);
    XMMATRIX shadowTransforms[6] =
    {
        XMMatrixLookAtRH(light, light + XMVectorSet( 1.0f,  0.0f,  0.0f, 0.0f), XMVectorSet(0.0f, -1.0f,  0.0f, 0.0f)) * shadowProj,    // +X
        XMMatrixLookAtRH(light, light + XMVectorSet(-1.0f,  0.0f,  0.0f, 0.0f), XMVectorSet(0.0f, -1.0f,  0.0f, 0.0f)) * shadowProj,    // -X
        XMMatrixLookAtRH(light, light + XMVectorSet( 0.0f,  1.0f,  0.0f, 0.0f), XMVectorSet(0.0f,  0.0f,  1.0f, 0.0f)) * shadowProj,    // +Y
        XMMatrixLookAtRH(light, light + XMVectorSet( 0.0f, -1.0f,  0.0f, 0.0f), XMVectorSet(0.0f,  0.0f, -1.0f, 0.0f)) * shadowProj,    // -Y
        XMMatrixLookAtRH(light, light + XMVectorSet( 0.0f,  0.0f,  1.0f, 0.0f), XMVectorSet(0.0f, -1.0f,  0.0f, 0.0f)) * shadowProj,    // +Z
        XMMatrixLookAtRH(light, light + XMVectorSet( 0.0f,  0.0f, -1.0f, 0.0f), XMVectorSet(0.0f, -1.0f,  0.0f, 0.0f)) * shadowProj     // -Z
    };
    for (int i = 0; i < 6; ++i)
        XMStoreFloat4x4(&constantBufferData.shadowMatrices[i], XMMatrixTranspose(shadowTransforms[i]));
    constantBufferData.far_plane = far_plane;

    // The positions the lighting needs: the camera's and the light's.
    XMStoreFloat3(&constantBufferData.viewPos, cameraPos);
    constantBufferData.lightPos = lightPos;
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

    // The CBV/SRV heap the descriptor tables point into, and root parameter 1: the table
    // with the constant buffer view, the heap's first descriptor.
    ID3D12DescriptorHeap* ppHeaps[] = { m_cbvSrvHeap.Get() };
    m_commandList->SetDescriptorHeaps(_countof(ppHeaps), ppHeaps);
    m_commandList->SetGraphicsRootDescriptorTable(1, m_cbvSrvHeap->GetGPUDescriptorHandleForHeapStart());

    // Root parameter 2: the textures' table, from heap slot 1 on - the wood (t0), then the
    // depth cubemap (t1).
    CD3DX12_GPU_DESCRIPTOR_HANDLE textures(m_cbvSrvHeap->GetGPUDescriptorHandleForHeapStart(), 1, m_cbvSrvDescriptorSize);
    m_commandList->SetGraphicsRootDescriptorTable(2, textures);

    m_commandList->IASetPrimitiveTopology(D3D_PRIMITIVE_TOPOLOGY_TRIANGLELIST);
    m_commandList->IASetVertexBuffers(0, 1, &m_vertexBufferView);

    // 1. render scene to depth cubemap: the depth pass's pipeline state, a face's size as the
    // viewport, and the cube map's six slices as the depth buffer with no render target.
    m_commandList->SetPipelineState(m_depthPipelineState.Get());
    m_commandList->RSSetViewports(1, &m_shadowViewport);
    m_commandList->RSSetScissorRects(1, &m_shadowScissorRect);
    CD3DX12_CPU_DESCRIPTOR_HANDLE cubemapDsvHandle(m_dsvHeap->GetCPUDescriptorHandleForHeapStart(), 1, m_dsvDescriptorSize);
    m_commandList->OMSetRenderTargets(0, nullptr, FALSE, &cubemapDsvHandle);
    m_commandList->ClearDepthStencilView(cubemapDsvHandle, D3D12_CLEAR_FLAG_DEPTH, 1.0f, 0, 0, nullptr);
    RenderScene();

    // The depth cubemap is done: from now on the pixel shaders read it.
    CD3DX12_RESOURCE_BARRIER cubemapBarrier = CD3DX12_RESOURCE_BARRIER::Transition(m_depthCubemap.Get(), D3D12_RESOURCE_STATE_DEPTH_WRITE, D3D12_RESOURCE_STATE_PIXEL_SHADER_RESOURCE);
    m_commandList->ResourceBarrier(1, &cubemapBarrier);
    m_commandList->SetPipelineState(m_pipelineState.Get());

    // 2. render scene as normal: the window's viewport, render target and depth buffer.
    m_commandList->RSSetViewports(1, &m_viewport);
    m_commandList->RSSetScissorRects(1, &m_scissorRect);

    // Indicate that the back buffer will be used as a render target.
    CD3DX12_RESOURCE_BARRIER barrier = CD3DX12_RESOURCE_BARRIER::Transition(m_renderTargets[m_frameIndex].Get(), D3D12_RESOURCE_STATE_PRESENT, D3D12_RESOURCE_STATE_RENDER_TARGET);
    m_commandList->ResourceBarrier(1, &barrier);

    CD3DX12_CPU_DESCRIPTOR_HANDLE rtvHandle(m_rtvHeap->GetCPUDescriptorHandleForHeapStart(), m_frameIndex, m_rtvDescriptorSize);
    CD3DX12_CPU_DESCRIPTOR_HANDLE dsvHandle(m_dsvHeap->GetCPUDescriptorHandleForHeapStart());
    m_commandList->OMSetRenderTargets(1, &rtvHandle, FALSE, &dsvHandle);

    // Record commands.
    const float clearColor[] = { 0.1f, 0.1f, 0.1f, 1.0f };
    m_commandList->ClearRenderTargetView(rtvHandle, clearColor, 0, nullptr);
    m_commandList->ClearDepthStencilView(dsvHandle, D3D12_CLEAR_FLAG_DEPTH, 1.0f, 0, 0, nullptr);
    RenderScene();

    // Indicate that the back buffer will now be used to present.
    barrier = CD3DX12_RESOURCE_BARRIER::Transition(m_renderTargets[m_frameIndex].Get(), D3D12_RESOURCE_STATE_RENDER_TARGET, D3D12_RESOURCE_STATE_PRESENT);
    m_commandList->ResourceBarrier(1, &barrier);

    // The next frame's depth pass writes the depth cubemap again.
    cubemapBarrier = CD3DX12_RESOURCE_BARRIER::Transition(m_depthCubemap.Get(), D3D12_RESOURCE_STATE_PIXEL_SHADER_RESOURCE, D3D12_RESOURCE_STATE_DEPTH_WRITE);
    m_commandList->ResourceBarrier(1, &cubemapBarrier);

    ThrowIfFailed(m_commandList->Close());
}

// renders the 3D scene (learnopengl's renderScene): the room and the five cubes in it, all
// with the one cube of the vertex buffer, each with its model matrix and its normal matrix
// (root parameter 0). The normal matrix is the transpose of the inverse of the model matrix;
// stored transposed for HLSL, that is the inverse itself. With row vectors, the matrices
// apply from left to right: scale, then rotate, then translate (learnopengl's
// translate * rotate * scale).
void D3D12App::RenderScene()
{
    // room cube
    ModelConstants modelConstants = {};
    XMMATRIX model = XMMatrixScaling(5.0f, 5.0f, 5.0f);
    XMStoreFloat4x4(&modelConstants.model, XMMatrixTranspose(model));
    XMStoreFloat4x4(&modelConstants.normalMatrix, XMMatrixInverse(nullptr, model));
    modelConstants.reverseNormals = TRUE;    // A small little hack to invert normals when drawing cube from the inside so lighting still works.
    m_commandList->SetGraphicsRoot32BitConstants(0, sizeof(ModelConstants) / 4, &modelConstants, 0);
    m_commandList->DrawInstanced(36, 1, 0, 0);
    modelConstants.reverseNormals = FALSE;    // and of course disable it
    // cubes
    model = XMMatrixScaling(0.5f, 0.5f, 0.5f) * XMMatrixTranslation(4.0f, -3.5f, 0.0f);
    XMStoreFloat4x4(&modelConstants.model, XMMatrixTranspose(model));
    XMStoreFloat4x4(&modelConstants.normalMatrix, XMMatrixInverse(nullptr, model));
    m_commandList->SetGraphicsRoot32BitConstants(0, sizeof(ModelConstants) / 4, &modelConstants, 0);
    m_commandList->DrawInstanced(36, 1, 0, 0);
    model = XMMatrixScaling(0.75f, 0.75f, 0.75f) * XMMatrixTranslation(2.0f, 3.0f, 1.0f);
    XMStoreFloat4x4(&modelConstants.model, XMMatrixTranspose(model));
    XMStoreFloat4x4(&modelConstants.normalMatrix, XMMatrixInverse(nullptr, model));
    m_commandList->SetGraphicsRoot32BitConstants(0, sizeof(ModelConstants) / 4, &modelConstants, 0);
    m_commandList->DrawInstanced(36, 1, 0, 0);
    model = XMMatrixScaling(0.5f, 0.5f, 0.5f) * XMMatrixTranslation(-3.0f, -1.0f, 0.0f);
    XMStoreFloat4x4(&modelConstants.model, XMMatrixTranspose(model));
    XMStoreFloat4x4(&modelConstants.normalMatrix, XMMatrixInverse(nullptr, model));
    m_commandList->SetGraphicsRoot32BitConstants(0, sizeof(ModelConstants) / 4, &modelConstants, 0);
    m_commandList->DrawInstanced(36, 1, 0, 0);
    model = XMMatrixScaling(0.5f, 0.5f, 0.5f) * XMMatrixTranslation(-1.5f, 1.0f, 1.5f);
    XMStoreFloat4x4(&modelConstants.model, XMMatrixTranspose(model));
    XMStoreFloat4x4(&modelConstants.normalMatrix, XMMatrixInverse(nullptr, model));
    m_commandList->SetGraphicsRoot32BitConstants(0, sizeof(ModelConstants) / 4, &modelConstants, 0);
    m_commandList->DrawInstanced(36, 1, 0, 0);
    model = XMMatrixScaling(0.75f, 0.75f, 0.75f)
        * XMMatrixRotationAxis(XMVector3Normalize(XMVectorSet(1.0f, 0.0f, 1.0f, 0.0f)), XMConvertToRadians(60.0f))
        * XMMatrixTranslation(-1.5f, 2.0f, -3.0f);
    XMStoreFloat4x4(&modelConstants.model, XMMatrixTranspose(model));
    XMStoreFloat4x4(&modelConstants.normalMatrix, XMMatrixInverse(nullptr, model));
    m_commandList->SetGraphicsRoot32BitConstants(0, sizeof(ModelConstants) / 4, &modelConstants, 0);
    m_commandList->DrawInstanced(36, 1, 0, 0);
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

// Utility function for loading a 2D texture from file: creates the texture in a default
// heap and its shader resource view in slot descriptorIndex of the CBV/SRV heap, and
// records the copy of the pixels into it in the command list. The copy reads from
// uploadHeap, so that must stay alive until the command list has executed.
void D3D12App::LoadTexture(const char* path, ComPtr<ID3D12Resource>& texture, ComPtr<ID3D12Resource>& uploadHeap, UINT descriptorIndex)
{
    // Load the image as RGBA (4 channels), the layout of DXGI_FORMAT_R8G8B8A8_UNORM.
    // No vertical flip: in Direct3D, texture coordinate v = 0 is the image's top row.
    int width, height, nrChannels;
    unsigned char* data = stbi_load(path, &width, &height, &nrChannels, 4);
    if (data == nullptr)
    {
        throw std::runtime_error(std::string("Failed to load texture ") + path);
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

    CD3DX12_HEAP_PROPERTIES heapProperties(D3D12_HEAP_TYPE_DEFAULT);
    ThrowIfFailed(m_device->CreateCommittedResource(
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
    ThrowIfFailed(m_device->CreateCommittedResource(
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

    UpdateSubresources(m_commandList.Get(), texture.Get(), uploadHeap.Get(), 0, 0, 1, &textureData);

    // After the copy, the texture is read by the pixel shader.
    CD3DX12_RESOURCE_BARRIER barrier = CD3DX12_RESOURCE_BARRIER::Transition(texture.Get(), D3D12_RESOURCE_STATE_COPY_DEST, D3D12_RESOURCE_STATE_PIXEL_SHADER_RESOURCE);
    m_commandList->ResourceBarrier(1, &barrier);

    // Describe and create a SRV for the texture, in slot descriptorIndex of the CBV/SRV heap.
    D3D12_SHADER_RESOURCE_VIEW_DESC srvDesc = {};
    srvDesc.Shader4ComponentMapping = D3D12_DEFAULT_SHADER_4_COMPONENT_MAPPING;
    srvDesc.Format = textureDesc.Format;
    srvDesc.ViewDimension = D3D12_SRV_DIMENSION_TEXTURE2D;
    srvDesc.Texture2D.MipLevels = 1;
    CD3DX12_CPU_DESCRIPTOR_HANDLE srvHandle(m_cbvSrvHeap->GetCPUDescriptorHandleForHeapStart(), descriptorIndex, m_cbvSrvDescriptorSize);
    m_device->CreateShaderResourceView(texture.Get(), &srvDesc, srvHandle);

    // Free the image memory.
    stbi_image_free(data);
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
