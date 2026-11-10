// The pixel shader that converts the equirectangular environment map to a cube map
// (learnopengl's equirectangular_to_cubemap.fs); its vertex shader is cubemap.hlsl's
// VSMain. main.cpp compiles it at run time with D3DCompileFromFile.

// The HDR environment map, one 2D image of the whole sky: register t0, in the descriptor
// table of root parameter 2.
Texture2D equirectangularMap : register(t0);
// The sampler: register s0, the static sampler of the root signature (linear, CLAMP).
SamplerState clampSampler : register(s0);

// What the vertex shader hands on to the rasterizer and the pixel shader.
struct PSInput
{
    float4 position : SV_POSITION;
    float3 worldPos : POSITION;    // the position on the cube: the direction from its centre
};

// TODO: SampleSphericalMap(v): the texture coordinates in the equirectangular map for the direction v

// The pixel shader: runs once per pixel of the cube face.
float4 PSMain(PSInput input) : SV_TARGET
{
    // TODO: the colour of the equirectangular map in this pixel's direction, normalize(input.worldPos)
    return float4(0.0f, 0.0f, 0.0f, 1.0f);
}
