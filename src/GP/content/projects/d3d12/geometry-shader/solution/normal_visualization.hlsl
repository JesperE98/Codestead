// The shaders that draw the model's normals as lines (learnopengl's normal_visualization.vs /
// .gs / .fs). main.cpp compiles them at run time with D3DCompileFromFile.

// Root constants set from main.cpp with SetGraphicsRoot32BitConstants (root parameter 0).
cbuffer ModelConstants : register(b0)
{
    float4x4 model;
    float4x4 normalMatrix;    // transpose(inverse(model)), computed in main.cpp
};

// The constant buffer at register b1 (the CBV in root parameter 1's table).
cbuffer SceneConstantBuffer : register(b1)
{
    float4x4 view;
    float4x4 projection;
};

// What the vertex shader hands on to the geometry shader: in view space.
struct VSOutput
{
    float4 position : SV_POSITION;
    float3 normal : NORMAL;
};

// What the geometry shader hands on to the rasterizer: the lines' end points.
struct GSOutput
{
    float4 position : SV_POSITION;
};

VSOutput VSMain(float4 position : POSITION, float3 normal : NORMAL)
{
    VSOutput result;

    // The geometry shader works in view space: the position only gets the model and the
    // view matrix (the geometry shader applies the projection).
    result.position = mul(mul(position, model), view);
    // The normal: into world space with the normal matrix, then into view space with the
    // view matrix (it only turns and moves the scene, so it turns normals like positions).
    // Normalized: the model is scaled, the lines must still be 0.2 long.
    float3 worldNormal = mul(float4(normal, 0.0f), normalMatrix).xyz;
    result.normal = normalize(mul(float4(worldNormal, 0.0f), view).xyz);

    return result;
}

static const float MAGNITUDE = 0.2f;

// A line from a vertex along its normal, as a strip of 2 vertices.
void GenerateLine(VSOutput vertex, inout LineStream<GSOutput> lineStream)
{
    GSOutput output;
    output.position = mul(vertex.position, projection);
    lineStream.Append(output);
    output.position = mul(vertex.position + float4(vertex.normal, 0.0f) * MAGNITUDE, projection);
    lineStream.Append(output);
    lineStream.RestartStrip();
}

// The geometry shader: runs once per triangle and outputs three lines (6 vertices).
[maxvertexcount(6)]
void GSMain(triangle VSOutput input[3], inout LineStream<GSOutput> lineStream)
{
    GenerateLine(input[0], lineStream);    // first vertex normal
    GenerateLine(input[1], lineStream);    // second vertex normal
    GenerateLine(input[2], lineStream);    // third vertex normal
}

float4 PSMain(GSOutput input) : SV_TARGET
{
    return float4(1.0f, 1.0f, 0.0f, 1.0f);    // yellow
}
