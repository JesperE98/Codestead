// The text shaders. main.cpp compiles them at run time with D3DCompileFromFile.

// The glyph atlas: register t0, in the descriptor table of root parameter 2. One channel
// (DXGI_FORMAT_R8_UNORM): how much of each texel the glyph covers, 0 to 1.
Texture2D text : register(t0);
// The sampler: register s0, the static sampler of the root signature.
SamplerState wrapSampler : register(s0);

// Root constants set from main.cpp with SetGraphicsRoot32BitConstants before each line of
// text: the pixel shader sees them as a constant buffer at register b0.
cbuffer TextConstants : register(b0)
{
    float3 textColor;
};

// The constant buffer at register b1 (the CBV in root parameter 1's table): the game's
// projection (pixels from the top-left, y down).
cbuffer SceneConstantBuffer : register(b1)
{
    float4x4 projection;
};

// What the vertex shader hands on to the rasterizer and the pixel shader.
struct PSInput
{
    float4 position : SV_POSITION;
    float2 texCoord : TEXCOORD;
};

// The vertex shader: a corner of a glyph's quad, in pixels, and its place in the atlas.
PSInput VSMain(float2 position : POSITION, float2 texCoord : TEXCOORD)
{
    PSInput result;

    result.position = mul(float4(position, 0.0f, 1.0f), projection);
    result.texCoord = texCoord;

    return result;
}

// The pixel shader: the text's colour, as opaque as the glyph covers the pixel.
float4 PSMain(PSInput input) : SV_TARGET
{
    // the atlas has one channel (red): it is the glyph's coverage, used as alpha
    float4 sampled = float4(1.0f, 1.0f, 1.0f, text.Sample(wrapSampler, input.texCoord).r);
    return float4(textColor, 1.0f) * sampled;
}
