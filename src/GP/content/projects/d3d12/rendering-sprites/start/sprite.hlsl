// The sprite shaders. main.cpp compiles them at run time with D3DCompileFromFile.

// The sprite's texture: register t0, in the descriptor table of root parameter 2.
Texture2D image : register(t0);
// The sampler: register s0, the static sampler of the root signature.
SamplerState wrapSampler : register(s0);

// Root constants set from main.cpp with SetGraphicsRoot32BitConstants before each sprite:
// both shaders see them as a constant buffer at register b0.
cbuffer SpriteConstants : register(b0)
{
    float4x4 model;
    float3 spriteColor;
};

// The constant buffer at register b1 (the CBV in root parameter 1's table): the projection.
// Note that we're omitting the view matrix; the view never changes so we basically have an
// identity view matrix and can therefore omit it.
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

// The vertex shader: a corner of the unit quad (position and texture coordinates).
PSInput VSMain(float2 position : POSITION, float2 texCoord : TEXCOORD)
{
    PSInput result;

    // TODO: pass the texture coordinates on and transform the position with model, then projection
    result.texCoord = float2(0.0f, 0.0f);
    result.position = float4(0.0f, 0.0f, 0.0f, 1.0f);

    return result;
}

// The pixel shader: the sprite's texture colour multiplied by spriteColor.
float4 PSMain(PSInput input) : SV_TARGET
{
    // TODO: the sprite's texture colour multiplied by spriteColor
    return float4(1.0f, 1.0f, 1.0f, 1.0f);
}
