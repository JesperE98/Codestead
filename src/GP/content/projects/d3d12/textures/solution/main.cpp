// A Direct3D 12 program in one file, modelled on Microsoft's D3D12HelloWorld samples
// (D3D12HelloWindow, D3D12HelloTriangle, D3D12HelloTexture).

#include <windows.h>
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

#include <climits>
#include <cstdio>
#include <cstring>
#include <stdexcept>

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

class D3D12App
{
public:
    D3D12App(UINT width, UINT height);

    void OnInit(HWND hwnd);
    void OnUpdate();
    void OnRender();
    void OnDestroy();
    void OnKeyDown(UINT8 key);

private:
    static const UINT FrameCount = 2;

    struct Vertex
    {
        XMFLOAT3 position;
        XMFLOAT3 color;
        XMFLOAT2 texCoord;
    };

    // The root constants: what the pixel shader sees as cbuffer MixConstants.
    struct MixConstants
    {
        float mixValue;
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
    ComPtr<ID3D12DescriptorHeap> m_srvHeap;
    ComPtr<ID3D12PipelineState> m_pipelineState;
    ComPtr<ID3D12GraphicsCommandList> m_commandList;
    UINT m_rtvDescriptorSize = 0;
    UINT m_srvDescriptorSize = 0;

    // App resources.
    ComPtr<ID3D12Resource> m_vertexBuffer;
    D3D12_VERTEX_BUFFER_VIEW m_vertexBufferView = {};
    ComPtr<ID3D12Resource> m_indexBuffer;
    D3D12_INDEX_BUFFER_VIEW m_indexBufferView = {};
    ComPtr<ID3D12Resource> m_texture1;
    ComPtr<ID3D12Resource> m_texture2;
    float m_mixValue = 0.5f;    // how much of the face shows: 0 = none, 1 = only the face

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

        // Describe and create a shader resource view (SRV) heap for the texture.
        // Shader visible: the shaders can read the descriptors in it.
        D3D12_DESCRIPTOR_HEAP_DESC srvHeapDesc = {};
        srvHeapDesc.NumDescriptors = 2;
        srvHeapDesc.Type = D3D12_DESCRIPTOR_HEAP_TYPE_CBV_SRV_UAV;
        srvHeapDesc.Flags = D3D12_DESCRIPTOR_HEAP_FLAG_SHADER_VISIBLE;
        ThrowIfFailed(m_device->CreateDescriptorHeap(&srvHeapDesc, IID_PPV_ARGS(&m_srvHeap)));

        m_rtvDescriptorSize = m_device->GetDescriptorHandleIncrementSize(D3D12_DESCRIPTOR_HEAP_TYPE_RTV);
        m_srvDescriptorSize = m_device->GetDescriptorHandleIncrementSize(D3D12_DESCRIPTOR_HEAP_TYPE_CBV_SRV_UAV);
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
        // Root parameter 0: a descriptor table with one range of SRVs - 2 SRVs,
        // starting at register t0 (t0 and t1). Only the pixel shader reads it.
        CD3DX12_DESCRIPTOR_RANGE ranges[1];
        ranges[0].Init(D3D12_DESCRIPTOR_RANGE_TYPE_SRV, 2, 0);

        // Root parameter 1: root constants for register b0 (the mix value), also
        // only for the pixel shader.
        CD3DX12_ROOT_PARAMETER rootParameters[2];
        rootParameters[0].InitAsDescriptorTable(1, &ranges[0], D3D12_SHADER_VISIBILITY_PIXEL);
        rootParameters[1].InitAsConstants(sizeof(MixConstants) / 4, 0, 0, D3D12_SHADER_VISIBILITY_PIXEL);

        // A static sampler is part of the root signature itself (no descriptor needed).
        // Sampler s0: linear filtering; texture coordinates outside 0..1 wrap around.
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

        // Sampler s1: the same, but coordinates outside 0..1 are clamped to the edge.
        samplers[1] = samplers[0];
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

