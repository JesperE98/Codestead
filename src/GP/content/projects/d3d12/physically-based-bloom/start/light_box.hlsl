// The pixel shader of the light cubes (learnopengl's 7.light_box.fs); their vertex shader is
// bloom.hlsl's VSMain. main.cpp compiles it at run time with D3DCompileFromFile.

// Root constants set from main.cpp with SetGraphicsRoot32BitConstants (root parameter 0):
// the same constant buffer as in bloom.hlsl - here only lightColor is used.
cbuffer ModelConstants : register(b0)
{
    float4x4 model;
    float4x4 normalMatrix;
    float3 lightColor;
};

// What bloom.hlsl's vertex shader hands on (the pixel shader's input must match it).
struct PSInput
{
    float4 position : SV_POSITION;
    float3 fragPos : POSITION;
    float3 normal : NORMAL;
    float2 texCoord : TEXCOORD;
};

// The pixel shader: the light's colour, brighter than 1.0.
float4 PSMain(PSInput input) : SV_TARGET
{
    return float4(lightColor, 1.0f);
}
