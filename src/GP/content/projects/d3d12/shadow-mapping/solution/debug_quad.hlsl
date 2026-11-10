// The shaders of the debug quad: they show the shadow map in the whole window.
// main.cpp compiles them at run time with D3DCompileFromFile.

// The shadow map: register t1, the second SRV of root parameter 2's table (the table the
// scene's shaders read the wood and the shadow map from).
Texture2D depthMap : register(t1);
// The shadow map's sampler: register s1, no filtering.
SamplerState shadowSampler : register(s1);

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

    result.position = float4(position.x, position.y, 0.0f, 1.0f);
    result.texCoord = texCoord;

    return result;
}

// The pixel shader: the depth as a grey (0 black, near the light; 1 white, far). An
// orthographic projection's depth is linear already (with a perspective one, learnopengl
// linearises it first: LinearizeDepth).
float4 PSMain(PSInput input) : SV_TARGET
{
    float depthValue = depthMap.Sample(shadowSampler, input.texCoord).r;
    return float4(depthValue, depthValue, depthValue, 1.0f);
}