        // Compile the vertex shader (VSMain) and the pixel shader (PSMain) in shaders.hlsl.
        ThrowIfFailed(D3DCompileFromFile(L"shaders.hlsl", nullptr, nullptr, "VSMain", "vs_5_0", compileFlags, 0, &vertexShader, nullptr));
        ThrowIfFailed(D3DCompileFromFile(L"shaders.hlsl", nullptr, nullptr, "PSMain", "ps_5_0", compileFlags, 0, &pixelShader, nullptr));

        // Define the vertex input layout.
        D3D12_INPUT_ELEMENT_DESC inputElementDescs[] =
        {
            { "POSITION", 0, DXGI_FORMAT_R32G32B32_FLOAT, 0, 0, D3D12_INPUT_CLASSIFICATION_PER_VERTEX_DATA, 0 },
            { "COLOR", 0, DXGI_FORMAT_R32G32B32_FLOAT, 0, 12, D3D12_INPUT_CLASSIFICATION_PER_VERTEX_DATA, 0 },
            { "TEXCOORD", 0, DXGI_FORMAT_R32G32_FLOAT, 0, 24, D3D12_INPUT_CLASSIFICATION_PER_VERTEX_DATA, 0 }
        };

        // Describe and create the graphics pipeline state object (PSO).
        D3D12_GRAPHICS_PIPELINE_STATE_DESC psoDesc = {};
        psoDesc.InputLayout = { inputElementDescs, _countof(inputElementDescs) };
        psoDesc.pRootSignature = m_rootSignature.Get();
        psoDesc.VS = CD3DX12_SHADER_BYTECODE(vertexShader.Get());
        psoDesc.PS = CD3DX12_SHADER_BYTECODE(pixelShader.Get());
        psoDesc.RasterizerState = CD3DX12_RASTERIZER_DESC(D3D12_DEFAULT);
        psoDesc.BlendState = CD3DX12_BLEND_DESC(D3D12_DEFAULT);
        psoDesc.DepthStencilState.DepthEnable = FALSE;
        psoDesc.DepthStencilState.StencilEnable = FALSE;
        psoDesc.SampleMask = UINT_MAX;
        psoDesc.PrimitiveTopologyType = D3D12_PRIMITIVE_TOPOLOGY_TYPE_TRIANGLE;
        psoDesc.NumRenderTargets = 1;
        psoDesc.RTVFormats[0] = DXGI_FORMAT_R8G8B8A8_UNORM;
        psoDesc.SampleDesc.Count = 1;
        ThrowIfFailed(m_device->CreateGraphicsPipelineState(&psoDesc, IID_PPV_ARGS(&m_pipelineState)));
    }

    // Create the command list.
    ThrowIfFailed(m_device->CreateCommandList(0, D3D12_COMMAND_LIST_TYPE_DIRECT, m_commandAllocator.Get(), m_pipelineState.Get(), IID_PPV_ARGS(&m_commandList)));

    // Command lists are created in the recording state. This one stays open: the
    // texture upload below is recorded into it, and it is executed at the end.

