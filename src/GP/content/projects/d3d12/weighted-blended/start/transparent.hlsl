// The shaders of the transparent objects (learnopengl's transparent.vs / transparent.fs): each
// fragment adds its weighted colour to accum and darkens reveal by its opacity. main.cpp
// compiles them at run time with D3DCompileFromFile.

// Root constants set from main.cpp with SetGraphicsRoot32BitConstants (root parameter 0).
cbuffer ObjectConstants : register(b0)
{
    float4x4 mvp;      // model * view * projection
    float4 color;      // material color; alpha is the opacity
};

// What the vertex shader hands on to the rasterizer and the pixel shader.
struct PSInput
{
    float4 position : SV_POSITION;
};

// The vertex shader: the quad's position into clip space.
PSInput VSMain(float3 position : POSITION)
{
    PSInput result;

    result.position = mul(float4(position, 1.0f), mvp);

    return result;
}

// The pixel shader: ordinary alpha blending - the colour with its alpha, blended over what is
// already there.
float4 PSMain(PSInput input) : SV_TARGET
{
    // TODO: the weighted blended output - the weighted colour into accum (SV_TARGET0), the opacity into reveal (SV_TARGET1)
    return color;
}
