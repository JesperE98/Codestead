// The colonnade's vertex shader. main.cpp compiles it at run time with D3DCompileFromFile;
// the columns' pixels are coloured by framebuffers.hlsl's PSMain.

// The constant buffer at register b1 (the CBV in root parameter 1's table): the
// view and projection matrices, the same for every draw of a frame.
cbuffer SceneConstantBuffer : register(b1)
{
    float4x4 view;
    float4x4 projection;
};

// What the vertex shader hands on to the rasterizer and the pixel shader (as in framebuffers.hlsl).
struct PSInput
{
    float4 position : SV_POSITION;
    float2 texCoord : TEXCOORD;
};

PSInput VSMain(float3 position : POSITION, float2 texCoord : TEXCOORD, uint instanceID : SV_InstanceID)
{
    PSInput result;

    // TODO: turn the cube into a column and give every instance (instanceID) a place of its own
    float3 worldPosition = position;
    result.position = mul(mul(float4(worldPosition, 1.0f), view), projection);
    result.texCoord = texCoord;

    return result;
}