    // Create the vertex buffer.
    {
        // Define the four corners of a rectangle, each with its own colour and texture
        // coordinates. Direct3D's texture coordinates start at the image's top left
        // corner (0, 0); (1, 1) is its bottom right corner.
        Vertex vertices[] =
        {
            // position               color                  texture coords
            { { 0.5f, 0.5f, 0.0f },   { 1.0f, 0.0f, 0.0f },  { 2.0f, 0.0f } },    // top right: red
            { { 0.5f, -0.5f, 0.0f },  { 0.0f, 1.0f, 0.0f },  { 2.0f, 2.0f } },    // bottom right: green
            { { -0.5f, -0.5f, 0.0f }, { 0.0f, 0.0f, 1.0f },  { 0.0f, 2.0f } },    // bottom left: blue
            { { -0.5f, 0.5f, 0.0f },  { 1.0f, 1.0f, 0.0f },  { 0.0f, 0.0f } }     // top left: yellow
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

    // Create the index buffer.
    {
        // The rectangle's two triangles, as indices into the vertex buffer. Both are
        // clockwise on screen (front faces): top right, bottom right, top left and
        // bottom right, bottom left, top left.
        UINT indices[] =
        {
            0, 1, 3,   // first triangle
            1, 2, 3    // second triangle
        };

        const UINT indexBufferSize = sizeof(indices);

        // An upload heap again, like the vertex buffer.
        CD3DX12_HEAP_PROPERTIES heapProperties(D3D12_HEAP_TYPE_UPLOAD);
        CD3DX12_RESOURCE_DESC bufferDesc = CD3DX12_RESOURCE_DESC::Buffer(indexBufferSize);
        ThrowIfFailed(m_device->CreateCommittedResource(
            &heapProperties,
            D3D12_HEAP_FLAG_NONE,
            &bufferDesc,
            D3D12_RESOURCE_STATE_GENERIC_READ,
            nullptr,
            IID_PPV_ARGS(&m_indexBuffer)));

        // Copy the indices to the index buffer.
        UINT8* pIndexDataBegin = nullptr;
        CD3DX12_RANGE readRange(0, 0);        // We do not intend to read from this resource on the CPU.
        ThrowIfFailed(m_indexBuffer->Map(0, &readRange, reinterpret_cast<void**>(&pIndexDataBegin)));
        memcpy(pIndexDataBegin, indices, sizeof(indices));
        m_indexBuffer->Unmap(0, nullptr);

        // Initialize the index buffer view: 32-bit indices (UINT).
        m_indexBufferView.BufferLocation = m_indexBuffer->GetGPUVirtualAddress();
        m_indexBufferView.Format = DXGI_FORMAT_R32_UINT;
        m_indexBufferView.SizeInBytes = indexBufferSize;
    }

    // Note: ComPtr's are CPU objects, but an upload heap needs to stay in scope until
    // the command list that copies from it has finished executing on the GPU.
    // We will flush the GPU at the end of this method to ensure it is not
    // prematurely destroyed.
    ComPtr<ID3D12Resource> textureUploadHeap1;
    ComPtr<ID3D12Resource> textureUploadHeap2;

    // Create the first texture: the container.
    {
        // Load the image. The last argument asks stb_image for 4 channels (RGBA), the
        // layout of DXGI_FORMAT_R8G8B8A8_UNORM, although container.png has no alpha.
        // No vertical flip: in Direct3D, texture coordinate v = 0 is the image's top row.
        int width, height, nrChannels;
        unsigned char* data = stbi_load("container.png", &width, &height, &nrChannels, 4);
        if (data == nullptr)
        {
            throw std::runtime_error("Failed to load texture container.png");
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
            IID_PPV_ARGS(&m_texture1)));

        // The upload heap: a buffer in memory the CPU can write, big enough for the
        // texture's rows as the GPU lays them out (GetRequiredIntermediateSize).
        const UINT64 uploadBufferSize = GetRequiredIntermediateSize(m_texture1.Get(), 0, 1);

        // Create the GPU upload buffer.
        CD3DX12_HEAP_PROPERTIES uploadHeapProperties(D3D12_HEAP_TYPE_UPLOAD);
        CD3DX12_RESOURCE_DESC uploadBufferDesc = CD3DX12_RESOURCE_DESC::Buffer(uploadBufferSize);
        ThrowIfFailed(m_device->CreateCommittedResource(
            &uploadHeapProperties,
            D3D12_HEAP_FLAG_NONE,
            &uploadBufferDesc,
            D3D12_RESOURCE_STATE_GENERIC_READ,
            nullptr,
            IID_PPV_ARGS(&textureUploadHeap1)));

        // Copy data to the intermediate upload heap and then schedule a copy
        // from the upload heap to the Texture2D. UpdateSubresources copies the pixels
        // into the upload heap right away (on the CPU), so the image can be freed after
        // it; the GPU copies them into the texture when the command list executes.
        D3D12_SUBRESOURCE_DATA textureData = {};
        textureData.pData = data;
        textureData.RowPitch = width * 4;                          // bytes per row: 4 per pixel
        textureData.SlicePitch = textureData.RowPitch * height;    // bytes in the whole image

        UpdateSubresources(m_commandList.Get(), m_texture1.Get(), textureUploadHeap1.Get(), 0, 0, 1, &textureData);

        // After the copy, the texture is read by the pixel shader.
        CD3DX12_RESOURCE_BARRIER barrier = CD3DX12_RESOURCE_BARRIER::Transition(m_texture1.Get(), D3D12_RESOURCE_STATE_COPY_DEST, D3D12_RESOURCE_STATE_PIXEL_SHADER_RESOURCE);
        m_commandList->ResourceBarrier(1, &barrier);

        // Describe and create a SRV for the texture, in the first slot of the SRV heap.
        D3D12_SHADER_RESOURCE_VIEW_DESC srvDesc = {};
        srvDesc.Shader4ComponentMapping = D3D12_DEFAULT_SHADER_4_COMPONENT_MAPPING;
        srvDesc.Format = textureDesc.Format;
        srvDesc.ViewDimension = D3D12_SRV_DIMENSION_TEXTURE2D;
        srvDesc.Texture2D.MipLevels = 1;
        m_device->CreateShaderResourceView(m_texture1.Get(), &srvDesc, m_srvHeap->GetCPUDescriptorHandleForHeapStart());

        // Free the image memory.
        stbi_image_free(data);
    }

    // Create the second texture: the face. The same steps as for the container.
    {
        int width, height, nrChannels;
        unsigned char* data = stbi_load("awesomeface.png", &width, &height, &nrChannels, 4);
        if (data == nullptr)
        {
            throw std::runtime_error("Failed to load texture awesomeface.png");
        }

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
            IID_PPV_ARGS(&m_texture2)));

