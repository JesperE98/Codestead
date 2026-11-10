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
    // TODO: the 3x3 tent filter, filterRadius apart
    return float4(0.0f, 0.0f, 0.0f, 1.0f);
}
