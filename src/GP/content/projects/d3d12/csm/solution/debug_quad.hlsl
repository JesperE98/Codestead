// The shaders of the debug quad: they show one layer of the shadow maps in the whole window.
// main.cpp compiles them at run time with D3DCompileFromFile.

// The shadow maps: register t1, the second SRV of root parameter 2's table (the table the
// scene's shaders read the wood and the shadow maps from) - a texture array.
Texture2DArray depthMap : register(t1);
// The shadow maps' sampler: register s1, no filtering.
SamplerState shadowSampler : register(s1);

// Root constants set from main.cpp with SetGraphicsRoot32BitConstants (root parameter 0).
cbuffer DebugConstants : register(b0)
{
    int layer;    // the layer to show
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

    result.position = float4(position.x, position.y, 0.0f, 1.0f);
    result.texCoord = texCoord;

    return result;
}

// The pixel shader: the depth as a grey (0 black, near the light; 1 white, far) - the third
// texture coordinate picks the layer. An orthographic projection's depth is linear already.
float4 PSMain(PSInput input) : SV_TARGET
{
    float depthValue = depthMap.Sample(shadowSampler, float3(input.texCoord, layer)).r;
    return float4(depthValue, depthValue, depthValue, 1.0f); // orthographic
}
