// The light's rectangle: drawn in the light's colour (no lighting, no gamma correction).

// Root constants (root parameter 0): the model matrix and the light's colour.
cbuffer ObjectConstants : register(b0)
{
    float4x4 model;
    float4 lightColor;
};

// The constant buffer (root parameter 1): only the view and projection matrices are used here.
cbuffer SceneConstantBuffer : register(b1)
{
    float4x4 view;
    float4x4 projection;
};

float4 VSMain(float3 aPosition : POSITION, float3 aNormal : NORMAL, float2 aTexcoord : TEXCOORD) : SV_POSITION
{
    return mul(mul(mul(float4(aPosition, 1.0f), model), view), projection);
}

float4 PSMain(float4 position : SV_POSITION) : SV_TARGET
{
    return float4(lightColor.rgb, 1.0f);
}
