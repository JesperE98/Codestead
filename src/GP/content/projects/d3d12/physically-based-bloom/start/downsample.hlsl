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

// The pixel shader: 13 samples around the pixel, weighted.
float4 PSMain(PSInput input) : SV_TARGET
{
    // TODO: the 13-tap downsample filter
    return float4(0.0f, 0.0f, 0.0f, 1.0f);
}
