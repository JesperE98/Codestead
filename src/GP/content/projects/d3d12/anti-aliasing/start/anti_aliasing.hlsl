// The shaders of the cube (learnopengl's anti_aliasing.vs / .fs). main.cpp compiles them at run
// time with D3DCompileFromFile.

// Root constants set from main.cpp with SetGraphicsRoot32BitConstants (root parameter 0).
cbuffer ModelConstants : register(b0)
{
    float4x4 model;
};

// The constant buffer at register b1 (the CBV in root parameter 1's table).
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

// The pixel shader: every pixel of the cube is green.
float4 PSMain(PSInput input) : SV_TARGET
{
    return float4(0.0f, 1.0f, 0.0f, 1.0f);
}
