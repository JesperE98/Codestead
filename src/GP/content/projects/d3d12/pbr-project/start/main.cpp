// A Direct3D 12 program in one file, modelled on Microsoft's D3D12HelloWorld samples
// (D3D12HelloWindow, D3D12HelloTriangle, D3D12HelloTexture, D3D12HelloConstBuffers)
// and the depth buffer of the D3D12Bundles sample: a grid of 7 x 7 spheres whose material
// goes from rough to smooth and from plastic to metal, lit by four lights and by the sky
// around them - physically based rendering (PBR) with image based lighting (IBL).

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

#include <algorithm>
#include <chrono>
#include <climits>
#include <cmath>
#include <cstdio>
#include <cstring>
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
// so that OnUpdate and the window's message handler can both use them. At (0, 0, 22)
// looking down -z: far enough back to see the whole grid of spheres.
XMVECTOR cameraPos   = XMVectorSet(0.0f, 0.0f, 22.0f, 0.0f);
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

// lights: four white point lights in front of the grid's corners. Their colour is a
// radiance far above 1.0 (300): light falls off with the square of the distance. XMFLOAT4,
// because every element of an HLSL array in a constant buffer takes a full 16-byte row
// (the fourth value is not used).
XMFLOAT4 lightPositions[] =
{
    XMFLOAT4(-10.0f,  10.0f, 10.0f, 1.0f),
    XMFLOAT4( 10.0f,  10.0f, 10.0f, 1.0f),
    XMFLOAT4(-10.0f, -10.0f, 10.0f, 1.0f),
    XMFLOAT4( 10.0f, -10.0f, 10.0f, 1.0f)
};
XMFLOAT4 lightColors[] =
{
    XMFLOAT4(300.0f, 300.0f, 300.0f, 1.0f),
    XMFLOAT4(300.0f, 300.0f, 300.0f, 1.0f),
    XMFLOAT4(300.0f, 300.0f, 300.0f, 1.0f),
    XMFLOAT4(300.0f, 300.0f, 300.0f, 1.0f)
};

