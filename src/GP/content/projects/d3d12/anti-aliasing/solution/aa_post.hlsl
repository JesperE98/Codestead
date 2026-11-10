// The shaders of the screen quad (learnopengl's aa_post.vs / .fs): they show the resolved,
// anti-aliased image of the scene. main.cpp compiles them at run time with D3DCompileFromFile.

// The resolved image: the texture in root parameter 2's table (register t0), and the sampler.
Texture2D screenTexture : register(t0);
SamplerState wrapSampler : register(s0);

struct PSInput
{
    float4 position : SV_POSITION;
    float2 texCoords : TEXCOORD;
};

PSInput VSMain(float2 position : POSITION, float2 texCoords : TEXCOORD)
{
    PSInput result;

    result.texCoords = texCoords;
    result.position = float4(position.x, position.y, 0.0f, 1.0f);    // the quad's corners are already in normalized device coordinates

    return result;
}

float4 PSMain(PSInput input) : SV_TARGET
{
    float3 col = screenTexture.Sample(wrapSampler, input.texCoords).rgb;
    float grayscale = 0.2126f * col.r + 0.7152f * col.g + 0.0722f * col.b;    // weighted: the eye is most sensitive to green
    return float4(grayscale, grayscale, grayscale, 1.0f);
}
