// The shaders of the light cubes (learnopengl's 8.1.deferred_light_box.vs / .fs): each cube
// in its light's colour, no lighting. main.cpp compiles them at run time with
// D3DCompileFromFile.

// Root constants set from main.cpp with SetGraphicsRoot32BitConstants (root parameter 0):
// the same constant buffer as in g_buffer.hlsl - here model and lightColor are used.
cbuffer ModelConstants : register(b0)
{
    float4x4 model;
    float4x4 normalMatrix;
    float3 lightColor;
};

// The constant buffer at register b1: only view and projection are used here, so the
// declaration can stop after them (the rest of the buffer is simply not read).
cbuffer SceneConstantBuffer : register(b1)
{
    float4x4 view;
    float4x4 projection;
};

// The vertex shader: model, view and projection.
float4 VSMain(float4 position : POSITION) : SV_POSITION
{
    return mul(mul(mul(position, model), view), projection);
}

// The pixel shader: the light's colour.
float4 PSMain(float4 position : SV_POSITION) : SV_TARGET
{
    return float4(lightColor, 1.0f);
}
