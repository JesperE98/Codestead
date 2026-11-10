// The shaders of the bloom's downsample (learnopengl's 6.new_downsample.vs / .fs): this shader
// performs downsampling on a texture, as taken from Call Of Duty method, presented at ACM
// Siggraph 2014. This particular method was customly designed to eliminate "pulsating
// artifacts and temporal stability issues". main.cpp compiles them at run time with
// D3DCompileFromFile.

// The texture to downsample: the scene or the level above: register t0, in the table of root
// parameter 2.
Texture2D srcTexture : register(t0);
// The sampler: register s1, the root signature's second static sampler - bilinear
// filtering and clamping to the edge, as the method needs.
SamplerState clampSampler : register(s1);

// Root constants set from main.cpp with SetGraphicsRoot32BitConstants (root parameter 0).
cbuffer DownsampleConstants : register(b0)
{
    float2 srcResolution;    // the size of srcTexture, in texels
    int mipLevel;            // which mip we are writing to, used for Karis average
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

float3 PowVec3(float3 v, float p)
{
    return float3(pow(v.x, p), pow(v.y, p), pow(v.z, p));
}

static const float invGamma = 1.0f / 2.2f;
float3 ToSRGB(float3 v) { return PowVec3(v, invGamma); }

float sRGBToLuma(float3 col)
{
    //return dot(col, float3(0.2126f, 0.7152f, 0.0722f));
    return dot(col, float3(0.299f, 0.587f, 0.114f));
}

float KarisAverage(float3 col)
{
    // Formula is 1 / (1 + luma)
    float luma = sRGBToLuma(ToSRGB(col)) * 0.25f;
    return 1.0f / (1.0f + luma);
}

// The pixel shader: 13 samples around the pixel, weighted.
float4 PSMain(PSInput input) : SV_TARGET
{
    float2 srcTexelSize = 1.0f / srcResolution;
    float x = srcTexelSize.x;
    float y = srcTexelSize.y;
    float2 texCoord = input.texCoord;

    // Take 13 samples around current texel:
    // a - b - c
    // - j - k -
    // d - e - f
    // - l - m -
    // g - h - i
    // === ('e' is the current texel) ===
    float3 a = srcTexture.Sample(clampSampler, float2(texCoord.x - 2 * x, texCoord.y + 2 * y)).rgb;
    float3 b = srcTexture.Sample(clampSampler, float2(texCoord.x,         texCoord.y + 2 * y)).rgb;
    float3 c = srcTexture.Sample(clampSampler, float2(texCoord.x + 2 * x, texCoord.y + 2 * y)).rgb;

    float3 d = srcTexture.Sample(clampSampler, float2(texCoord.x - 2 * x, texCoord.y)).rgb;
    float3 e = srcTexture.Sample(clampSampler, float2(texCoord.x,         texCoord.y)).rgb;
    float3 f = srcTexture.Sample(clampSampler, float2(texCoord.x + 2 * x, texCoord.y)).rgb;

    float3 g = srcTexture.Sample(clampSampler, float2(texCoord.x - 2 * x, texCoord.y - 2 * y)).rgb;
    float3 h = srcTexture.Sample(clampSampler, float2(texCoord.x,         texCoord.y - 2 * y)).rgb;
    float3 i = srcTexture.Sample(clampSampler, float2(texCoord.x + 2 * x, texCoord.y - 2 * y)).rgb;

    float3 j = srcTexture.Sample(clampSampler, float2(texCoord.x - x, texCoord.y + y)).rgb;
    float3 k = srcTexture.Sample(clampSampler, float2(texCoord.x + x, texCoord.y + y)).rgb;
    float3 l = srcTexture.Sample(clampSampler, float2(texCoord.x - x, texCoord.y - y)).rgb;
    float3 m = srcTexture.Sample(clampSampler, float2(texCoord.x + x, texCoord.y - y)).rgb;

    // Apply weighted distribution:
    // 0.5 + 0.125 + 0.125 + 0.125 + 0.125 = 1
    // a,b,d,e * 0.125
    // b,c,e,f * 0.125
    // d,e,g,h * 0.125
    // e,f,h,i * 0.125
    // j,k,l,m * 0.5
    // This shows 5 square areas that are being sampled. But some of them overlap,
    // so to have an energy preserving downsample we need to make some adjustments.
    // The weights are the distributed, so that the sum of j,k,l,m (e.g.)
    // contribute 0.5 to the final color output. The code below is written
    // to effectively yield this sum. We get:
    // 0.125*5 + 0.03125*4 + 0.0625*4 = 1
    float3 downsample;

    // Check if we need to perform Karis average on each block of 4 samples
    float3 groups[5];
    if (mipLevel == 0)
    {
        // We are writing to mip 0, so we need to apply Karis average to each block
        // of 4 samples to prevent fireflies (very bright subpixels, leads to pulsating
        // artifacts).
        groups[0] = (a + b + d + e) * (0.125f / 4.0f);
        groups[1] = (b + c + e + f) * (0.125f / 4.0f);
        groups[2] = (d + e + g + h) * (0.125f / 4.0f);
        groups[3] = (e + f + h + i) * (0.125f / 4.0f);
        groups[4] = (j + k + l + m) * (0.5f / 4.0f);
        groups[0] *= KarisAverage(groups[0]);
        groups[1] *= KarisAverage(groups[1]);
        groups[2] *= KarisAverage(groups[2]);
        groups[3] *= KarisAverage(groups[3]);
        groups[4] *= KarisAverage(groups[4]);
        downsample = groups[0] + groups[1] + groups[2] + groups[3] + groups[4];
        downsample = max(downsample, 0.0001f);
    }
    else
    {
        downsample = e * 0.125f;
        downsample += (a + c + g + i) * 0.03125f;
        downsample += (b + d + f + h) * 0.0625f;
        downsample += (j + k + l + m) * 0.125f;
    }

    return float4(downsample, 1.0f);
}
