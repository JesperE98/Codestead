// The shaders of the final pass (learnopengl's screen.vs / screen.fs): a screen quad that
// copies the opaque texture to the window. main.cpp compiles them at run time with
// D3DCompileFromFile.

// screen image: register t0, the first SRV of root parameter 1's table
Texture2D screen : register(t0);
// The sampler: register s0, the root signature's static sampler (linear, CLAMP).
SamplerState screenSampler : register(s0);

// What the vertex shader hands on to the rasterizer and the pixel shader.
struct PSInput
{
    float4 position : SV_POSITION;
    float2 texture_coords : TEXCOORD;
};

// The vertex shader: the quad's positions are in normalized device coordinates already.
PSInput VSMain(float3 position : POSITION, float2 uv : TEXCOORD)
{
    PSInput result;

    result.position = float4(position, 1.0f);
    result.texture_coords = uv;

    return result;
}

float4 PSMain(PSInput input) : SV_TARGET
{
    return float4(screen.Sample(screenSampler, input.texture_coords).rgb, 1.0f);
}
