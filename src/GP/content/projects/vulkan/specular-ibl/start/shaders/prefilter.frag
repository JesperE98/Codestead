#version 450

layout(binding = 1) uniform samplerCube environmentMap;

// the push constants of a capture pass: the roughness comes after the matrix
layout(push_constant) uniform CapturePushConstants {
    mat4 projectionView;
    float roughness;
} pc;

layout(location = 0) in vec3 fragWorldPos;

layout(location = 0) out vec4 outColor;

const float PI = 3.14159265359;
// ----------------------------------------------------------------------------
float DistributionGGX(vec3 N, vec3 H, float roughness) {
    float a = roughness*roughness;
    float a2 = a*a;
    float NdotH = max(dot(N, H), 0.0);
    float NdotH2 = NdotH*NdotH;

    float nom   = a2;
    float denom = (NdotH2 * (a2 - 1.0) + 1.0);
    denom = PI * denom * denom;

    return nom / denom;
}
// ----------------------------------------------------------------------------
// http://holger.dammertz.org/stuff/notes_HammersleyOnHemisphere.html
// efficient VanDerCorpus calculation.
float RadicalInverse_VdC(uint bits) {
    bits = (bits << 16u) | (bits >> 16u);
    bits = ((bits & 0x55555555u) << 1u) | ((bits & 0xAAAAAAAAu) >> 1u);
    bits = ((bits & 0x33333333u) << 2u) | ((bits & 0xCCCCCCCCu) >> 2u);
    bits = ((bits & 0x0F0F0F0Fu) << 4u) | ((bits & 0xF0F0F0F0u) >> 4u);
    bits = ((bits & 0x00FF00FFu) << 8u) | ((bits & 0xFF00FF00u) >> 8u);
    return float(bits) * 2.3283064365386963e-10; // / 0x100000000
}
// ----------------------------------------------------------------------------
vec2 Hammersley(uint i, uint N) {
    return vec2(float(i)/float(N), RadicalInverse_VdC(i));
}
// ----------------------------------------------------------------------------
// TODO: ImportanceSampleGGX(Xi, N, roughness): a halfway vector around N, distributed like the GGX lobe of this roughness
// ----------------------------------------------------------------------------
void main() {
    vec3 N = normalize(fragWorldPos);
    float roughness = pc.roughness;

    // make the simplifying assumption that V equals R equals the normal
    vec3 R = N;
    vec3 V = R;

    // TODO: the average of the environment's light from SAMPLE_COUNT (128) importance-sampled directions, weighted by NdotL
    vec3 prefilteredColor = vec3(0.0);

    outColor = vec4(prefilteredColor, 1.0);
}
