#version 330 core
out vec2 FragColor;
in vec2 TexCoords;

const float PI = 3.14159265359;
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
vec2 Hammersley(uint i, uint N)
{
    return vec2(float(i)/float(N), RadicalInverse_VdC(i));
}
// ----------------------------------------------------------------------------
// TODO: ImportanceSampleGGX(Xi, N, roughness), the same as in prefilter.fs
// ----------------------------------------------------------------------------
// TODO: GeometrySchlickGGX(NdotV, roughness) with the k of image based lighting, and GeometrySmith(N, V, L, roughness)
// ----------------------------------------------------------------------------
// TODO: IntegrateBRDF(NdotV, roughness): the scale and the bias of F0 for this view angle and roughness
// ----------------------------------------------------------------------------
void main()
{
    // TODO: the integrated BRDF for NdotV = TexCoords.x and roughness = TexCoords.y
    FragColor = vec2(0.0, 0.0);
}