// The grid of spheres: a few large spheres, so the material's details can be seen.
int nrRows    = 3;
int nrColumns = 3;
float spacing = 6.0f;

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
    static const UINT EnvMipLevels = 8;    // the environment cube map's mip levels: 128, 64, 32, 16, 8, 4, 2, 1

    struct Vertex
    {
        XMFLOAT3 position;
        XMFLOAT3 normal;
        XMFLOAT2 texCoord;
        XMFLOAT3 tangent;    // the direction in which the texture's u grows, on the surface
    };

    // The root constants: what the shaders see as cbuffer ModelConstants - the values of
    // one draw. Two 4x4 matrices are 32 floats. (The material comes from textures now.)
    struct ModelConstants
    {
        XMFLOAT4X4 model;
        XMFLOAT4X4 normalMatrix;    // transpose(inverse(model)), for the normals
    };

    // The constant buffer: what the shaders see as cbuffer SceneConstantBuffer, laid out as
    // HLSL packs it - the values that are the same for every draw of a frame.
    struct SceneConstantBuffer
    {
        XMFLOAT4X4 view;
        XMFLOAT4X4 projection;
        // lights
        XMFLOAT4 lightPositions[4];
        XMFLOAT4 lightColors[4];
        XMFLOAT3 camPos;
        float padding0;
    };

    // The same root constants as the capture passes' vertex shader sees them: cbuffer
    // CaptureConstants in cubemap.hlsl - the view and projection matrices of one cube face -
    // and, after them, the roughness the pre-filter pass's pixel shader reads (prefilter.hlsl):
    // 33 values (one more than ModelConstants now: root parameter 0 has this struct's size).
    struct CaptureConstants
    {
        XMFLOAT4X4 captureView;
        XMFLOAT4X4 captureProjection;
        float roughness;
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
    ComPtr<ID3D12PipelineState> m_equirectangularToCubemapPipelineState;    // converts the equirectangular map to a cube map
    ComPtr<ID3D12PipelineState> m_backgroundPipelineState;                  // draws the environment behind the scene
    ComPtr<ID3D12PipelineState> m_irradiancePipelineState;                  // convolutes the environment map into the irradiance map
    ComPtr<ID3D12PipelineState> m_downsamplePipelineState;                  // makes a mip level of the environment cube map from the one above
    ComPtr<ID3D12PipelineState> m_prefilterPipelineState;                   // pre-filters the environment map for one roughness
    ComPtr<ID3D12PipelineState> m_brdfPipelineState;                        // integrates the BRDF into the lookup texture
    ComPtr<ID3D12GraphicsCommandList> m_commandList;
    UINT m_rtvDescriptorSize = 0;
    UINT m_cbvSrvDescriptorSize = 0;

    // App resources.
    ComPtr<ID3D12Resource> m_sphereVertexBuffer;
    D3D12_VERTEX_BUFFER_VIEW m_sphereVertexBufferView = {};
    ComPtr<ID3D12Resource> m_sphereIndexBuffer;
    D3D12_INDEX_BUFFER_VIEW m_sphereIndexBufferView = {};
    UINT m_indexCount = 0;    // how many indices the sphere's triangle strip has
    ComPtr<ID3D12Resource> m_cubeVertexBuffer;
    D3D12_VERTEX_BUFFER_VIEW m_cubeVertexBufferView = {};
    ComPtr<ID3D12Resource> m_hdrTexture;    // the HDR environment map as loaded: one equirectangular 2D image
    ComPtr<ID3D12Resource> m_envCubemap;    // the same environment as a cube map, floating-point
    ComPtr<ID3D12Resource> m_irradianceMap;    // the irradiance cube map: the environment's light summed over a hemisphere, per direction
    ComPtr<ID3D12Resource> m_prefilterMap;     // the pre-filter cube map: the environment as rougher and rougher surfaces reflect it, one roughness per mip level
    ComPtr<ID3D12Resource> m_brdfLUTTexture;   // the BRDF lookup texture: a scale and a bias for F0, by view angle and roughness
    // The material's five textures.
    ComPtr<ID3D12Resource> m_albedoTexture;
    ComPtr<ID3D12Resource> m_normalTexture;
    ComPtr<ID3D12Resource> m_metallicTexture;
    ComPtr<ID3D12Resource> m_roughnessTexture;
    ComPtr<ID3D12Resource> m_aoTexture;
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
    void RenderScene();
    void RenderSphere();
    void RenderCube();
    void RenderQuad();
    void SetCaptureTarget(ID3D12Resource* cubemap, UINT face, UINT mip);
    void WaitForPreviousFrame();
    void GetHardwareAdapter(IDXGIFactory1* pFactory, IDXGIAdapter1** ppAdapter);
    void LoadTexture(const char* path, ComPtr<ID3D12Resource>& texture, ComPtr<ID3D12Resource>& uploadHeap, UINT descriptorIndex);
    void LoadHdrTexture(const char* path, ComPtr<ID3D12Resource>& texture, ComPtr<ID3D12Resource>& uploadHeap, UINT descriptorIndex);
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
        rtvHeapDesc.NumDescriptors = FrameCount + 1;    // the swap chain's buffers + the capture passes' render target view
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
        // One CBV (slot 0) + the SRVs of the HDR texture (1), the environment cube map (2),
        // the irradiance map (3), the pre-filter map (4) and the BRDF lookup texture (5), and
        // one SRV for each of the environment cube map's mip levels but the last (6 to 12),
        // and the SRVs of the material's 5 textures (13 to 17).
        cbvSrvHeapDesc.NumDescriptors = 18;
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
        // Descriptor ranges: 1 CBV at register b1, for the table of root parameter 1; 1 SRV
        // at register t0 (the texture a pass reads; for the spheres the irradiance map), for
        // root parameter 2; and 2 SRVs at registers t1 and t2 (the pre-filter map and the BRDF
        // lookup texture: consecutive descriptors in the heap), for root parameter 3; and
        // 5 SRVs at registers t3 to t7 (the material's textures), for root parameter 4.
        CD3DX12_DESCRIPTOR_RANGE ranges[4];
        ranges[0].Init(D3D12_DESCRIPTOR_RANGE_TYPE_CBV, 1, 1);
        ranges[1].Init(D3D12_DESCRIPTOR_RANGE_TYPE_SRV, 1, 0);
        ranges[2].Init(D3D12_DESCRIPTOR_RANGE_TYPE_SRV, 2, 1);
        ranges[3].Init(D3D12_DESCRIPTOR_RANGE_TYPE_SRV, 5, 3);

        // Root parameter 0: root constants for register b0 - the values of a draw, which each
        // pipeline's shaders read as their own cbuffer (the spheres' model and normal matrices,
        // a capture pass's view and projection matrices and roughness), for all shaders. As
        // many values as the largest of them has: CaptureConstants.
        // Root parameter 1: a descriptor table with the constant buffer view (b1: the camera's
        // matrices and position and the lights), for all shaders.
        // Root parameter 2: a descriptor table with one texture's SRV (t0), for the pixel
        // shaders.
        // Root parameter 3: a descriptor table with the two SRVs the spheres' pixel shader
        // reads besides the irradiance map (t1, t2).
        // Root parameter 4: a descriptor table with the material's textures' SRVs (t3 to t7).
        CD3DX12_ROOT_PARAMETER rootParameters[5];
        rootParameters[0].InitAsConstants(sizeof(CaptureConstants) / 4, 0, 0, D3D12_SHADER_VISIBILITY_ALL);
        rootParameters[1].InitAsDescriptorTable(1, &ranges[0], D3D12_SHADER_VISIBILITY_ALL);
        rootParameters[2].InitAsDescriptorTable(1, &ranges[1], D3D12_SHADER_VISIBILITY_PIXEL);
        rootParameters[3].InitAsDescriptorTable(1, &ranges[2], D3D12_SHADER_VISIBILITY_PIXEL);
        rootParameters[4].InitAsDescriptorTable(1, &ranges[3], D3D12_SHADER_VISIBILITY_PIXEL);

        // A static sampler is part of the root signature itself (no descriptor needed).
        // Sampler s0, for the environment's textures: linear filtering, clamped to the edge
        // (learnopengl: GL_LINEAR, GL_CLAMP_TO_EDGE). A cube map is filtered across the edges
        // of its faces as well: Direct3D always does what OpenGL calls seamless cube maps.
        D3D12_STATIC_SAMPLER_DESC samplers[2] = {};
        samplers[0].Filter = D3D12_FILTER_MIN_MAG_MIP_LINEAR;
        samplers[0].AddressU = D3D12_TEXTURE_ADDRESS_MODE_CLAMP;
        samplers[0].AddressV = D3D12_TEXTURE_ADDRESS_MODE_CLAMP;
        samplers[0].AddressW = D3D12_TEXTURE_ADDRESS_MODE_CLAMP;
        samplers[0].MipLODBias = 0;
        samplers[0].MaxAnisotropy = 0;
        samplers[0].ComparisonFunc = D3D12_COMPARISON_FUNC_NEVER;
        samplers[0].BorderColor = D3D12_STATIC_BORDER_COLOR_TRANSPARENT_BLACK;
        samplers[0].MinLOD = 0.0f;
        samplers[0].MaxLOD = D3D12_FLOAT32_MAX;
        samplers[0].ShaderRegister = 0;
        samplers[0].RegisterSpace = 0;
        samplers[0].ShaderVisibility = D3D12_SHADER_VISIBILITY_PIXEL;

        // Sampler s1, for the material's textures: texture coordinates outside 0..1 wrap
        // around (learnopengl: GL_REPEAT).
        samplers[1] = samplers[0];
        samplers[1].AddressU = D3D12_TEXTURE_ADDRESS_MODE_WRAP;
        samplers[1].AddressV = D3D12_TEXTURE_ADDRESS_MODE_WRAP;
        samplers[1].AddressW = D3D12_TEXTURE_ADDRESS_MODE_WRAP;
        samplers[1].ShaderRegister = 1;

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

        // Compile the vertex shader (VSMain) and the pixel shader (PSMain) in pbr.hlsl.
        ThrowIfFailed(D3DCompileFromFile(L"pbr.hlsl", nullptr, nullptr, "VSMain", "vs_5_0", compileFlags, 0, &vertexShader, nullptr));
        ThrowIfFailed(D3DCompileFromFile(L"pbr.hlsl", nullptr, nullptr, "PSMain", "ps_5_0", compileFlags, 0, &pixelShader, nullptr));

        // Define the vertex input layout: position, normal, texture coordinates and tangent
        // (11 floats).
        D3D12_INPUT_ELEMENT_DESC inputElementDescs[] =
        {
            { "POSITION", 0, DXGI_FORMAT_R32G32B32_FLOAT, 0, 0, D3D12_INPUT_CLASSIFICATION_PER_VERTEX_DATA, 0 },
            { "NORMAL", 0, DXGI_FORMAT_R32G32B32_FLOAT, 0, 12, D3D12_INPUT_CLASSIFICATION_PER_VERTEX_DATA, 0 },
            { "TEXCOORD", 0, DXGI_FORMAT_R32G32_FLOAT, 0, 24, D3D12_INPUT_CLASSIFICATION_PER_VERTEX_DATA, 0 },
            { "TANGENT", 0, DXGI_FORMAT_R32G32B32_FLOAT, 0, 32, D3D12_INPUT_CLASSIFICATION_PER_VERTEX_DATA, 0 }
        };

        // Describe and create the graphics pipeline state object (PSO).
        D3D12_GRAPHICS_PIPELINE_STATE_DESC psoDesc = {};
        psoDesc.InputLayout = { inputElementDescs, _countof(inputElementDescs) };
        psoDesc.pRootSignature = m_rootSignature.Get();
        psoDesc.VS = CD3DX12_SHADER_BYTECODE(vertexShader.Get());
        psoDesc.PS = CD3DX12_SHADER_BYTECODE(pixelShader.Get());
        psoDesc.RasterizerState = CD3DX12_RASTERIZER_DESC(D3D12_DEFAULT);
        psoDesc.RasterizerState.CullMode = D3D12_CULL_MODE_NONE;    // no face culling: draw both sides of every triangle
        psoDesc.BlendState = CD3DX12_BLEND_DESC(D3D12_DEFAULT);
        psoDesc.DepthStencilState = CD3DX12_DEPTH_STENCIL_DESC(D3D12_DEFAULT);    // depth test (LESS) and depth writes on
        psoDesc.SampleMask = UINT_MAX;
        // Triangle lists and triangle strips both are of the topology type TRIANGLE: which
        // of the two a draw uses is set on the command list (IASetPrimitiveTopology).
        psoDesc.PrimitiveTopologyType = D3D12_PRIMITIVE_TOPOLOGY_TYPE_TRIANGLE;
        psoDesc.NumRenderTargets = 1;
        psoDesc.RTVFormats[0] = DXGI_FORMAT_R8G8B8A8_UNORM;
        psoDesc.DSVFormat = DXGI_FORMAT_D32_FLOAT;
        psoDesc.SampleDesc.Count = 1;
        ThrowIfFailed(m_device->CreateGraphicsPipelineState(&psoDesc, IID_PPV_ARGS(&m_pipelineState)));

        // The pipeline state that converts the equirectangular map to a cube map (learnopengl:
        // Shader equirectangularToCubemapShader("cubemap.vs", "equirectangular_to_cubemap.fs")):
        // the vertex shader of cubemap.hlsl, the pixel shader of equirectangular_to_cubemap.hlsl,
        // a face of a floating-point cube map as the render target (16 bits per channel, a
        // half-precision float each: radiance far above 1.0 fits), and no depth buffer - the
        // cube is drawn from its centre, nothing can hide anything.
        ComPtr<ID3DBlob> cubemapVertexShader;
        ComPtr<ID3DBlob> equirectangularToCubemapPixelShader;
        ThrowIfFailed(D3DCompileFromFile(L"cubemap.hlsl", nullptr, nullptr, "VSMain", "vs_5_0", compileFlags, 0, &cubemapVertexShader, nullptr));
        ThrowIfFailed(D3DCompileFromFile(L"equirectangular_to_cubemap.hlsl", nullptr, nullptr, "PSMain", "ps_5_0", compileFlags, 0, &equirectangularToCubemapPixelShader, nullptr));
        psoDesc.VS = CD3DX12_SHADER_BYTECODE(cubemapVertexShader.Get());
        psoDesc.PS = CD3DX12_SHADER_BYTECODE(equirectangularToCubemapPixelShader.Get());
        psoDesc.RTVFormats[0] = DXGI_FORMAT_R16G16B16A16_FLOAT;
        psoDesc.DepthStencilState.DepthEnable = FALSE;
        psoDesc.DSVFormat = DXGI_FORMAT_UNKNOWN;
        ThrowIfFailed(m_device->CreateGraphicsPipelineState(&psoDesc, IID_PPV_ARGS(&m_equirectangularToCubemapPipelineState)));

        // The pipeline state that convolutes the environment map (learnopengl: Shader
        // irradianceShader("cubemap.vs", "irradiance_convolution.fs")): the same description
        // with the pixel shader of irradiance_convolution.hlsl.
        ComPtr<ID3DBlob> irradiancePixelShader;
        ThrowIfFailed(D3DCompileFromFile(L"irradiance_convolution.hlsl", nullptr, nullptr, "PSMain", "ps_5_0", compileFlags, 0, &irradiancePixelShader, nullptr));
        psoDesc.PS = CD3DX12_SHADER_BYTECODE(irradiancePixelShader.Get());
        ThrowIfFailed(m_device->CreateGraphicsPipelineState(&psoDesc, IID_PPV_ARGS(&m_irradiancePipelineState)));

        // The pipeline state that generates the environment cube map's mip levels: the same
        // description with the pixel shader of downsample.hlsl.
        ComPtr<ID3DBlob> downsamplePixelShader;
        ThrowIfFailed(D3DCompileFromFile(L"downsample.hlsl", nullptr, nullptr, "PSMain", "ps_5_0", compileFlags, 0, &downsamplePixelShader, nullptr));
        psoDesc.PS = CD3DX12_SHADER_BYTECODE(downsamplePixelShader.Get());
        ThrowIfFailed(m_device->CreateGraphicsPipelineState(&psoDesc, IID_PPV_ARGS(&m_downsamplePipelineState)));

        // The pipeline state that pre-filters the environment map (learnopengl: Shader
        // prefilterShader("cubemap.vs", "prefilter.fs")): the pixel shader of prefilter.hlsl.
        ComPtr<ID3DBlob> prefilterPixelShader;
        ThrowIfFailed(D3DCompileFromFile(L"prefilter.hlsl", nullptr, nullptr, "PSMain", "ps_5_0", compileFlags, 0, &prefilterPixelShader, nullptr));
        psoDesc.PS = CD3DX12_SHADER_BYTECODE(prefilterPixelShader.Get());
        ThrowIfFailed(m_device->CreateGraphicsPipelineState(&psoDesc, IID_PPV_ARGS(&m_prefilterPipelineState)));

        // The pipeline state that integrates the BRDF (learnopengl: Shader brdfShader("brdf.vs",
        // "brdf.fs")): the shaders of brdf.hlsl, and a render target with two channels, a
        // half-precision float each (learnopengl: GL_RG16F).
        ComPtr<ID3DBlob> brdfVertexShader;
        ComPtr<ID3DBlob> brdfPixelShader;
        ThrowIfFailed(D3DCompileFromFile(L"brdf.hlsl", nullptr, nullptr, "VSMain", "vs_5_0", compileFlags, 0, &brdfVertexShader, nullptr));
        ThrowIfFailed(D3DCompileFromFile(L"brdf.hlsl", nullptr, nullptr, "PSMain", "ps_5_0", compileFlags, 0, &brdfPixelShader, nullptr));
        psoDesc.VS = CD3DX12_SHADER_BYTECODE(brdfVertexShader.Get());
        psoDesc.PS = CD3DX12_SHADER_BYTECODE(brdfPixelShader.Get());
        psoDesc.RTVFormats[0] = DXGI_FORMAT_R16G16_FLOAT;
        ThrowIfFailed(m_device->CreateGraphicsPipelineState(&psoDesc, IID_PPV_ARGS(&m_brdfPipelineState)));

        // The background's pipeline state (learnopengl: Shader backgroundShader("background.vs",
        // "background.fs")): the shaders of background.hlsl, the window's back buffer and
        // the depth buffer again, with the depth function LESS_EQUAL: the background's depth
        // is 1.0, the value the depth buffer is cleared to, and it must pass there
        // (learnopengl: glDepthFunc(GL_LEQUAL)).
        ComPtr<ID3DBlob> backgroundVertexShader;
        ComPtr<ID3DBlob> backgroundPixelShader;
        ThrowIfFailed(D3DCompileFromFile(L"background.hlsl", nullptr, nullptr, "VSMain", "vs_5_0", compileFlags, 0, &backgroundVertexShader, nullptr));
        ThrowIfFailed(D3DCompileFromFile(L"background.hlsl", nullptr, nullptr, "PSMain", "ps_5_0", compileFlags, 0, &backgroundPixelShader, nullptr));
        psoDesc.VS = CD3DX12_SHADER_BYTECODE(backgroundVertexShader.Get());
        psoDesc.PS = CD3DX12_SHADER_BYTECODE(backgroundPixelShader.Get());
        psoDesc.RTVFormats[0] = DXGI_FORMAT_R8G8B8A8_UNORM;
        psoDesc.DepthStencilState.DepthEnable = TRUE;
        psoDesc.DepthStencilState.DepthFunc = D3D12_COMPARISON_FUNC_LESS_EQUAL;
        psoDesc.DSVFormat = DXGI_FORMAT_D32_FLOAT;
        ThrowIfFailed(m_device->CreateGraphicsPipelineState(&psoDesc, IID_PPV_ARGS(&m_backgroundPipelineState)));
    }

    // Create the command list.
    ThrowIfFailed(m_device->CreateCommandList(0, D3D12_COMMAND_LIST_TYPE_DIRECT, m_commandAllocator.Get(), m_pipelineState.Get(), IID_PPV_ARGS(&m_commandList)));

    // Command lists are created in the recording state. This one stays open until the
    // end of LoadAssets, where it is closed and executed once.

    // Create the sphere's vertex buffer and index buffer (learnopengl's renderSphere): a
    // sphere of radius 1 as one long triangle strip.
    {
        std::vector<Vertex> vertices;
        std::vector<UINT> indices;

        // learnopengl uses 64 x 64 segments; 24 x 24 keep the course's preview fast (a real
        // GPU handles the larger numbers easily).
        const unsigned int X_SEGMENTS = 24;
        const unsigned int Y_SEGMENTS = 24;
        const float PI = 3.14159265359f;
        for (unsigned int x = 0; x <= X_SEGMENTS; ++x)
        {
            for (unsigned int y = 0; y <= Y_SEGMENTS; ++y)
            {
                float xSegment = (float)x / (float)X_SEGMENTS;
                float ySegment = (float)y / (float)Y_SEGMENTS;
                float xPos = std::cos(xSegment * 2.0f * PI) * std::sin(ySegment * PI);
                float yPos = std::cos(ySegment * PI);
                float zPos = std::sin(xSegment * 2.0f * PI) * std::sin(ySegment * PI);

                Vertex vertex;
                vertex.position = XMFLOAT3(xPos, yPos, zPos);
                vertex.normal = XMFLOAT3(xPos, yPos, zPos);
                // learnopengl.com's uv is (xSegment, ySegment); v flipped (1 - v), because
                // Direct3D's v = 0 is the image's top row (OpenGL's is the bottom row)
                vertex.texCoord = XMFLOAT2(xSegment, 1.0f - ySegment);
                // the tangent: the direction in which the texture's u grows on the surface (the position's derivative by u, normalised)
                vertex.tangent = XMFLOAT3(-std::sin(xSegment * 2.0f * PI), 0.0f, std::cos(xSegment * 2.0f * PI));
                vertices.push_back(vertex);
            }
        }

        bool oddRow = false;
        for (unsigned int y = 0; y < Y_SEGMENTS; ++y)
        {
            if (!oddRow) // even rows: y == 0, y == 2; and so on
            {
                for (unsigned int x = 0; x <= X_SEGMENTS; ++x)
                {
                    indices.push_back(y       * (X_SEGMENTS + 1) + x);
                    indices.push_back((y + 1) * (X_SEGMENTS + 1) + x);
                }
            }
            else
            {
                for (int x = X_SEGMENTS; x >= 0; --x)
                {
                    indices.push_back((y + 1) * (X_SEGMENTS + 1) + x);
                    indices.push_back(y       * (X_SEGMENTS + 1) + x);
                }
            }
            oddRow = !oddRow;
        }
        m_indexCount = static_cast<UINT>(indices.size());

        const UINT vertexBufferSize = static_cast<UINT>(vertices.size() * sizeof(Vertex));
        const UINT indexBufferSize = static_cast<UINT>(indices.size() * sizeof(UINT));

        // Note: using upload heaps to transfer static data like vert buffers is not
        // recommended. Every time the GPU needs it, the upload heap will be marshalled
        // over. Please read up on Default Heap usage. An upload heap is used here for
        // code simplicity and because there are very few verts to actually transfer.
        CD3DX12_HEAP_PROPERTIES heapProperties(D3D12_HEAP_TYPE_UPLOAD);
        CD3DX12_RESOURCE_DESC vertexBufferDesc = CD3DX12_RESOURCE_DESC::Buffer(vertexBufferSize);
        ThrowIfFailed(m_device->CreateCommittedResource(
            &heapProperties,
            D3D12_HEAP_FLAG_NONE,
            &vertexBufferDesc,
            D3D12_RESOURCE_STATE_GENERIC_READ,
            nullptr,
            IID_PPV_ARGS(&m_sphereVertexBuffer)));

        // Copy the vertex data to the vertex buffer.
        UINT8* pVertexDataBegin = nullptr;
        CD3DX12_RANGE readRange(0, 0);        // We do not intend to read from this resource on the CPU.
        ThrowIfFailed(m_sphereVertexBuffer->Map(0, &readRange, reinterpret_cast<void**>(&pVertexDataBegin)));
        memcpy(pVertexDataBegin, vertices.data(), vertexBufferSize);
        m_sphereVertexBuffer->Unmap(0, nullptr);

        // Initialize the vertex buffer view.
        m_sphereVertexBufferView.BufferLocation = m_sphereVertexBuffer->GetGPUVirtualAddress();
        m_sphereVertexBufferView.StrideInBytes = sizeof(Vertex);
        m_sphereVertexBufferView.SizeInBytes = vertexBufferSize;

        // The index buffer, in the same way.
        CD3DX12_RESOURCE_DESC indexBufferDesc = CD3DX12_RESOURCE_DESC::Buffer(indexBufferSize);
        ThrowIfFailed(m_device->CreateCommittedResource(
            &heapProperties,
            D3D12_HEAP_FLAG_NONE,
            &indexBufferDesc,
            D3D12_RESOURCE_STATE_GENERIC_READ,
            nullptr,
            IID_PPV_ARGS(&m_sphereIndexBuffer)));

        // Copy the index data to the index buffer.
        UINT8* pIndexDataBegin = nullptr;
        ThrowIfFailed(m_sphereIndexBuffer->Map(0, &readRange, reinterpret_cast<void**>(&pIndexDataBegin)));
        memcpy(pIndexDataBegin, indices.data(), indexBufferSize);
        m_sphereIndexBuffer->Unmap(0, nullptr);

        // Initialize the index buffer view: 32-bit indices.
        m_sphereIndexBufferView.BufferLocation = m_sphereIndexBuffer->GetGPUVirtualAddress();
        m_sphereIndexBufferView.Format = DXGI_FORMAT_R32_UINT;
        m_sphereIndexBufferView.SizeInBytes = indexBufferSize;
    }

    // Create the vertex buffer of the cube and the screen quad: one buffer for both, a draw
    // picks its object with the first vertex it starts from.
    {
        // The tangent is left out (zero): nothing uses it for these two.
        Vertex vertices[] =
        {
            // the cube: vertices 0 to 35 - learnopengl's renderCube, a cube from -1 to 1. The
            // capture passes and the background draw it from the inside.
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
            { { -1.0f,  1.0f,  1.0f }, {  0.0f,  1.0f,  0.0f }, {  0.0f,  1.0f } },

            // the screen quad: vertices 36 to 39 - learnopengl's renderQuad, a triangle strip
            // that fills the whole render target, in normalized device coordinates. The
            // texture coordinates are learnopengl.com's with v flipped (1 - v): Direct3D's
            // v = 0 is the top row.
            { { -1.0f,  1.0f,  0.0f }, {  0.0f,  0.0f,  1.0f }, {  0.0f,  0.0f } },
            { { -1.0f, -1.0f,  0.0f }, {  0.0f,  0.0f,  1.0f }, {  0.0f,  1.0f } },
            { {  1.0f,  1.0f,  0.0f }, {  0.0f,  0.0f,  1.0f }, {  1.0f,  0.0f } },
            { {  1.0f, -1.0f,  0.0f }, {  0.0f,  0.0f,  1.0f }, {  1.0f,  1.0f } }
        };

        const UINT vertexBufferSize = sizeof(vertices);

        CD3DX12_HEAP_PROPERTIES heapProperties(D3D12_HEAP_TYPE_UPLOAD);
        CD3DX12_RESOURCE_DESC bufferDesc = CD3DX12_RESOURCE_DESC::Buffer(vertexBufferSize);
        ThrowIfFailed(m_device->CreateCommittedResource(
            &heapProperties,
            D3D12_HEAP_FLAG_NONE,
            &bufferDesc,
            D3D12_RESOURCE_STATE_GENERIC_READ,
            nullptr,
            IID_PPV_ARGS(&m_cubeVertexBuffer)));

        // Copy the vertex data to the vertex buffer.
        UINT8* pVertexDataBegin = nullptr;
        CD3DX12_RANGE readRange(0, 0);        // We do not intend to read from this resource on the CPU.
        ThrowIfFailed(m_cubeVertexBuffer->Map(0, &readRange, reinterpret_cast<void**>(&pVertexDataBegin)));
        memcpy(pVertexDataBegin, vertices, sizeof(vertices));
        m_cubeVertexBuffer->Unmap(0, nullptr);

        // Initialize the vertex buffer view.
        m_cubeVertexBufferView.BufferLocation = m_cubeVertexBuffer->GetGPUVirtualAddress();
        m_cubeVertexBufferView.StrideInBytes = sizeof(Vertex);
        m_cubeVertexBufferView.SizeInBytes = vertexBufferSize;
    }

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

    // pbr: load the HDR environment map
    // ---------------------------------
    // A floating-point 2D texture, its SRV in slot 1 of the CBV/SRV heap. The upload buffer
    // must stay alive until the command list that copies from it has executed (the end of
    // this method waits for it).
    ComPtr<ID3D12Resource> hdrTextureUploadHeap;
    LoadHdrTexture("environment.hdr", m_hdrTexture, hdrTextureUploadHeap, 1);

    // pbr: setup cubemap to render to
    // -------------------------------
    {
        // A cube map is a 2D texture with six array slices, the faces +X, -X, +Y, -Y, +Z, -Z:
        // 128 x 128 each (learnopengl: 512 x 512), floating-point, with all its mip levels
        // down to 1 x 1 (the pre-filter pass reads them: combatting visible dots artifact),
        // and it can be a render target. It starts in the RENDER_TARGET state: it is drawn
        // into first.
        CD3DX12_HEAP_PROPERTIES heapProperties(D3D12_HEAP_TYPE_DEFAULT);
        CD3DX12_RESOURCE_DESC textureDesc = CD3DX12_RESOURCE_DESC::Tex2D(DXGI_FORMAT_R16G16B16A16_FLOAT, 128, 128, 6, EnvMipLevels, 1, 0, D3D12_RESOURCE_FLAG_ALLOW_RENDER_TARGET);
        ThrowIfFailed(m_device->CreateCommittedResource(
            &heapProperties,
            D3D12_HEAP_FLAG_NONE,
            &textureDesc,
            D3D12_RESOURCE_STATE_RENDER_TARGET,
            nullptr,
            IID_PPV_ARGS(&m_envCubemap)));

        // A cube map shader resource view, to read it with a direction (TextureCube): slot 2
        // of the CBV/SRV heap. It shows all the mip levels; the sampler filters between them
        // (MIN_MAG_MIP_LINEAR - learnopengl: GL_LINEAR_MIPMAP_LINEAR).
        D3D12_SHADER_RESOURCE_VIEW_DESC srvDesc = {};
        srvDesc.Shader4ComponentMapping = D3D12_DEFAULT_SHADER_4_COMPONENT_MAPPING;
        srvDesc.Format = DXGI_FORMAT_R16G16B16A16_FLOAT;
        srvDesc.ViewDimension = D3D12_SRV_DIMENSION_TEXTURECUBE;
        srvDesc.TextureCube.MostDetailedMip = 0;
        srvDesc.TextureCube.MipLevels = EnvMipLevels;
        CD3DX12_CPU_DESCRIPTOR_HANDLE srvHandle(m_cbvSrvHeap->GetCPUDescriptorHandleForHeapStart(), 2, m_cbvSrvDescriptorSize);
        m_device->CreateShaderResourceView(m_envCubemap.Get(), &srvDesc, srvHandle);
    }

    // pbr: set up projection and view matrices for capturing data onto the 6 cubemap face directions
    // ----------------------------------------------------------------------------------------------
    // A field of view of 90 degrees and an aspect ratio of 1: one face of the cube fills the
    // view exactly. The scaling flips y: Direct3D puts the top of the picture (y = +1) into
    // a render target's first row, OpenGL the bottom - with learnopengl's directions and ups
    // every face would be stored upside down otherwise.
    XMMATRIX captureProjection = XMMatrixPerspectiveFovRH(XMConvertToRadians(90.0f), 1.0f, 0.1f, 10.0f) * XMMatrixScaling(1.0f, -1.0f, 1.0f);
    XMVECTOR eye = XMVectorSet(0.0f, 0.0f, 0.0f, 0.0f);
    XMMATRIX captureViews[] =
    {
        XMMatrixLookAtRH(eye, XMVectorSet( 1.0f,  0.0f,  0.0f, 0.0f), XMVectorSet(0.0f, -1.0f,  0.0f, 0.0f)),
        XMMatrixLookAtRH(eye, XMVectorSet(-1.0f,  0.0f,  0.0f, 0.0f), XMVectorSet(0.0f, -1.0f,  0.0f, 0.0f)),
        XMMatrixLookAtRH(eye, XMVectorSet( 0.0f,  1.0f,  0.0f, 0.0f), XMVectorSet(0.0f,  0.0f,  1.0f, 0.0f)),
        XMMatrixLookAtRH(eye, XMVectorSet( 0.0f, -1.0f,  0.0f, 0.0f), XMVectorSet(0.0f,  0.0f, -1.0f, 0.0f)),
        XMMatrixLookAtRH(eye, XMVectorSet( 0.0f,  0.0f,  1.0f, 0.0f), XMVectorSet(0.0f, -1.0f,  0.0f, 0.0f)),
        XMMatrixLookAtRH(eye, XMVectorSet( 0.0f,  0.0f, -1.0f, 0.0f), XMVectorSet(0.0f, -1.0f,  0.0f, 0.0f))
    };

    // The capture passes below are recorded into the command list here, once: it is executed
    // at the end of LoadAssets, before the first frame (learnopengl runs them before its
    // render loop). Like a frame, they need the root signature and the descriptor heap.
    m_commandList->SetGraphicsRootSignature(m_rootSignature.Get());
    ID3D12DescriptorHeap* ppHeaps[] = { m_cbvSrvHeap.Get() };
    m_commandList->SetDescriptorHeaps(_countof(ppHeaps), ppHeaps);
    m_commandList->SetGraphicsRootDescriptorTable(1, m_cbvSrvHeap->GetGPUDescriptorHandleForHeapStart());

    // pbr: convert HDR equirectangular environment map to cubemap equivalent
    // ----------------------------------------------------------------------
    {
        m_commandList->SetPipelineState(m_equirectangularToCubemapPipelineState.Get());
        // The texture the pass reads (root parameter 2): the HDR texture, heap slot 1.
        CD3DX12_GPU_DESCRIPTOR_HANDLE hdrTexture(m_cbvSrvHeap->GetGPUDescriptorHandleForHeapStart(), 1, m_cbvSrvDescriptorSize);
        m_commandList->SetGraphicsRootDescriptorTable(2, hdrTexture);

        CD3DX12_VIEWPORT viewport(0.0f, 0.0f, 128.0f, 128.0f); // don't forget to configure the viewport to the capture dimensions.
        CD3DX12_RECT scissorRect(0, 0, 128, 128);
        m_commandList->RSSetViewports(1, &viewport);
        m_commandList->RSSetScissorRects(1, &scissorRect);

        CaptureConstants captureConstants = {};
        XMStoreFloat4x4(&captureConstants.captureProjection, XMMatrixTranspose(captureProjection));
        for (unsigned int i = 0; i < 6; ++i)
        {
            XMStoreFloat4x4(&captureConstants.captureView, XMMatrixTranspose(captureViews[i]));
            m_commandList->SetGraphicsRoot32BitConstants(0, sizeof(CaptureConstants) / 4, &captureConstants, 0);
            SetCaptureTarget(m_envCubemap.Get(), i, 0);

            // No clear: the cube covers every pixel of the face.
            RenderCube();
        }

        // The first mip level is complete: from now on shaders read it. Only this level's
        // six subresources (one per face) change their state: the smaller levels are still
        // to be drawn.
        CD3DX12_RESOURCE_BARRIER barriers[6];
        for (UINT i = 0; i < 6; ++i)
        {
            barriers[i] = CD3DX12_RESOURCE_BARRIER::Transition(m_envCubemap.Get(), D3D12_RESOURCE_STATE_RENDER_TARGET, D3D12_RESOURCE_STATE_PIXEL_SHADER_RESOURCE, D3D12CalcSubresource(0, i, 0, EnvMipLevels, 6));
        }
        m_commandList->ResourceBarrier(6, barriers);
    }

    // then generate mipmaps from first mip face (combatting visible dots artifact)
    // ----------------------------------------------------------------------------
    // learnopengl: glGenerateMipmap(GL_TEXTURE_CUBE_MAP). Direct3D 12 has no such call: here
    // every level is drawn from the level above it, with the same six views. A pixel of the
    // smaller face lies exactly between 2 x 2 texels of the larger one, and the linear filter
    // returns their average.
    {
        m_commandList->SetPipelineState(m_downsamplePipelineState.Get());

        CaptureConstants captureConstants = {};
        XMStoreFloat4x4(&captureConstants.captureProjection, XMMatrixTranspose(captureProjection));
        for (UINT mip = 1; mip < EnvMipLevels; ++mip)
        {
            // The texture the pass reads (root parameter 2): a view of the level above only
            // (MostDetailedMip = mip - 1, one level), in heap slot 6 + (mip - 1). A level cannot
            // be read while it is drawn into: this view leaves the level that is drawn into out.
            D3D12_SHADER_RESOURCE_VIEW_DESC srvDesc = {};
            srvDesc.Shader4ComponentMapping = D3D12_DEFAULT_SHADER_4_COMPONENT_MAPPING;
            srvDesc.Format = DXGI_FORMAT_R16G16B16A16_FLOAT;
            srvDesc.ViewDimension = D3D12_SRV_DIMENSION_TEXTURECUBE;
            srvDesc.TextureCube.MostDetailedMip = mip - 1;
            srvDesc.TextureCube.MipLevels = 1;
            CD3DX12_CPU_DESCRIPTOR_HANDLE srvHandle(m_cbvSrvHeap->GetCPUDescriptorHandleForHeapStart(), 6 + (mip - 1), m_cbvSrvDescriptorSize);
            m_device->CreateShaderResourceView(m_envCubemap.Get(), &srvDesc, srvHandle);
            CD3DX12_GPU_DESCRIPTOR_HANDLE previousMip(m_cbvSrvHeap->GetGPUDescriptorHandleForHeapStart(), 6 + (mip - 1), m_cbvSrvDescriptorSize);
            m_commandList->SetGraphicsRootDescriptorTable(2, previousMip);

            unsigned int mipSize = 128 >> mip;    // 64, 32, 16, 8, 4, 2, 1
            CD3DX12_VIEWPORT viewport(0.0f, 0.0f, static_cast<float>(mipSize), static_cast<float>(mipSize));
            CD3DX12_RECT scissorRect(0, 0, static_cast<LONG>(mipSize), static_cast<LONG>(mipSize));
            m_commandList->RSSetViewports(1, &viewport);
            m_commandList->RSSetScissorRects(1, &scissorRect);

            for (unsigned int i = 0; i < 6; ++i)
            {
                XMStoreFloat4x4(&captureConstants.captureView, XMMatrixTranspose(captureViews[i]));
                m_commandList->SetGraphicsRoot32BitConstants(0, sizeof(CaptureConstants) / 4, &captureConstants, 0);
                SetCaptureTarget(m_envCubemap.Get(), i, mip);

                RenderCube();
            }

            // This level is complete too: the next one, and later the shaders, read it.
            CD3DX12_RESOURCE_BARRIER barriers[6];
            for (UINT i = 0; i < 6; ++i)
            {
                barriers[i] = CD3DX12_RESOURCE_BARRIER::Transition(m_envCubemap.Get(), D3D12_RESOURCE_STATE_RENDER_TARGET, D3D12_RESOURCE_STATE_PIXEL_SHADER_RESOURCE, D3D12CalcSubresource(mip, i, 0, EnvMipLevels, 6));
            }
            m_commandList->ResourceBarrier(6, barriers);
        }
    }

    // pbr: create an irradiance cubemap
    // ---------------------------------
    {
        // 32 x 32 per face is enough: the irradiance changes slowly with the direction.
        CD3DX12_HEAP_PROPERTIES heapProperties(D3D12_HEAP_TYPE_DEFAULT);
        CD3DX12_RESOURCE_DESC textureDesc = CD3DX12_RESOURCE_DESC::Tex2D(DXGI_FORMAT_R16G16B16A16_FLOAT, 32, 32, 6, 1, 1, 0, D3D12_RESOURCE_FLAG_ALLOW_RENDER_TARGET);
        ThrowIfFailed(m_device->CreateCommittedResource(
            &heapProperties,
            D3D12_HEAP_FLAG_NONE,
            &textureDesc,
            D3D12_RESOURCE_STATE_RENDER_TARGET,
            nullptr,
            IID_PPV_ARGS(&m_irradianceMap)));

        // Its cube map shader resource view: slot 3 of the CBV/SRV heap.
        D3D12_SHADER_RESOURCE_VIEW_DESC srvDesc = {};
        srvDesc.Shader4ComponentMapping = D3D12_DEFAULT_SHADER_4_COMPONENT_MAPPING;
        srvDesc.Format = DXGI_FORMAT_R16G16B16A16_FLOAT;
        srvDesc.ViewDimension = D3D12_SRV_DIMENSION_TEXTURECUBE;
        srvDesc.TextureCube.MostDetailedMip = 0;
        srvDesc.TextureCube.MipLevels = 1;
        CD3DX12_CPU_DESCRIPTOR_HANDLE srvHandle(m_cbvSrvHeap->GetCPUDescriptorHandleForHeapStart(), 3, m_cbvSrvDescriptorSize);
        m_device->CreateShaderResourceView(m_irradianceMap.Get(), &srvDesc, srvHandle);
    }

    // pbr: solve diffuse integral by convolution to create an irradiance (cube)map.
    // -----------------------------------------------------------------------------
    {
        m_commandList->SetPipelineState(m_irradiancePipelineState.Get());
        // The texture the pass reads (root parameter 2): the environment cube map, heap slot 2.
        CD3DX12_GPU_DESCRIPTOR_HANDLE envCubemap(m_cbvSrvHeap->GetGPUDescriptorHandleForHeapStart(), 2, m_cbvSrvDescriptorSize);
        m_commandList->SetGraphicsRootDescriptorTable(2, envCubemap);

        CD3DX12_VIEWPORT viewport(0.0f, 0.0f, 32.0f, 32.0f); // don't forget to configure the viewport to the capture dimensions.
        CD3DX12_RECT scissorRect(0, 0, 32, 32);
        m_commandList->RSSetViewports(1, &viewport);
        m_commandList->RSSetScissorRects(1, &scissorRect);

        CaptureConstants captureConstants = {};
        XMStoreFloat4x4(&captureConstants.captureProjection, XMMatrixTranspose(captureProjection));
        for (unsigned int i = 0; i < 6; ++i)
        {
            XMStoreFloat4x4(&captureConstants.captureView, XMMatrixTranspose(captureViews[i]));
            m_commandList->SetGraphicsRoot32BitConstants(0, sizeof(CaptureConstants) / 4, &captureConstants, 0);
            SetCaptureTarget(m_irradianceMap.Get(), i, 0);

            RenderCube();
        }

        // The irradiance map is complete: from now on shaders read it.
        CD3DX12_RESOURCE_BARRIER barrier = CD3DX12_RESOURCE_BARRIER::Transition(m_irradianceMap.Get(), D3D12_RESOURCE_STATE_RENDER_TARGET, D3D12_RESOURCE_STATE_PIXEL_SHADER_RESOURCE);
        m_commandList->ResourceBarrier(1, &barrier);
    }

    // pbr: create a pre-filter cubemap
    // --------------------------------
    {
        // 64 x 64 per face (learnopengl: 128 x 128) with 5 mip levels: 64, 32, 16, 8 and 4.
        CD3DX12_HEAP_PROPERTIES heapProperties(D3D12_HEAP_TYPE_DEFAULT);
        CD3DX12_RESOURCE_DESC textureDesc = CD3DX12_RESOURCE_DESC::Tex2D(DXGI_FORMAT_R16G16B16A16_FLOAT, 64, 64, 6, 5, 1, 0, D3D12_RESOURCE_FLAG_ALLOW_RENDER_TARGET);
        ThrowIfFailed(m_device->CreateCommittedResource(
            &heapProperties,
            D3D12_HEAP_FLAG_NONE,
            &textureDesc,
            D3D12_RESOURCE_STATE_RENDER_TARGET,
            nullptr,
            IID_PPV_ARGS(&m_prefilterMap)));

        // Its cube map shader resource view with all 5 levels: slot 4 of the CBV/SRV heap.
        // The sampler filters between the levels too (be sure the filter is mip_linear).
        D3D12_SHADER_RESOURCE_VIEW_DESC srvDesc = {};
        srvDesc.Shader4ComponentMapping = D3D12_DEFAULT_SHADER_4_COMPONENT_MAPPING;
        srvDesc.Format = DXGI_FORMAT_R16G16B16A16_FLOAT;
        srvDesc.ViewDimension = D3D12_SRV_DIMENSION_TEXTURECUBE;
        srvDesc.TextureCube.MostDetailedMip = 0;
        srvDesc.TextureCube.MipLevels = 5;
        CD3DX12_CPU_DESCRIPTOR_HANDLE srvHandle(m_cbvSrvHeap->GetCPUDescriptorHandleForHeapStart(), 4, m_cbvSrvDescriptorSize);
        m_device->CreateShaderResourceView(m_prefilterMap.Get(), &srvDesc, srvHandle);
    }

    // pbr: run a quasi monte-carlo simulation on the environment lighting to create a prefilter (cube)map.
    // ----------------------------------------------------------------------------------------------------
    {
        m_commandList->SetPipelineState(m_prefilterPipelineState.Get());
        // The texture the pass reads (root parameter 2): the environment cube map with all
        // its mip levels, heap slot 2.
        CD3DX12_GPU_DESCRIPTOR_HANDLE envCubemap(m_cbvSrvHeap->GetGPUDescriptorHandleForHeapStart(), 2, m_cbvSrvDescriptorSize);
        m_commandList->SetGraphicsRootDescriptorTable(2, envCubemap);

        CaptureConstants captureConstants = {};
        XMStoreFloat4x4(&captureConstants.captureProjection, XMMatrixTranspose(captureProjection));
        unsigned int maxMipLevels = 5;
        for (unsigned int mip = 0; mip < maxMipLevels; ++mip)
        {
            // resize the viewport according to mip-level size.
            unsigned int mipWidth  = static_cast<unsigned int>(64 * std::pow(0.5, mip));
            unsigned int mipHeight = static_cast<unsigned int>(64 * std::pow(0.5, mip));
            CD3DX12_VIEWPORT viewport(0.0f, 0.0f, static_cast<float>(mipWidth), static_cast<float>(mipHeight));
            CD3DX12_RECT scissorRect(0, 0, static_cast<LONG>(mipWidth), static_cast<LONG>(mipHeight));
            m_commandList->RSSetViewports(1, &viewport);
            m_commandList->RSSetScissorRects(1, &scissorRect);

            float roughness = (float)mip / (float)(maxMipLevels - 1);
            captureConstants.roughness = roughness;
            for (unsigned int i = 0; i < 6; ++i)
            {
                XMStoreFloat4x4(&captureConstants.captureView, XMMatrixTranspose(captureViews[i]));
                m_commandList->SetGraphicsRoot32BitConstants(0, sizeof(CaptureConstants) / 4, &captureConstants, 0);
                // The render target: face i of mip level mip.
                SetCaptureTarget(m_prefilterMap.Get(), i, mip);

                RenderCube();
            }
        }

        // The pre-filter map is complete, all its levels: from now on shaders read it.
        CD3DX12_RESOURCE_BARRIER barrier = CD3DX12_RESOURCE_BARRIER::Transition(m_prefilterMap.Get(), D3D12_RESOURCE_STATE_RENDER_TARGET, D3D12_RESOURCE_STATE_PIXEL_SHADER_RESOURCE);
        m_commandList->ResourceBarrier(1, &barrier);
    }

    // pbr: generate a 2D LUT from the BRDF equations used.
    // ----------------------------------------------------
    {
        // A 2D texture, 128 x 128 (learnopengl: 512 x 512), two channels of half-precision
        // floats, that can be a render target.
        CD3DX12_HEAP_PROPERTIES heapProperties(D3D12_HEAP_TYPE_DEFAULT);
        CD3DX12_RESOURCE_DESC textureDesc = CD3DX12_RESOURCE_DESC::Tex2D(DXGI_FORMAT_R16G16_FLOAT, 128, 128, 1, 1, 1, 0, D3D12_RESOURCE_FLAG_ALLOW_RENDER_TARGET);
        ThrowIfFailed(m_device->CreateCommittedResource(
            &heapProperties,
            D3D12_HEAP_FLAG_NONE,
            &textureDesc,
            D3D12_RESOURCE_STATE_RENDER_TARGET,
            nullptr,
            IID_PPV_ARGS(&m_brdfLUTTexture)));

        // Its shader resource view: slot 5 of the CBV/SRV heap, right after the pre-filter
        // map's. It is read with the clamping sampler s0 (be sure to set wrapping mode to
        // GL_CLAMP_TO_EDGE, learnopengl says).
        D3D12_SHADER_RESOURCE_VIEW_DESC srvDesc = {};
        srvDesc.Shader4ComponentMapping = D3D12_DEFAULT_SHADER_4_COMPONENT_MAPPING;
        srvDesc.Format = DXGI_FORMAT_R16G16_FLOAT;
        srvDesc.ViewDimension = D3D12_SRV_DIMENSION_TEXTURE2D;
        srvDesc.Texture2D.MipLevels = 1;
        CD3DX12_CPU_DESCRIPTOR_HANDLE srvHandle(m_cbvSrvHeap->GetCPUDescriptorHandleForHeapStart(), 5, m_cbvSrvDescriptorSize);
        m_device->CreateShaderResourceView(m_brdfLUTTexture.Get(), &srvDesc, srvHandle);

        // then render screen-space quad with BRDF shader: the lookup texture is the render
        // target, through the capture passes' descriptor of the RTV heap.
        CD3DX12_CPU_DESCRIPTOR_HANDLE rtvHandle(m_rtvHeap->GetCPUDescriptorHandleForHeapStart(), FrameCount, m_rtvDescriptorSize);
        m_device->CreateRenderTargetView(m_brdfLUTTexture.Get(), nullptr, rtvHandle);
        m_commandList->OMSetRenderTargets(1, &rtvHandle, FALSE, nullptr);

        CD3DX12_VIEWPORT viewport(0.0f, 0.0f, 128.0f, 128.0f);
        CD3DX12_RECT scissorRect(0, 0, 128, 128);
        m_commandList->RSSetViewports(1, &viewport);
        m_commandList->RSSetScissorRects(1, &scissorRect);

        m_commandList->SetPipelineState(m_brdfPipelineState.Get());
        RenderQuad();

        // The lookup texture is complete: from now on shaders read it.
        CD3DX12_RESOURCE_BARRIER barrier = CD3DX12_RESOURCE_BARRIER::Transition(m_brdfLUTTexture.Get(), D3D12_RESOURCE_STATE_RENDER_TARGET, D3D12_RESOURCE_STATE_PIXEL_SHADER_RESOURCE);
        m_commandList->ResourceBarrier(1, &barrier);
    }

    // load PBR material textures: their SRVs go into the heap one after the other (slots 13
    // to 17), so one descriptor table covers them. The upload buffers must stay alive until
    // the command list that copies from them has executed (the end of this method waits for
    // it). All five are loaded as they are (UNORM): the albedo's colours are converted to
    // linear in the shader, the others are data, not colours.
    ComPtr<ID3D12Resource> albedoUploadHeap;
    LoadTexture("albedo.png", m_albedoTexture, albedoUploadHeap, 13);
    ComPtr<ID3D12Resource> normalUploadHeap;
    LoadTexture("normal.png", m_normalTexture, normalUploadHeap, 14);
    ComPtr<ID3D12Resource> metallicUploadHeap;
    LoadTexture("metallic.png", m_metallicTexture, metallicUploadHeap, 15);
    ComPtr<ID3D12Resource> roughnessUploadHeap;
    LoadTexture("roughness.png", m_roughnessTexture, roughnessUploadHeap, 16);
    ComPtr<ID3D12Resource> aoUploadHeap;
    LoadTexture("ao.png", m_aoTexture, aoUploadHeap, 17);

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

    // The lights (learnopengl: shader.setVec3("lightPositions[0]", ...) and so on) and the
    // camera's position.
    for (unsigned int i = 0; i < sizeof(lightPositions) / sizeof(lightPositions[0]); ++i)
    {
        constantBufferData.lightPositions[i] = lightPositions[i];
        constantBufferData.lightColors[i] = lightColors[i];
    }
    XMStoreFloat3(&constantBufferData.camPos, cameraPos);
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

    // bind pre-computed IBL data: the irradiance map (heap slot 3) as the texture of root
    // parameter 2 for the spheres, and the pre-filter map and the BRDF lookup texture (heap
    // slots 4 and 5) as the table of root parameter 3
    CD3DX12_GPU_DESCRIPTOR_HANDLE irradianceMap(m_cbvSrvHeap->GetGPUDescriptorHandleForHeapStart(), 3, m_cbvSrvDescriptorSize);
    m_commandList->SetGraphicsRootDescriptorTable(2, irradianceMap);
    CD3DX12_GPU_DESCRIPTOR_HANDLE prefilterMap(m_cbvSrvHeap->GetGPUDescriptorHandleForHeapStart(), 4, m_cbvSrvDescriptorSize);
    m_commandList->SetGraphicsRootDescriptorTable(3, prefilterMap);
    // the material's maps: the table of root parameter 4, from heap slot 13 on
    CD3DX12_GPU_DESCRIPTOR_HANDLE materialTextures(m_cbvSrvHeap->GetGPUDescriptorHandleForHeapStart(), 13, m_cbvSrvDescriptorSize);
    m_commandList->SetGraphicsRootDescriptorTable(4, materialTextures);
    RenderScene();

    // render skybox (render as last to prevent overdraw): the background's pipeline state,
    // and the environment cube map (heap slot 2) as the texture of root parameter 2
    m_commandList->SetPipelineState(m_backgroundPipelineState.Get());
    CD3DX12_GPU_DESCRIPTOR_HANDLE envCubemap(m_cbvSrvHeap->GetGPUDescriptorHandleForHeapStart(), 2, m_cbvSrvDescriptorSize);
    m_commandList->SetGraphicsRootDescriptorTable(2, envCubemap);
    RenderCube();

    // Indicate that the back buffer will now be used to present.
    barrier = CD3DX12_RESOURCE_BARRIER::Transition(m_renderTargets[m_frameIndex].Get(), D3D12_RESOURCE_STATE_RENDER_TARGET, D3D12_RESOURCE_STATE_PRESENT);
    m_commandList->ResourceBarrier(1, &barrier);

    ThrowIfFailed(m_commandList->Close());
}

