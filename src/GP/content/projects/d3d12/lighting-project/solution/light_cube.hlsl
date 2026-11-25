// The shaders of the lamp. main.cpp compiles them at run time with D3DCompileFromFile.

// Root constants (root parameter 0): the lamp's model matrix, and its colour.
cbuffer ModelConstants : register(b0)
{
    float4x4 model;
    float4x4 normalMatrix;    // not used by the lamp, but declared so that color is where main.cpp puts it
    float3 color;             // the colour of the light this lamp stands for
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
    return float4(color, 1.0f);
}
