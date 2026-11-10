// The shaders of the depth pass: they draw the scene from the light into the six faces of the
// depth cubemap, in one pass. main.cpp compiles them at run time with D3DCompileFromFile.

// Root constants (root parameter 0): the model matrix of the draw.
cbuffer ModelConstants : register(b0)
{
    float4x4 model;
};

// The constant buffer at register b1: this pass needs the six shadow matrices, far_plane
// and the light's position (view, projection and viewPos are the camera's).
cbuffer SceneConstantBuffer : register(b1)
{
    float4x4 view;
    float4x4 projection;
    float4x4 shadowMatrices[6];
    float3 viewPos;
    float far_plane;
    float3 lightPos;
};

// What the vertex shader hands on to the geometry shader: the position in world space, in
// SV_POSITION like learnopengl's gl_Position - the geometry shader's output is what the
// rasterizer uses.
struct GSInput
{
    float4 position : SV_POSITION;
};

// What the geometry shader hands on to the rasterizer and the pixel shader.
struct PSInput
{
    float4 position : SV_POSITION;
    float4 fragPos : POSITION;    // FragPos from GS (output per emitvertex)
    uint layer : SV_RenderTargetArrayIndex;    // the cube face (slice) this triangle goes to
};

// The vertex shader: only the model matrix - the geometry shader applies the light's matrices.
GSInput VSMain(float4 position : POSITION)
{
    GSInput result;
    result.position = mul(position, model);
    return result;
}

// The geometry shader: every triangle goes to all six faces, each time with that face's
// matrix: at most 6 x 3 = 18 vertices.
[maxvertexcount(18)]
void GSMain(triangle GSInput input[3], inout TriangleStream<PSInput> triStream)
{
    for (int face = 0; face < 6; ++face)
    {
        PSInput output;
        output.layer = face;    // built-in value that specifies to which face we render.
        for (int i = 0; i < 3; ++i)    // for each triangle's vertices
        {
            output.fragPos = input[i].position;
            output.position = mul(output.fragPos, shadowMatrices[face]);
            triStream.Append(output);
        }
        triStream.RestartStrip();
    }
}

// The pixel shader: the depth it writes (SV_Depth) is the distance to the light, divided by
// far_plane to fit into 0..1 - a linear distance instead of the projection's depth.
float PSMain(PSInput input) : SV_Depth
{
    float lightDistance = length(input.fragPos.xyz - lightPos);

    // map to [0;1] range by dividing by far_plane
    lightDistance = lightDistance / far_plane;

    // write this as modified depth
    return lightDistance;
}
