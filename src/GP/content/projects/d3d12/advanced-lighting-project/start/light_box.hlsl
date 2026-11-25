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

// What the pixel shader writes: one colour per render target.
struct PSOutput
{
    float4 FragColor : SV_TARGET0;      // the scene (colour buffer 0)
    float4 BrightColor : SV_TARGET1;    // only its bright parts (colour buffer 1)
};

// The pixel shader: the light's colour, brighter than 1.0.
PSOutput PSMain(PSInput input)
{
    PSOutput output;
    output.FragColor = float4(lightColor, 1.0f);
    float brightness = dot(output.FragColor.rgb, float3(0.2126f, 0.7152f, 0.0722f));
    if (brightness > 1.0f)
        output.BrightColor = float4(output.FragColor.rgb, 1.0f);
    else
        output.BrightColor = float4(0.0f, 0.0f, 0.0f, 1.0f);
    return output;
}
