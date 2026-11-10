// The pixel shader that pre-filters the environment cube map (learnopengl's prefilter.fs):
// for one roughness, the environment as a surface that rough reflects it. Its vertex shader
// is cubemap.hlsl's VSMain. main.cpp compiles it at run time with D3DCompileFromFile.

// The environment cube map with its mip levels: register t0, in the descriptor table of
// root parameter 2.
TextureCube environmentMap : register(t0);
// The sampler: register s0, the static sampler of the root signature (linear, CLAMP).
SamplerState clampSampler : register(s0);

// Root constants set from main.cpp with SetGraphicsRoot32BitConstants (root parameter 0):
// after the two matrices the vertex shader reads, the roughness of the mip level that is
// being drawn.
cbuffer CaptureConstants : register(b0)
{
    float4x4 captureView;
    float4x4 captureProjection;
    float roughness;
};

// What the vertex shader hands on to the rasterizer and the pixel shader.
struct PSInput
{
    float4 position : SV_POSITION;
    float3 worldPos : POSITION;    // the position on the cube: the direction from its centre
};

static const float PI = 3.14159265359f;
// ----------------------------------------------------------------------------
float DistributionGGX(float3 N, float3 H, float roughness)
{
    float a = roughness * roughness;
    float a2 = a * a;
    float NdotH = max(dot(N, H), 0.0f);
    float NdotH2 = NdotH * NdotH;

    float nom   = a2;
    float denom = (NdotH2 * (a2 - 1.0f) + 1.0f);
    denom = PI * denom * denom;

    return nom / denom;
}
// ----------------------------------------------------------------------------
// http://holger.dammertz.org/stuff/notes_HammersleyOnHemisphere.html
// efficient VanDerCorpus calculation.
float RadicalInverse_VdC(uint bits)
{
    bits = (bits << 16u) | (bits >> 16u);
    bits = ((bits & 0x55555555u) << 1u) | ((bits & 0xAAAAAAAAu) >> 1u);
    bits = ((bits & 0x33333333u) << 2u) | ((bits & 0xCCCCCCCCu) >> 2u);
    bits = ((bits & 0x0F0F0F0Fu) << 4u) | ((bits & 0xF0F0F0F0u) >> 4u);
    bits = ((bits & 0x00FF00FFu) << 8u) | ((bits & 0xFF00FF00u) >> 8u);
    return float(bits) * 2.3283064365386963e-10; // / 0x100000000
}
// ----------------------------------------------------------------------------
float2 Hammersley(uint i, uint N)
{
    return float2(float(i) / float(N), RadicalInverse_VdC(i));
}
// ----------------------------------------------------------------------------
// TODO: ImportanceSampleGGX(Xi, N, roughness): a halfway vector around N, distributed like the GGX lobe of this roughness
// ----------------------------------------------------------------------------
// The pixel shader: runs once per pixel of the cube face.
float4 PSMain(PSInput input) : SV_TARGET
{
    float3 N = normalize(input.worldPos);

    // make the simplifying assumption that V equals R equals the normal
    float3 R = N;
    float3 V = R;

    // TODO: the average of the environment's light from SAMPLE_COUNT (128) importance-sampled directions, weighted by NdotL
    float3 prefilteredColor = float3(0.0f, 0.0f, 0.0f);

    return float4(prefilteredColor, 1.0f);
}
