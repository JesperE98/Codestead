// The postprocessing shaders. main.cpp compiles them at run time with D3DCompileFromFile.

// The game's picture (resolved from the multisampled render target): register t0, in the
// descriptor table of root parameter 2.
Texture2D scene : register(t0);
// The sampler: register s0, the static sampler of the root signature (linear, wrapping).
SamplerState wrapSampler : register(s0);

// Root constants set from main.cpp with SetGraphicsRoot32BitConstants before the quad: the
// time and the effects (learnopengl's bool uniforms, as ints).
cbuffer PostProcessingConstants : register(b0)
{
    float time;
    int confuse;
    int chaos;
    int shake;
};

// The 9 sample offsets and the two kernels. learnopengl sets them once from the program
// (glUniform2fv, glUniform1iv, glUniform1fv); they never change, so here they are constants
// of the shader. v points down in Direct3D: the row above has the offset -offset.
static const float offset = 1.0f / 300.0f;
static const float2 offsets[9] = {
    float2(-offset, -offset),  // top-left
    float2( 0.0f,   -offset),  // top-center
    float2( offset, -offset),  // top-right
    float2(-offset,  0.0f),    // center-left
    float2( 0.0f,    0.0f),    // center-center
    float2( offset,  0.0f),    // center - right
    float2(-offset,  offset),  // bottom-left
    float2( 0.0f,    offset),  // bottom-center
    float2( offset,  offset)   // bottom-right
};
static const int edge_kernel[9] = {
    -1, -1, -1,
    -1,  8, -1,
    -1, -1, -1
};
static const float blur_kernel[9] = {
    1.0f / 16.0f, 2.0f / 16.0f, 1.0f / 16.0f,
    2.0f / 16.0f, 4.0f / 16.0f, 2.0f / 16.0f,
    1.0f / 16.0f, 2.0f / 16.0f, 1.0f / 16.0f
};

// What the vertex shader hands on to the rasterizer and the pixel shader.
struct PSInput
{
    float4 position : SV_POSITION;
    float2 texCoord : TEXCOORD;
};

// The vertex shader: a corner of the screen quad (already in normalized device coordinates).
PSInput VSMain(float2 position : POSITION, float2 texCoord : TEXCOORD)
{
    PSInput result;

    result.position = float4(position, 0.0f, 1.0f);
    if (chaos)
    {
        float strength = 0.3f;
        // v points down in Direct3D: minus moves the picture the way learnopengl's plus does
        float2 pos = float2(texCoord.x + sin(time) * strength, texCoord.y - cos(time) * strength);
        result.texCoord = pos;
    }
    else if (confuse)
    {
        result.texCoord = float2(1.0f - texCoord.x, 1.0f - texCoord.y);
    }
    else
    {
        result.texCoord = texCoord;
    }
    if (shake)
    {
        float strength = 0.01f;
        result.position.x += cos(time * 10.0f) * strength;
        result.position.y += cos(time * 15.0f) * strength;
    }

    return result;
}

// The pixel shader: the effects, each over the scene texture.
float4 PSMain(PSInput input) : SV_TARGET
{
    float4 color = float4(0.0f, 0.0f, 0.0f, 0.0f);

    float3 samples[9];    // learnopengl's "sample" is a keyword in HLSL
    // sample from texture offsets if using convolution matrix
    if (chaos || shake)
        for (int i = 0; i < 9; i++)
            samples[i] = scene.Sample(wrapSampler, input.texCoord + offsets[i]).rgb;

    // process effects
    if (chaos)
    {
        for (int i = 0; i < 9; i++)
            color += float4(samples[i] * edge_kernel[i], 0.0f);
        color.a = 1.0f;
    }
    else if (confuse)
    {
        color = float4(1.0f - scene.Sample(wrapSampler, input.texCoord).rgb, 1.0f);
    }
    else if (shake)
    {
        for (int i = 0; i < 9; i++)
            color += float4(samples[i] * blur_kernel[i], 0.0f);
        color.a = 1.0f;
    }
    else
    {
        // alpha 1: learnopengl's texture is GL_RGB (alpha 1); this one has alpha, which the
        // sprites' blending lowers at their soft edges - the quad would blend them with black
        color = float4(scene.Sample(wrapSampler, input.texCoord).rgb, 1.0f);
    }
    return color;
}
