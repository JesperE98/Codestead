// The shaders of the lamp. main.cpp compiles them at run time with D3DCompileFromFile.

// Root constants (root parameter 0): the lamp's model matrix.
cbuffer ModelConstants : register(b0)
{
    float4x4 model;
};

// The constant buffer at register b1: the lamp only needs the first two matrices of it.
cbuffer SceneConstantBuffer : register(b1)
{
    float4x4 view;
    float4x4 projection;
};

struct PSInput
{
    float4 position : SV_POSITION;
};

PSInput VSMain(float4 position : POSITION)
{
    PSInput result;

    result.position = mul(mul(mul(position, model), view), projection);

    return result;
}

float4 PSMain(PSInput input) : SV_TARGET
{
    return float4(1.0f, 1.0f, 1.0f, 1.0f); // set all 4 vector values to 1.0
}
