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

    // TODO: transform the position with the projection and pass the texture coordinates on
    result.position = float4(0.0f, 0.0f, 0.0f, 1.0f);
    result.texCoord = float2(0.0f, 0.0f);

    return result;
}

// The pixel shader: the text's colour, as opaque as the glyph covers the pixel.
float4 PSMain(PSInput input) : SV_TARGET
{
    // TODO: the glyph atlas's red channel as the alpha of textColor
    return float4(textColor, 1.0f);
}
