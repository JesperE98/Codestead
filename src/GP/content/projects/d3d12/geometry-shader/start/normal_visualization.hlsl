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

// TODO: a geometry shader GSMain: for every vertex of a triangle, a line (LineStream, 6 vertices in all) from the vertex along its normal (length 0.2), projected with the projection matrix

float4 PSMain(GSOutput input) : SV_TARGET
{
    return float4(1.0f, 1.0f, 0.0f, 1.0f);    // yellow
}
