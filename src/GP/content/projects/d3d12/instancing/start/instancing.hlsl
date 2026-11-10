// The shaders of the quads (learnopengl's instancing.vs / .fs). main.cpp compiles them at run
// time with D3DCompileFromFile.

// What the vertex shader hands on to the rasterizer and the pixel shader.
struct PSInput
{
    float4 position : SV_POSITION;
    float3 color : COLOR;
};

// The vertex shader: the quad's corners are already in normalized device coordinates.
PSInput VSMain(float2 position : POSITION, float3 color : COLOR)
{
    PSInput result;

    result.color = color;
    result.position = float4(position, 0.0f, 1.0f);

    return result;
}

// The pixel shader: the colour, interpolated between the corners.
float4 PSMain(PSInput input) : SV_TARGET
{
    return float4(input.color, 1.0f);
}
