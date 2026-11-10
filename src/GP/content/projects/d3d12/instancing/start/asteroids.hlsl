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

// TODO: the rock's model matrix as a per-instance input: its four rows, float4 each (semantic INSTANCEMATRIX, indices 0 to 3)
PSInput VSMain(float4 position : POSITION, float3 normal : NORMAL, float2 texCoords : TEXCOORD)
{
    PSInput result;

    result.texCoords = texCoords;
    // TODO: place the rock with its instance's matrix: mul(mul(mul(position, instanceMatrix), view), projection)
    result.position = mul(mul(position, view), projection);

    return result;
}

float4 PSMain(PSInput input) : SV_TARGET
{
    return texture_diffuse1.Sample(wrapSampler, input.texCoords);
}
