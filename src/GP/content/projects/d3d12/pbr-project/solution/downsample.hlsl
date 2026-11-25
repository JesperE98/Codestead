// The pixel shader that makes a mip level of the environment cube map from the level above
// it; its vertex shader is cubemap.hlsl's VSMain. OpenGL has glGenerateMipmap for this -
// Direct3D 12 leaves it to the program. main.cpp compiles it at run time with
// D3DCompileFromFile.

// The level above (twice as wide and high), as a cube map of its own: register t0, in the
// descriptor table of root parameter 2.
TextureCube environmentMap : register(t0);
// The sampler: register s0, the static sampler of the root signature (linear, CLAMP).
SamplerState clampSampler : register(s0);

// What the vertex shader hands on to the rasterizer and the pixel shader.
struct PSInput
{
    float4 position : SV_POSITION;
    float3 worldPos : POSITION;    // the position on the cube: the direction from its centre
};

// The pixel shader: runs once per pixel of the cube face.
float4 PSMain(PSInput input) : SV_TARGET
{
    // The view shows a single mip level - the level above. In this pixel's direction the
    // linear filter averages its 2 x 2 texels.
    float3 color = environmentMap.Sample(clampSampler, input.worldPos).rgb;

    return float4(color, 1.0f);
}
