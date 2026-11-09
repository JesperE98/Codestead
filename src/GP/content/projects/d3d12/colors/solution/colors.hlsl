// The shaders of the lit object (the cube). main.cpp compiles them at run time with D3DCompileFromFile.

// Root constants set from main.cpp with SetGraphicsRoot32BitConstants (root parameter 0):
// the shaders see them as a constant buffer at register b0.
cbuffer ModelConstants : register(b0)
{
    float4x4 model;
};

// The constant buffer at register b1 (the CBV in root parameter 1's table): the values
// that are the same for every draw of a frame.
cbuffer SceneConstantBuffer : register(b1)
{
    float4x4 view;
    float4x4 projection;
    float3 objectColor;
    float3 lightColor;
};

// What the vertex shader hands on to the rasterizer and the pixel shader.
struct PSInput
{
    float4 position : SV_POSITION;
};

// The vertex shader: runs once per vertex.
PSInput VSMain(float4 position : POSITION)
{
    PSInput result;

    // The position is a row vector, multiplied by the matrices from left to right:
    // model, then view, then projection (GLSL: projection * view * model * position).
    result.position = mul(mul(mul(position, model), view), projection);

    return result;
}

// The pixel shader: runs once per pixel a triangle covers and returns its colour (RGBA).
float4 PSMain(PSInput input) : SV_TARGET
{
    return float4(lightColor * objectColor, 1.0f);
}
