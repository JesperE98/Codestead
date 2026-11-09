// The shaders of the outlines. main.cpp compiles them at run time with D3DCompileFromFile.

// Root constants (root parameter 0): the model matrix.
cbuffer ModelConstants : register(b0)
{
    float4x4 model;
};

// The constant buffer at register b1: the view and projection matrices.
cbuffer SceneConstantBuffer : register(b1)
{
    float4x4 view;
    float4x4 projection;
};

struct PSInput
{
    float4 position : SV_POSITION;
};

// The same vertex shader as stencil_testing.hlsl's (the texture coordinates are not needed).
PSInput VSMain(float4 position : POSITION)
{
    PSInput result;

    result.position = mul(mul(mul(position, model), view), projection);

    return result;
}

float4 PSMain(PSInput input) : SV_TARGET
{
    // TODO: every pixel of the outline gets the same colour: float4(0.04f, 0.28f, 0.26f, 1.0f)
    return float4(0.0f, 0.0f, 0.0f, 1.0f);
}
