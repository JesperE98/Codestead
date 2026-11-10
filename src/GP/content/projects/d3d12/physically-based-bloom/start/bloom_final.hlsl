// The shaders of the final screen quad (learnopengl's 6.bloom_final.vs / 6.bloom_final.fs):
// they tone-map and gamma-correct the scene onto the
// window. main.cpp compiles them at run time with D3DCompileFromFile.

// The scene's floating-point colour buffer: register t0, in the table of root parameter 2.
Texture2D scene : register(t0);
// The sampler: register s1, the root signature's second static sampler (linear, CLAMP).
SamplerState clampSampler : register(s1);

// Root constants set from main.cpp with SetGraphicsRoot32BitConstants (root parameter 0).
cbuffer HdrConstants : register(b0)
{
    float exposure;
};

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

// The pixel shader: maps the high dynamic range to the window's 0..1.
float4 PSMain(PSInput input) : SV_TARGET
{
    const float gamma = 2.2f;
    float3 hdrColor = scene.Sample(clampSampler, input.texCoord).rgb;
    // tone mapping
    float3 result = float3(1.0f, 1.0f, 1.0f) - exp(-hdrColor * exposure);
    // also gamma correct while we're at it
    result = pow(result, 1.0f / gamma);
    return float4(result, 1.0f);
}
