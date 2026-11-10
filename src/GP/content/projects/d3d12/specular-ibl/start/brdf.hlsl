// The shaders that integrate the BRDF into a 2D lookup texture (learnopengl's brdf.vs /
// brdf.fs): drawn once on the screen quad. main.cpp compiles them at run time with
// D3DCompileFromFile.

// What the vertex shader hands on to the rasterizer and the pixel shader.
struct PSInput
{
    float4 position : SV_POSITION;
    float2 texCoords : TEXCOORD;
};

static const float PI = 3.14159265359f;

// The vertex shader: the quad's positions are in normalized device coordinates already.
PSInput VSMain(float3 position : POSITION, float2 texCoords : TEXCOORD)
{
    PSInput result;

    result.texCoords = texCoords;
    result.position = float4(position, 1.0f);

    return result;
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
// TODO: ImportanceSampleGGX(Xi, N, roughness), the same as in prefilter.hlsl
// ----------------------------------------------------------------------------
// TODO: GeometrySchlickGGX(NdotV, roughness) with the k of image based lighting, and GeometrySmith(N, V, L, roughness)
// ----------------------------------------------------------------------------
// TODO: IntegrateBRDF(NdotV, roughness): the scale and the bias of F0 for this view angle and roughness
// ----------------------------------------------------------------------------
// The pixel shader: runs once per texel of the lookup texture. It returns two values: the
// render target has two channels (red and green).
float2 PSMain(PSInput input) : SV_TARGET
{
    // TODO: the integrated BRDF for NdotV = input.texCoords.x and roughness = input.texCoords.y
    return float2(0.0f, 0.0f);
}
