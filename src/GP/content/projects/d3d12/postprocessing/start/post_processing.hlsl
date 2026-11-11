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
    // TODO: chaos: texture coordinates swirling with time (strength 0.3); confuse: mirrored in x and y; shake: the position wobbling with time (strength 0.01)
    result.texCoord = texCoord;

    return result;
}

// The pixel shader: the effects, each over the scene texture.
float4 PSMain(PSInput input) : SV_TARGET
{
    // TODO: chaos: the edge kernel over 9 samples; confuse: the inverted colour; shake: the blur kernel over 9 samples
    return float4(scene.Sample(wrapSampler, input.texCoord).rgb, 1.0f);
}
