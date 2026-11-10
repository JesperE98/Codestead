// The shaders of the composite pass (learnopengl's composite.vs / composite.fs): a screen quad
// that turns accum and reveal into one colour and its opacity, blended onto the opaque
// texture. main.cpp compiles them at run time with D3DCompileFromFile.

// What the vertex shader hands on to the rasterizer and the pixel shader.
struct PSInput
{
    float4 position : SV_POSITION;
};

// The vertex shader: the quad's positions are in normalized device coordinates already.
PSInput VSMain(float3 position : POSITION)
{
    PSInput result;

    result.position = float4(position, 1.0f);

    return result;
}

// color accumulation buffer: register t0, the first SRV of root parameter 1's table
Texture2D accum : register(t0);

// revealage threshold buffer: register t1, the second SRV
Texture2D reveal : register(t1);

// epsilon number
static const float EPSILON = 0.00001f;

// calculate floating point numbers equality accurately
bool isApproximatelyEqual(float a, float b)
{
    return abs(a - b) <= (abs(a) < abs(b) ? abs(b) : abs(a)) * EPSILON;
}

// get the max value between three values
float max3(float3 v)
{
    return max(max(v.x, v.y), v.z);
}

// The pixel shader: the average colour of the transparent fragments, with alpha = how much
// of what is behind them they cover.
float4 PSMain(PSInput input) : SV_TARGET
{
    // fragment coordination: the pixel's column and row (SV_POSITION's x and y)
    int2 coords = int2(input.position.xy);

    // fragment revealage: Load reads one texel without filtering (learnopengl's texelFetch)
    float revealage = reveal.Load(int3(coords, 0)).r;

    // save the blending and color texture fetch cost if there is not a transparent fragment
    if (isApproximatelyEqual(revealage, 1.0f))
        discard;

    // fragment color
    float4 accumulation = accum.Load(int3(coords, 0));

    // suppress overflow
    if (isinf(max3(abs(accumulation.rgb))))
        accumulation.rgb = accumulation.aaa;

    // prevent floating point precision bug
    float3 average_color = accumulation.rgb / max(accumulation.a, EPSILON);

    // blend pixels
    return float4(average_color, 1.0f - revealage);
}
