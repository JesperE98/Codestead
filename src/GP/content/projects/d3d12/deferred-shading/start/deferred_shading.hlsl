// The shaders of the lighting pass (learnopengl's 8.1.deferred_shading.vs / .fs, with 8.2's
// light volumes): a screen quad that lights every pixel with what the G-buffer holds for it.
// main.cpp compiles them at run time with D3DCompileFromFile.

// The G-buffer: gPosition and gNormal at registers t0 and t1 (root parameter 2's table),
// gAlbedoSpec at t2 (root parameter 3's table).
Texture2D gPosition : register(t0);
Texture2D gNormal : register(t1);
Texture2D gAlbedoSpec : register(t2);
// The sampler: register s1, the root signature's second static sampler (point, CLAMP).
SamplerState pointSampler : register(s1);

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

// The pixel shader: runs once per pixel of the window.
float4 PSMain(PSInput input) : SV_TARGET
{
    // retrieve data from gbuffer
    float3 Diffuse = gAlbedoSpec.Sample(pointSampler, input.texCoord).rgb;

    // TODO: light the pixel with the 32 lights from the G-buffer's position, normal, colour and specular intensity (learnopengl's deferred_shading.fs) - for now: show the albedo
    return float4(Diffuse, 1.0f);
}
