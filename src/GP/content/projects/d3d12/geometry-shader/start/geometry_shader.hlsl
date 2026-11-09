// The shaders of the points (learnopengl's geometry_shader.vs / .gs / .fs). main.cpp compiles
// them at run time with D3DCompileFromFile.

// What the vertex shader hands on to the rasterizer and the pixel shader.
struct PSInput
{
    float4 position : SV_POSITION;
    float3 color : COLOR;
};

// The vertex shader: the point's position is already in normalized device coordinates.
PSInput VSMain(float2 position : POSITION, float3 color : COLOR)
{
    PSInput result;

    result.color = color;
    result.position = float4(position.x, position.y, 0.0f, 1.0f);

    return result;
}

// TODO: a geometry shader GSMain that passes each point through unchanged (input: one point, output: a PointStream of at most 1 vertex)

// The pixel shader: the colour of the point.
float4 PSMain(PSInput input) : SV_TARGET
{
    return float4(input.color, 1.0f);
}
