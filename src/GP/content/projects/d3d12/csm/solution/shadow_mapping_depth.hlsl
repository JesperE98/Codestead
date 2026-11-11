// The shaders of the depth pass: they draw the scene from the light into all the layers of
// the shadow maps, in one pass. main.cpp compiles them at run time with D3DCompileFromFile.
// No pixel shader: there is no render target, so no colour to compute, and the rasterizer
// writes the depth by itself (learnopengl's fragment shader for this pass is empty).

// Root constants (root parameter 0): the model matrix of the draw.
cbuffer ModelConstants : register(b0)
{
    float4x4 model;
    float4x4 normalMatrix;
};

// The light-space matrices of the cascades (learnopengl's uniform block LightSpaceMatrices):
// register b2, the constant buffer view in root parameter 3's table.
cbuffer LightSpaceMatrices : register(b2)
{
    float4x4 lightSpaceMatrices[16];
};

// What the vertex shader hands on to the geometry shader: the position in world space, in
// SV_POSITION like learnopengl's gl_Position - the geometry shader's output is what the
// rasterizer uses.
struct GSInput
{
    float4 position : SV_POSITION;
};

// What the geometry shader hands on to the rasterizer.
struct PSInput
{
    float4 position : SV_POSITION;
    uint layer : SV_RenderTargetArrayIndex;    // the layer of the shadow maps this triangle goes to
};

// The vertex shader: only the model matrix - the geometry shader applies the light's matrices.
GSInput VSMain(float4 position : POSITION)
{
    GSInput result;
    result.position = mul(position, model);
    return result;
}

// The geometry shader runs 5 times per triangle (geometry shader instancing: learnopengl's
// layout(triangles, invocations = 5)), once per cascade: invocation = 0 ... 4. Each time it
// transforms the triangle with that cascade's matrix and sends it to that layer.
[instance(5)]
[maxvertexcount(3)]
void GSMain(triangle GSInput input[3], uint invocation : SV_GSInstanceID, inout TriangleStream<PSInput> triStream)
{
    for (int i = 0; i < 3; ++i)
    {
        PSInput output;
        output.position = mul(input[i].position, lightSpaceMatrices[invocation]);
        output.layer = invocation;
        triStream.Append(output);
    }
    triStream.RestartStrip();
}
