// The shaders of the Gaussian blur (learnopengl's 7.blur.vs / 7.blur.fs): one pass blurs the
// texture along x or along y, drawing the screen quad into a ping-pong buffer. main.cpp
// compiles them at run time with D3DCompileFromFile.

// The texture to blur: register t0, in the descriptor table of root parameter 2.
Texture2D image : register(t0);
// The sampler: register s1, the root signature's second static sampler (linear, CLAMP).
SamplerState clampSampler : register(s1);

// Root constants set from main.cpp with SetGraphicsRoot32BitConstants (root parameter 0).
cbuffer BlurConstants : register(b0)
{
    bool horizontal;
};

// The weights of the texel itself and of its neighbours 1 to 4 texels away (a Gaussian).
static const float weight[5] = { 0.2270270270f, 0.1945945946f, 0.1216216216f, 0.0540540541f, 0.0162162162f };

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

// The pixel shader: the weighted sum of 9 texels in a row (or a column).
float4 PSMain(PSInput input) : SV_TARGET
{
    // TODO: a 9-tap Gaussian blur in one direction: the texel at texCoord times weight[0], plus the 4 texels on each side (horizontal or vertical) times weight[1..4] - one texel is 1 / the texture's size (image.GetDimensions)
    return float4(0.0f, 0.0f, 0.0f, 1.0f);
}
