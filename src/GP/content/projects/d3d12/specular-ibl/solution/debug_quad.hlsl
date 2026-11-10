// The pixel shader that shows a two-channel texture (red and green) on the screen quad, to
// look at the BRDF lookup texture; its vertex shader is brdf.hlsl's VSMain. main.cpp
// compiles it at run time with D3DCompileFromFile.

// The texture to show: register t0, in the descriptor table of root parameter 2.
Texture2D image : register(t0);
// The sampler: register s0, the static sampler of the root signature (linear, CLAMP).
SamplerState clampSampler : register(s0);

// What the vertex shader hands on to the rasterizer and the pixel shader.
struct PSInput
{
    float4 position : SV_POSITION;
    float2 texCoords : TEXCOORD;
};

// The pixel shader: runs once per pixel of the window.
float4 PSMain(PSInput input) : SV_TARGET
{
    // v flipped: the texture's first row (v = 0, roughness 0) is shown at the bottom of the
    // window, as learnopengl's picture of the lookup texture has it (OpenGL's v = 0 is the
    // bottom row).
    return float4(image.Sample(clampSampler, float2(input.texCoords.x, 1.0f - input.texCoords.y)).rg, 0.0f, 1.0f);
}
