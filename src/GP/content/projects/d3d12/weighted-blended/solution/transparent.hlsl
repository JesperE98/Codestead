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

// The pixel shader's two outputs: SV_TARGET0 goes to the first render target (accum),
// SV_TARGET1 to the second (reveal).
struct PSOutput
{
    float4 accum : SV_TARGET0;
    float reveal : SV_TARGET1;
};

// The pixel shader: the weighted, premultiplied colour into accum and the opacity into reveal.
PSOutput PSMain(PSInput input)
{
    PSOutput output;

    // weight function: input.position.z is the fragment's depth (0 at the near plane, 1 at
    // the far plane - learnopengl's gl_FragCoord.z)
    float weight = clamp(pow(min(1.0f, color.a * 10.0f) + 0.01f, 3.0f) * 1e8 * pow(1.0f - input.position.z * 0.9f, 3.0f), 1e-2, 3e3);

    // store pixel color accumulation
    output.accum = float4(color.rgb * color.a, color.a) * weight;

    // store pixel revealage threshold
    output.reveal = color.a;

    return output;
}
