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

static const float2 invAtan = float2(0.1591f, 0.3183f);
float2 SampleSphericalMap(float3 v)
{
    float2 uv = float2(atan2(v.z, v.x), asin(v.y));
    uv *= invAtan;
    uv += 0.5f;
    // Direct3D's v = 0 is the image's top row, where the sky is (learnopengl flips the
    // image when loading it instead: its v = 0 is the bottom row)
    uv.y = 1.0f - uv.y;
    return uv;
}

// The pixel shader: runs once per pixel of the cube face.
float4 PSMain(PSInput input) : SV_TARGET
{
    float2 uv = SampleSphericalMap(normalize(input.worldPos));
    float3 color = equirectangularMap.Sample(clampSampler, uv).rgb;

    return float4(color, 1.0f);
}
