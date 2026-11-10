// The pixel shader that convolutes the environment cube map into the irradiance map
// (learnopengl's irradiance_convolution.fs); its vertex shader is cubemap.hlsl's VSMain.
// main.cpp compiles it at run time with D3DCompileFromFile.

// The environment cube map: register t0, in the descriptor table of root parameter 2.
TextureCube environmentMap : register(t0);
// The sampler: register s0, the static sampler of the root signature (linear, CLAMP).
SamplerState clampSampler : register(s0);

// What the vertex shader hands on to the rasterizer and the pixel shader.
struct PSInput
{
    float4 position : SV_POSITION;
    float3 worldPos : POSITION;    // the position on the cube: the direction from its centre
};

static const float PI = 3.14159265359f;

// The pixel shader: runs once per pixel of the cube face.
float4 PSMain(PSInput input) : SV_TARGET
{
    // The world vector acts as the normal of a tangent surface
    // from the origin, aligned to WorldPos. Given this normal, calculate all
    // incoming radiance of the environment. The result of this radiance
    // is the radiance of light coming from -Normal direction, which is what
    // we use in the PBR shader to sample irradiance.
    float3 N = normalize(input.worldPos);

    float3 irradiance = float3(0.0f, 0.0f, 0.0f);

    // TODO: add up the environment's radiance over the hemisphere around N (sampleDelta 0.1), weighted by cos(theta) * sin(theta)

    return float4(irradiance, 1.0f);
}
