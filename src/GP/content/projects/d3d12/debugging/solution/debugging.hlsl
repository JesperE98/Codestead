// The shaders. main.cpp compiles them at run time with D3DCompileFromFile.

// The texture: register t0, in the descriptor table of root parameter 2.
Texture2D tex : register(t0);
// The sampler: register s0, the static sampler of the root signature.
SamplerState wrapSampler : register(s0);

// Root constants set from main.cpp with SetGraphicsRoot32BitConstants: the vertex
// shader sees them as a constant buffer at register b0.
cbuffer ModelConstants : register(b0)
{
    float4x4 model;
};

// The constant buffer at register b1 (the CBV in root parameter 1's table): the projection.
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

// The vertex shader: runs once per vertex.
PSInput VSMain(float4 position : POSITION, float2 texCoord : TEXCOORD)
{
    PSInput result;

    // model, then projection (GLSL: projection * model * position).
    result.position = mul(mul(position, model), projection);
    result.texCoord = texCoord;

    return result;
}

// The pixel shader: runs once per pixel a triangle covers and returns its colour (RGBA).
float4 PSMain(PSInput input) : SV_TARGET
{
    // debugging shader output: show the texture coordinates as a colour (u = red, v = green)
    return float4(input.texCoord, 0.0f, 1.0f);
    // return tex.Sample(wrapSampler, input.texCoord);
}
