// The shaders of the blur (learnopengl's 9.ssao.vs / 9.ssao_blur.fs): a screen quad that
// averages every pixel's 4 x 4 neighbourhood of the SSAO texture - the noise texture's
// pattern disappears. main.cpp compiles them at run time with D3DCompileFromFile.

// The SSAO texture: register t0 (root parameter 2's table).
Texture2D ssaoInput : register(t0);
// The sampler: s0 (point, CLAMP).
SamplerState clampSampler : register(s0);

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

// The pixel shader: the mean of 16 texels around the pixel.
float PSMain(PSInput input) : SV_TARGET
{
    float width, height;
    ssaoInput.GetDimensions(width, height);
    float2 texelSize = 1.0f / float2(width, height);
    float result = 0.0f;
    for (int x = -2; x < 2; ++x)
    {
        for (int y = -2; y < 2; ++y)
        {
            float2 offset = float2(float(x), float(y)) * texelSize;
            result += ssaoInput.Sample(clampSampler, input.texCoord + offset).r;
        }
    }
    return result / (4.0f * 4.0f);
}
