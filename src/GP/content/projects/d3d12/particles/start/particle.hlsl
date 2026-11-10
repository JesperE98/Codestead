// The particle shaders. main.cpp compiles them at run time with D3DCompileFromFile.

// The particle's texture: register t0, in the descriptor table of root parameter 2.
Texture2D sprite : register(t0);
// The sampler: register s0, the static sampler of the root signature.
SamplerState wrapSampler : register(s0);

// Root constants set from main.cpp with SetGraphicsRoot32BitConstants before each particle:
// both shaders see them as a constant buffer at register b0. (color starts at byte 16:
// HLSL does not let a float4 straddle two 16-byte rows - main.cpp's struct pads to match.)
cbuffer ParticleConstants : register(b0)
{
    float2 offset;
    float4 color;
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
    float4 particleColor : COLOR;
};

// The vertex shader: a corner of the unit quad, scaled to 10 x 10 pixels and moved to the
// particle's position.
PSInput VSMain(float2 position : POSITION, float2 texCoord : TEXCOORD)
{
    PSInput result;

    // TODO: a quad of scale 10 x 10 pixels whose top-left corner is at offset: pass the texture coordinates and the colour on
    result.texCoord = float2(0.0f, 0.0f);
    result.particleColor = float4(1.0f, 1.0f, 1.0f, 1.0f);
    result.position = float4(0.0f, 0.0f, 0.0f, 1.0f);

    return result;
}

// The pixel shader: the particle's texture colour multiplied by its colour.
float4 PSMain(PSInput input) : SV_TARGET
{
    // TODO: the particle texture's colour multiplied by the particle's colour
    return float4(1.0f, 1.0f, 1.0f, 1.0f);
}
