// The shaders of the bloom's upsample (learnopengl's 6.new_upsample.vs / .fs): this shader
// performs upsampling on a texture, as taken from Call Of Duty method, presented at ACM
// Siggraph 2014. main.cpp compiles them at run time with D3DCompileFromFile.

// The texture to upsample: the level below: register t0, in the table of root parameter 2.
Texture2D srcTexture : register(t0);
// The sampler: register s1, the root signature's second static sampler - bilinear
// filtering and clamping to the edge, as the method needs.
SamplerState clampSampler : register(s1);

// Root constants set from main.cpp with SetGraphicsRoot32BitConstants (root parameter 0).
cbuffer UpsampleConstants : register(b0)
{
    float filterRadius;    // the filter's radius, in texture coordinates
};

// What the vertex shader hands on to the rasterizer and the pixel shader.
struct PSInput
{
    float4 position : SV_POSITION;
    float2 texCoord : TEXCOORD;
};

// The vertex shader: the quad's positions are in normalized device coordinates already.
PSInput VSMain(float4 position : POSITION, float2 texCoord : TEXCOORD)
{
    PSInput result;

    result.position = float4(position.xyz, 1.0f);
    result.texCoord = texCoord;

    return result;
}

// The pixel shader: a 3x3 tent filter. The blending adds the result to the level it draws into.
float4 PSMain(PSInput input) : SV_TARGET
{
    // The filter kernel is applied with a radius, specified in texture coordinates, so that
    // the radius will vary across mip resolutions.
    float x = filterRadius;
    float y = filterRadius;
    float2 texCoord = input.texCoord;

    // Take 9 samples around current texel:
    // a - b - c
    // d - e - f
    // g - h - i
    // === ('e' is the current texel) ===
    float3 a = srcTexture.Sample(clampSampler, float2(texCoord.x - x, texCoord.y + y)).rgb;
    float3 b = srcTexture.Sample(clampSampler, float2(texCoord.x,     texCoord.y + y)).rgb;
    float3 c = srcTexture.Sample(clampSampler, float2(texCoord.x + x, texCoord.y + y)).rgb;

    float3 d = srcTexture.Sample(clampSampler, float2(texCoord.x - x, texCoord.y)).rgb;
    float3 e = srcTexture.Sample(clampSampler, float2(texCoord.x,     texCoord.y)).rgb;
    float3 f = srcTexture.Sample(clampSampler, float2(texCoord.x + x, texCoord.y)).rgb;

    float3 g = srcTexture.Sample(clampSampler, float2(texCoord.x - x, texCoord.y - y)).rgb;
    float3 h = srcTexture.Sample(clampSampler, float2(texCoord.x,     texCoord.y - y)).rgb;
    float3 i = srcTexture.Sample(clampSampler, float2(texCoord.x + x, texCoord.y - y)).rgb;

    // Apply weighted distribution, by using a 3x3 tent filter:
    //  1   | 1 2 1 |
    // -- * | 2 4 2 |
    // 16   | 1 2 1 |
    float3 upsample = e * 4.0f;
    upsample += (b + d + f + h) * 2.0f;
    upsample += (a + c + g + i);
    upsample *= 1.0f / 16.0f;

    return float4(upsample, 1.0f);
}
