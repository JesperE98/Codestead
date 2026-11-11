// The terrain from the CPU: the height of each vertex as a shade of grey.

cbuffer SceneConstantBuffer : register(b0)
{
    float4x4 model;
    float4x4 view;
    float4x4 projection;
};

struct PSInput
{
    float4 position : SV_POSITION;
    float height : HEIGHT;
};

PSInput VSMain(float3 position : POSITION)
{
    PSInput result;

    result.height = position.y;
    result.position = mul(mul(mul(float4(position, 1.0f), model), view), projection);

    return result;
}

float4 PSMain(PSInput input) : SV_TARGET
{
    float h = (input.height + 16.0f) / 64.0f;    // shift and scale the height into a grey value (0 .. 1)
    return float4(h, h, h, 1.0f);
}