// The scene (learnopengl's ibl_specular_textured.cpp): 3 x 3 large spheres, each with its
// model matrix and its normal matrix in the root constants (root parameter 0). With row
// vectors the matrices apply from left to right: scale, then rotate, then translate
// (learnopengl's translate * rotate * scale). The normal matrix is the transpose of the
// inverse of the model matrix; stored transposed for HLSL, that is the inverse itself.
void D3D12App::RenderScene()
{
    ModelConstants modelConstants = {};

    // render rows*column number of spheres with material properties defined by textures (they all have the same material properties)
    for (int row = 0; row < nrRows; ++row)
    {
        for (int col = 0; col < nrColumns; ++col)
        {
            XMMATRIX model = XMMatrixScaling(2.4f, 2.4f, 2.4f)
                * XMMatrixRotationY(XMConvertToRadians(90.0f)) // turn the middle of the textures towards the camera
                * XMMatrixTranslation(
                    (float)(col - (nrColumns / 2)) * spacing,
                    (float)(row - (nrRows / 2)) * spacing,
                    0.0f);
            XMStoreFloat4x4(&modelConstants.model, XMMatrixTranspose(model));
            XMStoreFloat4x4(&modelConstants.normalMatrix, XMMatrixInverse(nullptr, model));
            m_commandList->SetGraphicsRoot32BitConstants(0, sizeof(ModelConstants) / 4, &modelConstants, 0);
            RenderSphere();
        }
    }
}

