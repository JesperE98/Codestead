// The floor, lit by a rectangular area light with linearly transformed cosines (LTC):
// learnopengl's 7.area_light.vs / .fs.

// Root constants (root parameter 0): the model matrix (the light's colour is for the light's
// rectangle, not used here).
cbuffer ObjectConstants : register(b0)
{
    float4x4 model;
    float4 lightColor;
};

// The area light (learnopengl's struct Light): its corners are float4s (w unused), the
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

Texture2D LTC1 : register(t0); // for inverse M
Texture2D LTC2 : register(t1); // GGX norm, fresnel, 0(unused), sphere
Texture2D material_diffuse : register(t2);    // learnopengl's material.diffuse

SamplerState ltcSampler : register(s0);      // nearest when minified, linear when magnified, clamped
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

static const float LUT_SIZE  = 64.0f; // ltc_texture size
static const float LUT_SCALE = (LUT_SIZE - 1.0f) / LUT_SIZE;
static const float LUT_BIAS  = 0.5f / LUT_SIZE;

// Vector form without project to the plane (dot with the normal)
// Use for proxy sphere clipping
float3 IntegrateEdgeVec(float3 v1, float3 v2)
{
    // Using built-in acos() function will result flaws
    // Using fitting result for calculating acos()
    float x = dot(v1, v2);
    float y = abs(x);

    float a = 0.8543985f + (0.4965155f + 0.0145206f * y) * y;
    float b = 3.4175940f + (4.1616724f + y) * y;
    float v = a / b;

    float theta_sintheta = (x > 0.0f) ? v : 0.5f * rsqrt(max(1.0f - x * x, 1e-7f)) - v;

    return cross(v1, v2) * theta_sintheta;
}

// P is fragPos in world space (LTC distribution)
float3 LTC_Evaluate(float3 N, float3 V, float3 P, float3x3 Minv, float4 points[4], bool twoSided)
{
    // construct orthonormal basis around N
    float3 T1, T2;
    T1 = normalize(V - N * dot(V, N));
    T2 = cross(N, T1);

    // rotate area light in (T1, T2, N) basis: HLSL's float3x3(T1, T2, N) has the rows
    // T1, T2 and N - GLSL's transpose(mat3(T1, T2, N))
    Minv = mul(Minv, float3x3(T1, T2, N));

    // polygon (allocate 4 vertices for clipping)
    float3 L[4];
    // transform polygon from LTC back to origin Do (cosine weighted)
    L[0] = mul(Minv, points[0].xyz - P);
    L[1] = mul(Minv, points[1].xyz - P);
    L[2] = mul(Minv, points[2].xyz - P);
    L[3] = mul(Minv, points[3].xyz - P);

    // use tabulated horizon-clipped sphere
    // check if the shading point is behind the light
    float3 dir = points[0].xyz - P; // LTC space
    float3 lightNormal = cross(points[1].xyz - points[0].xyz, points[3].xyz - points[0].xyz);
    bool behind = (dot(dir, lightNormal) < 0.0f);

    // cos weighted space
    L[0] = normalize(L[0]);
    L[1] = normalize(L[1]);
    L[2] = normalize(L[2]);
    L[3] = normalize(L[3]);

    // integrate
    float3 vsum = float3(0.0f, 0.0f, 0.0f);
    vsum += IntegrateEdgeVec(L[0], L[1]);
    vsum += IntegrateEdgeVec(L[1], L[2]);
    vsum += IntegrateEdgeVec(L[2], L[3]);
    vsum += IntegrateEdgeVec(L[3], L[0]);

    // form factor of the polygon in direction vsum
    float len = length(vsum);

    float z = vsum.z / len;
    if (behind)
        z = -z;

    float2 uv = float2(z * 0.5f + 0.5f, len); // range [0, 1]
    uv = uv * LUT_SCALE + LUT_BIAS;

    // Fetch the form factor for horizon clipping
    float scale = LTC2.Sample(ltcSampler, uv).w;

    float sum = len * scale;
    if (!behind && !twoSided)
        sum = 0.0f;

    // Outgoing radiance (solid angle) for the entire polygon
    float3 Lo_i = float3(sum, sum, sum);
    return Lo_i;
}

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

    // use roughness and sqrt(1-cos_theta) to sample M_texture
    float2 uv = float2(material.albedoRoughness.w, sqrt(1.0f - dotNV));
    uv = uv * LUT_SCALE + LUT_BIAS;

    // get 4 parameters for inverse_M
    float4 t1 = LTC1.Sample(ltcSampler, uv);

    // Get 2 parameters for Fresnel calculation
    float4 t2 = LTC2.Sample(ltcSampler, uv);

    // the inverse M: GLSL's mat3(vec3(t1.x, 0, t1.y), vec3(0, 1, 0), vec3(t1.z, 0, t1.w)) takes
    // columns, HLSL's float3x3 rows - the same matrix written as rows
    float3x3 Minv = float3x3(
        float3(t1.x, 0.0f, t1.z),
        float3(0.0f, 1.0f, 0.0f),
        float3(t1.y, 0.0f, t1.w)
    );

    // the identity matrix: the diffuse part is the plain cosine distribution
    float3x3 identity = float3x3(1.0f, 0.0f, 0.0f, 0.0f, 1.0f, 0.0f, 0.0f, 0.0f, 1.0f);

    // Evaluate LTC shading
    float3 diffuse = LTC_Evaluate(N, V, P, identity, areaLight.points, areaLight.twoSided);
    float3 specular = LTC_Evaluate(N, V, P, Minv, areaLight.points, areaLight.twoSided);

    // GGX BRDF shadowing and Fresnel
    // t2.x: shadowedF90 (F90 normally it should be 1.0)
    // t2.y: Smith function for Geometric Attenuation Term, it is dot(V or L, H).
    specular *= mSpecular * t2.x + (1.0f - mSpecular) * t2.y;

    result = areaLight.color * areaLight.intensity * (specular + mDiffuse * diffuse);

    return float4(ToSRGB(result), 1.0f);
}
