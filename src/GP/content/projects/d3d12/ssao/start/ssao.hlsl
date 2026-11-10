// The shaders of the SSAO pass (learnopengl's 9.ssao.vs / 9.ssao.fs): a screen quad that
// computes how much of every pixel's surroundings is blocked by nearby geometry. main.cpp
// compiles them at run time with D3DCompileFromFile.

// gPosition and gNormal at registers t0 and t1 (root parameter 2's table), the noise texture
// at t2 (root parameter 3's table).
Texture2D gPosition : register(t0);
Texture2D gNormal : register(t1);
Texture2D texNoise : register(t2);
// The samplers: s0 (point, CLAMP) for the G-buffer, s1 (point, WRAP) for the noise texture.
SamplerState clampSampler : register(s0);
SamplerState wrapSampler : register(s1);

// A point light (the lighting pass uses it; declared here as the buffer holds it before
// the samples).
struct Light
{
    float3 Position;
    float3 Color;

    float Linear;
    float Quadratic;
};

// The constant buffer at register b1 (the CBV in root parameter 1's table): the projection
// and the kernel's samples (float4s: every array element takes a 16-byte row; w unused).
cbuffer SceneConstantBuffer : register(b1)
{
    float4x4 view;
    float4x4 projection;
    Light light;
    float4 samples[32];
};

// parameters (you'd probably want to use them as uniforms to more easily tweak the effect)
static const int kernelSize = 32;
static const float radius = 0.5f;
static const float bias = 0.025f;

// tile noise texture over screen based on screen dimensions divided by noise size
static const float2 noiseScale = float2(800.0f / 4.0f, 600.0f / 4.0f);

// What the vertex shader hands on to the rasterizer and the pixel shader.
struct PSInput
{
    float4 position : SV_POSITION;
    float2 texCoord : TEXCOORD;
};

// The vertex shader: the quad's positions are in normalized device coordinates already.
PSInput VSMain(float4 position : POSITION, float2 texCoord : TEXCOORD)
{
    PSInput result;

    result.position = float4(position.xyz, 1.0f);
    result.texCoord = texCoord;

    return result;
}

// The pixel shader: returns the occlusion factor (1.0: nothing occludes) - one channel.
float PSMain(PSInput input) : SV_TARGET
{
    // TODO: the occlusion factor: build a TBN matrix from the normal and a random vector of the noise texture, then for each of the kernelSize samples move it into view space around fragPos (times radius), project it to texture coordinates, read the depth (z) of gPosition there and count it as occluding (with the range check) if it is at least bias in front of the sample - return 1.0 minus the occluding fraction
    return 1.0f;
}
