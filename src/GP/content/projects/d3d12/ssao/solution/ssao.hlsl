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
    // get input for SSAO algorithm
    float3 fragPos = gPosition.Sample(clampSampler, input.texCoord).xyz;
    float3 normal = normalize(gNormal.Sample(clampSampler, input.texCoord).rgb);
    float3 randomVec = normalize(texNoise.Sample(wrapSampler, input.texCoord * noiseScale).xyz);
    // create TBN change-of-basis matrix: from tangent-space to view-space (its rows are the
    // tangent, the bitangent and the normal, so mul(v, TBN) = v.x * T + v.y * B + v.z * N)
    float3 tangent = normalize(randomVec - normal * dot(randomVec, normal));
    float3 bitangent = cross(normal, tangent);
    float3x3 TBN = float3x3(tangent, bitangent, normal);
    // iterate over the sample kernel and calculate occlusion factor
    float occlusion = 0.0f;
    for (int i = 0; i < kernelSize; ++i)
    {
        // get sample position
        float3 samplePos = mul(samples[i].xyz, TBN); // from tangent to view-space
        samplePos = fragPos + samplePos * radius;

        // project sample position (to sample texture) (to get position on screen/texture)
        float4 offset = float4(samplePos, 1.0f);
        offset = mul(offset, projection); // from view to clip-space
        offset.xyz /= offset.w; // perspective divide
        // transform to range 0.0 - 1.0: x as in OpenGL, y flipped - texture coordinate v
        // points down, normalized device y up
        offset.xy = float2(offset.x * 0.5f + 0.5f, -offset.y * 0.5f + 0.5f);

        // get sample depth
        float sampleDepth = gPosition.Sample(clampSampler, offset.xy).z; // get depth value of kernel sample

        // range check & accumulate
        float rangeCheck = smoothstep(0.0f, 1.0f, radius / abs(fragPos.z - sampleDepth));
        occlusion += (sampleDepth >= samplePos.z + bias ? 1.0f : 0.0f) * rangeCheck;
    }
    occlusion = 1.0f - (occlusion / kernelSize);

    return occlusion;
}
