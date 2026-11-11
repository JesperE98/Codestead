// The floor, lit by a rectangular area light with linearly transformed cosines (LTC):
// learnopengl's 7.area_light.vs / .fs.

// Root constants (root parameter 0): the model matrix (the light's colour is for the light's
// rectangle, not used here).
cbuffer ObjectConstants : register(b0)
{
    float4x4 model;
    float4 lightColor;
};

// An area light (learnopengl's struct Light): its corners are float4s (w unused), the
// packing of the C++ struct.
struct Light
{
    float intensity;
    float3 color;
    float4 points[4];
    bool twoSided;
};

struct Material
{
    float4 albedoRoughness; // (x,y,z) = color, w = roughness
};

// The constant buffer (root parameter 1).
cbuffer SceneConstantBuffer : register(b1)
{
    float4x4 view;
    float4x4 projection;
    float3 viewPosition;
    Material material;
    Light areaLight;
};

// TODO: the LTC textures (LTC1 at t0, LTC2 at t1) and their sampler (s0)
Texture2D material_diffuse : register(t2);    // learnopengl's material.diffuse

SamplerState diffuseSampler : register(s1);  // linear, repeated

struct PSInput
{
    float4 position : SV_POSITION;
    float3 worldPosition : POSITION;
    float3 worldNormal : NORMAL;
    float2 texcoord : TEXCOORD;
};

PSInput VSMain(float3 aPosition : POSITION, float3 aNormal : NORMAL, float2 aTexcoord : TEXCOORD)
{
    PSInput result;

    float4 worldpos = mul(float4(aPosition, 1.0f), model);
    result.worldPosition = worldpos.xyz;
    // the normal matrix: the model matrix's upper 3 x 3 part (learnopengl passes mat3(model)
    // as a uniform; right while the model matrix has no non-uniform scale)
    result.worldNormal = mul(aNormal, (float3x3)model);
    result.texcoord = aTexcoord;

    result.position = mul(mul(worldpos, view), projection);

    return result;
}

// TODO: the LTC lookup's scale and bias (LUT_SIZE, LUT_SCALE, LUT_BIAS), IntegrateEdgeVec and LTC_Evaluate

// PBR-maps for roughness (and metallic) are usually stored in non-linear
// color space (sRGB), so we use these functions to convert into linear RGB.
float3 PowVec3(float3 v, float p)
{
    return float3(pow(v.x, p), pow(v.y, p), pow(v.z, p));
}

static const float gamma = 2.2f;
float3 ToLinear(float3 v) { return PowVec3(v, gamma); }
float3 ToSRGB(float3 v)   { return PowVec3(v, 1.0f / gamma); }

float4 PSMain(PSInput input) : SV_TARGET
{
    // gamma correction: the sRGB texture returns linear colours
    float3 mDiffuse = material_diffuse.Sample(diffuseSampler, input.texcoord).xyz;
    float3 mSpecular = ToLinear(float3(0.23f, 0.23f, 0.23f)); // mDiffuse

    float3 result = float3(0.0f, 0.0f, 0.0f);

    float3 N = normalize(input.worldNormal);
    float3 V = normalize(viewPosition - input.worldPosition);
    float3 P = input.worldPosition;
    float dotNV = saturate(dot(N, V));

    // TODO: the light's diffuse part: LTC_Evaluate with the identity matrix (a plain cosine) over the light's polygon

    return float4(ToSRGB(result), 1.0f);
}
