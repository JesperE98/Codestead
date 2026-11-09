// The shaders. main.cpp compiles them at run time with D3DCompileFromFile.

// The textures: registers t0 and t1, in the descriptor table of root parameter 0.
Texture2D texture1 : register(t0);    // the container
Texture2D texture2 : register(t1);    // the face
// The sampler: register s0, the static sampler of the root signature.
SamplerState wrapSampler : register(s0);

// Root constants set from main.cpp with SetGraphicsRoot32BitConstants: the vertex
// shader sees them as a constant buffer at register b0.
cbuffer ModelConstants : register(b0)
{
    float4x4 model;
};

// What the vertex shader hands on to the rasterizer and the pixel shader.
struct PSInput
{
    float4 position : SV_POSITION;
    float2 texCoord : TEXCOORD;      // the texture coordinates, interpolated across the rectangle
};

// The vertex shader: runs once per vertex.
PSInput VSMain(float4 position : POSITION, float2 texCoord : TEXCOORD)
{
    PSInput result;

    // The vertex buffer holds 3 floats (x, y, z) per vertex; w is filled in with 1.0.
    // The position is a row vector: mul(position, model) applies the matrix
    // the same way as DirectXMath's v * M.
    result.position = mul(position, model);
    result.texCoord = texCoord;

    return result;
}

// The pixel shader: runs once per pixel the rectangle covers and returns its colour (RGBA).
float4 PSMain(PSInput input) : SV_TARGET
{
    // Linearly interpolate between both textures (80% container, 20% face).
    return lerp(texture1.Sample(wrapSampler, input.texCoord), texture2.Sample(wrapSampler, input.texCoord), 0.2f);
}