        const UINT64 uploadBufferSize = GetRequiredIntermediateSize(m_texture2.Get(), 0, 1);

        CD3DX12_HEAP_PROPERTIES uploadHeapProperties(D3D12_HEAP_TYPE_UPLOAD);
        CD3DX12_RESOURCE_DESC uploadBufferDesc = CD3DX12_RESOURCE_DESC::Buffer(uploadBufferSize);
        ThrowIfFailed(m_device->CreateCommittedResource(
            &uploadHeapProperties,
            D3D12_HEAP_FLAG_NONE,
            &uploadBufferDesc,
            D3D12_RESOURCE_STATE_GENERIC_READ,
            nullptr,
            IID_PPV_ARGS(&textureUploadHeap2)));

        D3D12_SUBRESOURCE_DATA textureData = {};
        textureData.pData = data;
        textureData.RowPitch = width * 4;
        textureData.SlicePitch = textureData.RowPitch * height;

        UpdateSubresources(m_commandList.Get(), m_texture2.Get(), textureUploadHeap2.Get(), 0, 0, 1, &textureData);

        CD3DX12_RESOURCE_BARRIER barrier = CD3DX12_RESOURCE_BARRIER::Transition(m_texture2.Get(), D3D12_RESOURCE_STATE_COPY_DEST, D3D12_RESOURCE_STATE_PIXEL_SHADER_RESOURCE);
        m_commandList->ResourceBarrier(1, &barrier);

        // The SRV goes into the second slot of the SRV heap (descriptor 1), right after
        // the container's: the descriptor table's t0 and t1.
        D3D12_SHADER_RESOURCE_VIEW_DESC srvDesc = {};
        srvDesc.Shader4ComponentMapping = D3D12_DEFAULT_SHADER_4_COMPONENT_MAPPING;
        srvDesc.Format = textureDesc.Format;
        srvDesc.ViewDimension = D3D12_SRV_DIMENSION_TEXTURE2D;
        srvDesc.Texture2D.MipLevels = 1;
        CD3DX12_CPU_DESCRIPTOR_HANDLE srvHandle(m_srvHeap->GetCPUDescriptorHandleForHeapStart(), 1, m_srvDescriptorSize);
        m_device->CreateShaderResourceView(m_texture2.Get(), &srvDesc, srvHandle);

