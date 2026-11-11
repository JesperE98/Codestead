// The shaders of the solid objects (learnopengl's solid.vs / solid.fs): a single colour.
// main.cpp compiles them at run time with D3DCompileFromFile.

// Root constants set from main.cpp with SetGraphicsRoot32BitConstants (root parameter 0).
cbuffer ObjectConstants : register(b0)
{
    float4x4 mvp;      // model * view * projection
    float4 color;      // material color (alpha unused)
};

// What the vertex shader hands on to the rasterizer and the pixel shader.
struct PSInput
{
    float4 position : SV_POSITION;
};

// The vertex shader: the quad's position into clip space.
PSInput VSMain(float3 position : POSITION)
{
    PSInput result;

    result.position = mul(float4(position, 1.0f), mvp);

    return result;
}

// The pixel shader: the material colour, opaque.
float4 PSMain(PSInput input) : SV_TARGET
{
    return float4(color.rgb, 1.0f);
}