// Draws the sphere (learnopengl's renderSphere): its vertices and indices, as one triangle
// strip - every index after the first two makes a triangle with the two before it.
void D3D12App::RenderSphere()
{
    m_commandList->IASetPrimitiveTopology(D3D_PRIMITIVE_TOPOLOGY_TRIANGLESTRIP);
    m_commandList->IASetVertexBuffers(0, 1, &m_sphereVertexBufferView);
    m_commandList->IASetIndexBuffer(&m_sphereIndexBufferView);
    m_commandList->DrawIndexedInstanced(m_indexCount, 1, 0, 0, 0);
}

// Draws the cube (learnopengl's renderCube): vertices 0 to 35, a triangle list.
void D3D12App::RenderCube()
{
    m_commandList->IASetPrimitiveTopology(D3D_PRIMITIVE_TOPOLOGY_TRIANGLELIST);
    m_commandList->IASetVertexBuffers(0, 1, &m_cubeVertexBufferView);
    m_commandList->DrawInstanced(36, 1, 0, 0);
}

// Draws the screen quad (learnopengl's renderQuad): vertices 36 to 39, a triangle strip.
void D3D12App::RenderQuad()
{
    m_commandList->IASetPrimitiveTopology(D3D_PRIMITIVE_TOPOLOGY_TRIANGLESTRIP);
    m_commandList->IASetVertexBuffers(0, 1, &m_cubeVertexBufferView);
    m_commandList->DrawInstanced(4, 1, 36, 0);
}

