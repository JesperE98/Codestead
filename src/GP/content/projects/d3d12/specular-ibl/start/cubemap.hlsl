// The vertex shader of the capture passes (learnopengl's cubemap.vs): they draw the cube
// from its centre into one face of a cube map. main.cpp compiles it at run time with
// D3DCompileFromFile; the pixel shaders are in equirectangular_to_cubemap.hlsl and
// irradiance_convolution.hlsl.

// Root constants set from main.cpp with SetGraphicsRoot32BitConstants (root parameter 0):
// the view and projection matrices of the cube face that is being drawn.
cbuffer CaptureConstants : register(b0)
{
    float4x4 captureView;
    float4x4 captureProjection;
};

// What the vertex shader hands on to the rasterizer and the pixel shader.
struct PSInput
{
    float4 position : SV_POSITION;
    float3 worldPos : POSITION;    // the position on the cube: the direction from its centre
};

// The vertex shader: runs once per vertex.
PSInput VSMain(float3 position : POSITION)
{
    PSInput result;

    result.worldPos = position;
    result.position = mul(mul(float4(position, 1.0f), captureView), captureProjection);

    return result;
}
