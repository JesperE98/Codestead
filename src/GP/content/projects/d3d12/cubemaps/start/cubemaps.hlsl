// The shaders. main.cpp compiles them at run time with D3DCompileFromFile.

// The texture of the draw: register t0, in the descriptor table of root parameter 2.
Texture2D texture1 : register(t0);
// The sampler: register s0, the static sampler of the root signature (WRAP).
SamplerState wrapSampler : register(s0);

// Root constants set from main.cpp with SetGraphicsRoot32BitConstants: the vertex
// shader sees them as a constant buffer at register b0.
cbuffer ModelConstants : register(b0)
{
    float4x4 model;
};

// The constant buffer at register b1 (the CBV in root parameter 1's table): the
// view and projection matrices, the same for every draw of a frame.
cbuffer SceneConstantBuffer : register(b1)
{
    float4x4 view;
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

    // model, then view, then projection (GLSL: projection * view * model * position).
    result.position = mul(mul(mul(position, model), view), projection);
    result.texCoord = texCoord;

    return result;
}

// The pixel shader: runs once per pixel a triangle covers and returns its colour (RGBA).
float4 PSMain(PSInput input) : SV_TARGET
{
    return texture1.Sample(wrapSampler, input.texCoord);
}
