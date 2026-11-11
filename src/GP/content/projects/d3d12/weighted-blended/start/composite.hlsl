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

// The pixel shader.
float4 PSMain(PSInput input) : SV_TARGET
{
    // TODO: the composite pass - read accum and reveal and blend their average colour over the opaque image
    return float4(0.0f, 0.0f, 0.0f, 0.0f);
}
