// The shaders of the quads (learnopengl's instancing.vs / .fs). main.cpp compiles them at run
// time with D3DCompileFromFile.



// What the vertex shader hands on to the rasterizer and the pixel shader.
struct PSInput
{
    float4 position : SV_POSITION;
    float3 color : COLOR;
};

// The vertex shader: the quad's corners are already in normalized device coordinates.
// offset: an instanced input - a new value for every instance (input slot 1).
PSInput VSMain(float2 position : POSITION, float3 color : COLOR, float2 offset : OFFSET, uint instanceID : SV_InstanceID)
{
    PSInput result;

    float2 pos = position * (instanceID / 100.0f);    // the quads grow from the first instance (bottom-left) to the last (top-right)
    result.color = color;
    result.position = float4(pos + offset, 0.0f, 1.0f);

    return result;
}

// The pixel shader: the colour, interpolated between the corners.
float4 PSMain(PSInput input) : SV_TARGET
{
    return float4(input.color, 1.0f);
}
