// The shaders of the screen quad: they draw the off-screen render target's texture
// onto the window. main.cpp compiles them at run time with D3DCompileFromFile.

// The off-screen render target's texture: register t0, in the descriptor table of root parameter 2.
Texture2D screenTexture : register(t0);
// The sampler: register s0, the static sampler of the root signature.
SamplerState wrapSampler : register(s0);

// What the vertex shader hands on to the rasterizer and the pixel shader.
struct PSInput
{
    float4 position : SV_POSITION;
    float2 texCoord : TEXCOORD;
};

// The vertex shader: the quad's positions are in normalized device coordinates already,
// so there are no matrices (learnopengl: gl_Position = vec4(aPos.x, aPos.y, 0.0, 1.0)).
PSInput VSMain(float4 position : POSITION, float2 texCoord : TEXCOORD)
{
    PSInput result;

    result.position = float4(position.x, position.y, 0.0f, 1.0f);
    result.texCoord = texCoord;

    return result;
}

// The distance to the neighbouring samples, in texture coordinates.
static const float offset = 1.0f / 300.0f;

// The pixel shader: the colour of the window's pixel.
float4 PSMain(PSInput input) : SV_TARGET
{
    // The 3x3 samples around the pixel. v grows downwards in Direct3D, so the top row
    // is at -offset (learnopengl's GLSL, where v grows upwards, has +offset there).
    float2 offsets[9] =
    {
        float2(-offset, -offset),    // top-left
        float2( 0.0f,   -offset),    // top-center
        float2( offset, -offset),    // top-right
        float2(-offset,  0.0f),      // center-left
        float2( 0.0f,    0.0f),      // center-center
        float2( offset,  0.0f),      // center-right
        float2(-offset,  offset),    // bottom-left
        float2( 0.0f,    offset),    // bottom-center
        float2( offset,  offset)     // bottom-right
    };

    // The kernel: how much each sample counts.
    float kernel[9] =
    {
        1.0f,  1.0f, 1.0f,
        1.0f, -8.0f, 1.0f,
        1.0f,  1.0f, 1.0f
    };

    float3 sampleTex[9];
    for (int i = 0; i < 9; i++)
    {
        sampleTex[i] = screenTexture.Sample(wrapSampler, input.texCoord + offsets[i]).rgb;
    }
    float3 col = float3(0.0f, 0.0f, 0.0f);
    for (int k = 0; k < 9; k++)
        col += sampleTex[k] * kernel[k];

    return float4(col, 1.0f);
}