        stbi_image_free(data);
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
        // complete before continuing. Only then may the upload heap go away.
        WaitForPreviousFrame();
    }
}

// Update frame-based values.
void D3D12App::OnUpdate()
{
}

// Up and Down change the mix value, in steps of 0.1 (holding a key repeats it).
void D3D12App::OnKeyDown(UINT8 key)
{
    if (key == VK_UP)
    {
        m_mixValue += 0.1f;
        if (m_mixValue >= 1.0f)
            m_mixValue = 1.0f;
    }
    if (key == VK_DOWN)
    {
        m_mixValue -= 0.1f;
        if (m_mixValue <= 0.0f)
            m_mixValue = 0.0f;
    }
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
    // The SRV heap the descriptor table points into, and root parameter 0: the
    // table, starting at the heap's first descriptor.
    ID3D12DescriptorHeap* ppHeaps[] = { m_srvHeap.Get() };
    m_commandList->SetDescriptorHeaps(_countof(ppHeaps), ppHeaps);
    m_commandList->SetGraphicsRootDescriptorTable(0, m_srvHeap->GetGPUDescriptorHandleForHeapStart());
    m_commandList->RSSetViewports(1, &m_viewport);
    m_commandList->RSSetScissorRects(1, &m_scissorRect);

    // Root parameter 1: the mix value for the pixel shader.
    MixConstants mixConstants = {};
    mixConstants.mixValue = m_mixValue;
    m_commandList->SetGraphicsRoot32BitConstants(1, sizeof(MixConstants) / 4, &mixConstants, 0);

    // Indicate that the back buffer will be used as a render target.
    CD3DX12_RESOURCE_BARRIER barrier = CD3DX12_RESOURCE_BARRIER::Transition(m_renderTargets[m_frameIndex].Get(), D3D12_RESOURCE_STATE_PRESENT, D3D12_RESOURCE_STATE_RENDER_TARGET);
    m_commandList->ResourceBarrier(1, &barrier);

    CD3DX12_CPU_DESCRIPTOR_HANDLE rtvHandle(m_rtvHeap->GetCPUDescriptorHandleForHeapStart(), m_frameIndex, m_rtvDescriptorSize);
    m_commandList->OMSetRenderTargets(1, &rtvHandle, FALSE, nullptr);

    // Record commands.
    const float clearColor[] = { 0.2f, 0.3f, 0.3f, 1.0f };
    m_commandList->ClearRenderTargetView(rtvHandle, clearColor, 0, nullptr);
    m_commandList->IASetPrimitiveTopology(D3D_PRIMITIVE_TOPOLOGY_TRIANGLELIST);
    m_commandList->IASetVertexBuffers(0, 1, &m_vertexBufferView);
    m_commandList->IASetIndexBuffer(&m_indexBufferView);
    m_commandList->DrawIndexedInstanced(6, 1, 0, 0, 0);

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
    // The app that wWinMain stored in the window (nullptr until then).
    D3D12App* pApp = reinterpret_cast<D3D12App*>(GetWindowLongPtr(hWnd, GWLP_USERDATA));

    switch (message)
    {
    case WM_KEYDOWN:
        // Escape closes the window; the app gets the other keys.
        if (wParam == VK_ESCAPE)
        {
            DestroyWindow(hWnd);
        }
        else if (pApp != nullptr)
        {
            pApp->OnKeyDown(static_cast<UINT8>(wParam));
        }
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

    // Store a pointer to the app in the window, so WindowProc can pass it the keys.
    SetWindowLongPtr(hwnd, GWLP_USERDATA, reinterpret_cast<LONG_PTR>(&app));
    try
    {
        app.OnInit(hwnd);

        ShowWindow(hwnd, nCmdShow);

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
