// The shaders of the planet (learnopengl's planet.vs / .fs in its asteroid demo): its diffuse
// map, no lighting. main.cpp compiles them at run time with D3DCompileFromFile.

// Root constants set from main.cpp with SetGraphicsRoot32BitConstants (root parameter 0).
cbuffer ModelConstants : register(b0)
{
    float4x4 model;
};

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

PSInput VSMain(float4 position : POSITION, float3 normal : NORMAL, float2 texCoords : TEXCOORD)
{
    PSInput result;

    result.texCoords = texCoords;
    result.position = mul(mul(mul(position, model), view), projection);

    return result;
}

float4 PSMain(PSInput input) : SV_TARGET
{
    return texture_diffuse1.Sample(wrapSampler, input.texCoords);
}