// Makes one face of a cube map, at one mip level, the render target (learnopengl:
// glFramebufferTexture2D(GL_FRAMEBUFFER, GL_COLOR_ATTACHMENT0, GL_TEXTURE_CUBE_MAP_POSITIVE_X
// + face, cubemap, mip) on its captureFBO). All capture passes share one descriptor of the
// RTV heap, the one after the swap chain's buffers: OMSetRenderTargets records the
// descriptor's contents into the command list, so it can be overwritten right after.
void D3D12App::SetCaptureTarget(ID3D12Resource* cubemap, UINT face, UINT mip)
{
    // The view covers one array slice (the face) of one mip level of the cube map.
    D3D12_RENDER_TARGET_VIEW_DESC rtvDesc = {};
    rtvDesc.Format = DXGI_FORMAT_R16G16B16A16_FLOAT;
    rtvDesc.ViewDimension = D3D12_RTV_DIMENSION_TEXTURE2DARRAY;
    rtvDesc.Texture2DArray.MipSlice = mip;
    rtvDesc.Texture2DArray.FirstArraySlice = face;
    rtvDesc.Texture2DArray.ArraySize = 1;

    CD3DX12_CPU_DESCRIPTOR_HANDLE rtvHandle(m_rtvHeap->GetCPUDescriptorHandleForHeapStart(), FrameCount, m_rtvDescriptorSize);
    m_device->CreateRenderTargetView(cubemap, &rtvDesc, rtvHandle);
    m_commandList->OMSetRenderTargets(1, &rtvHandle, FALSE, nullptr);
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

// Utility function for loading a Radiance .hdr image as a floating-point 2D texture: like
// LoadTexture, but the pixels are floats (stbi_loadf) and so is the texture's format.
void D3D12App::LoadHdrTexture(const char* path, ComPtr<ID3D12Resource>& texture, ComPtr<ID3D12Resource>& uploadHeap, UINT descriptorIndex)
{
    // Load the image as RGBA with a float per channel, the layout of
    // DXGI_FORMAT_R32G32B32A32_FLOAT. No vertical flip: in Direct3D, texture coordinate
    // v = 0 is the image's top row (learnopengl flips: stbi_set_flip_vertically_on_load(true)).
    int width, height, nrComponents;
    float* data = stbi_loadf(path, &width, &height, &nrComponents, 4);
    if (data == nullptr)
    {
        throw std::runtime_error("Failed to load HDR image.");
    }

    // Describe and create a Texture2D in a default heap, in the COPY_DEST state.
    D3D12_RESOURCE_DESC textureDesc = {};
    textureDesc.MipLevels = 1;
    textureDesc.Format = DXGI_FORMAT_R32G32B32A32_FLOAT;    // note how we specify the texture's data value to be float
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

    // The upload heap, as in LoadTexture.
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

    // Copy data to the intermediate upload heap and schedule a copy from the upload heap
    // to the Texture2D.
    D3D12_SUBRESOURCE_DATA textureData = {};
    textureData.pData = data;
    textureData.RowPitch = width * 4 * sizeof(float);          // bytes per row: 4 floats per pixel
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
