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

    // The cube stretched into a column 0.5 x 3 x 0.5 standing on the floor (y from -0.5 to
    // 2.5); instance i stands at x = -4 + 2i, 4 units behind the sculptures.
    float3 worldPosition = position * float3(0.5f, 3.0f, 0.5f) + float3(-4.0f + 2.0f * instanceID, 1.0f, -4.0f);
    result.position = mul(mul(float4(worldPosition, 1.0f), view), projection);
    result.texCoord = texCoord;

    return result;
}
