// The shaders of the rocks (learnopengl's asteroids.vs / .fs): one draw call draws all the
// rocks, each instance with its own model matrix. main.cpp compiles them at run time with
// D3DCompileFromFile.

// The constant buffer at register b1 (the CBV in root parameter 1's table).
cbuffer SceneConstantBuffer : register(b1)
{
    float4x4 view;
    float4x4 projection;
};

// The mesh's diffuse map (register t0, learnopengl's texture_diffuse1) and the sampler.
Texture2D texture_diffuse1 : register(t0);
SamplerState wrapSampler : register(s0);

struct PSInput
{
    float4 position : SV_POSITION;
    float2 texCoords : TEXCOORD;
};

// The rock's model matrix is a per-instance input (input slot 1): a vertex input is at
// most a float4, so the matrix comes as its four rows, INSTANCEMATRIX0 to INSTANCEMATRIX3.
PSInput VSMain(float4 position : POSITION, float3 normal : NORMAL, float2 texCoords : TEXCOORD,
    float4 instanceRow0 : INSTANCEMATRIX0, float4 instanceRow1 : INSTANCEMATRIX1,
    float4 instanceRow2 : INSTANCEMATRIX2, float4 instanceRow3 : INSTANCEMATRIX3)
{
    PSInput result;

    float4x4 instanceMatrix = float4x4(instanceRow0, instanceRow1, instanceRow2, instanceRow3);
    result.texCoords = texCoords;
    result.position = mul(mul(mul(position, instanceMatrix), view), projection);

    return result;
}

float4 PSMain(PSInput input) : SV_TARGET
{
    return texture_diffuse1.Sample(wrapSampler, input.texCoords);
}
