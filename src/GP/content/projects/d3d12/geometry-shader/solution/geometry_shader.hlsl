// The shaders of the points (learnopengl's geometry_shader.vs / .gs / .fs). main.cpp compiles
// them at run time with D3DCompileFromFile.

// What the vertex shader hands on to the geometry shader.
struct VSOutput
{
    float4 position : SV_POSITION;
    float3 color : COLOR;
};

// What the geometry shader hands on to the rasterizer and the pixel shader.
struct GSOutput
{
    float4 position : SV_POSITION;
    float3 color : COLOR;
};

// The vertex shader: the point's position is already in normalized device coordinates.
VSOutput VSMain(float2 position : POSITION, float3 color : COLOR)
{
    VSOutput result;

    result.color = color;
    result.position = float4(position.x, position.y, 0.0f, 1.0f);

    return result;
}

// A house around a point: a triangle strip of 5 vertices, i.e. 3 triangles - two for the
// walls, one for the roof.
void build_house(float4 position, float3 color, inout TriangleStream<GSOutput> triStream)
{
    GSOutput output;
    output.color = color;
    output.position = position + float4(-0.2f, -0.2f, 0.0f, 0.0f);    // 1:bottom-left
    triStream.Append(output);
    output.position = position + float4( 0.2f, -0.2f, 0.0f, 0.0f);    // 2:bottom-right
    triStream.Append(output);
    output.position = position + float4(-0.2f,  0.2f, 0.0f, 0.0f);    // 3:top-left
    triStream.Append(output);
    output.position = position + float4( 0.2f,  0.2f, 0.0f, 0.0f);    // 4:top-right
    triStream.Append(output);
    output.position = position + float4( 0.0f,  0.4f, 0.0f, 0.0f);    // 5:top
    output.color = float3(1.0f, 1.0f, 1.0f);    // the roof's tip is white: snow
    triStream.Append(output);
    triStream.RestartStrip();
}

// The geometry shader: runs once per point and outputs a triangle strip of at most 5
// vertices: a house.
[maxvertexcount(5)]
void GSMain(point VSOutput input[1], inout TriangleStream<GSOutput> triStream)
{
    build_house(input[0].position, input[0].color, triStream);    // input[0] since there's only one input vertex
}

// The pixel shader: the colour of the point.
float4 PSMain(GSOutput input) : SV_TARGET
{
    return float4(input.color, 1.0f);
}
