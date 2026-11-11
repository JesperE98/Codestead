// The screen quad: shows the texture the compute shader wrote.

struct PSInput
{
    float4 position : SV_POSITION;
    float2 texCoords : TEXCOORD;
};

Texture2D tex : register(t0);
SamplerState texSampler : register(s0);

PSInput VSMain(float3 position : POSITION, float2 texCoords : TEXCOORD)
{
    PSInput result;

    result.texCoords = texCoords;
    result.position = float4(position, 1.0f);

    return result;
}

float4 PSMain(PSInput input) : SV_TARGET
{
    float3 texCol = tex.Sample(texSampler, input.texCoords).rgb;
    return float4(texCol, 1.0f);
}
