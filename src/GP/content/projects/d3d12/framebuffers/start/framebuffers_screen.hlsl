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

// The pixel shader: the colour of the window's pixel.
float4 PSMain(PSInput input) : SV_TARGET
{
    // TODO: return the colour of the off-screen texture (screenTexture) at input.texCoord, with alpha 1.0
    return float4(0.0f, 0.0f, 0.0f, 1.0f);
}
