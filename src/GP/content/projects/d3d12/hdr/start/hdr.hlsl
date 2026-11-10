// The shaders of the screen quad (learnopengl's 6.hdr.vs / 6.hdr.fs): they draw the
// floating-point colour buffer onto the window. main.cpp compiles them at run time with
// D3DCompileFromFile.

// The floating-point colour buffer: register t0, in the descriptor table of root parameter 2.
Texture2D hdrBuffer : register(t0);
// The sampler: register s0, the static sampler of the root signature.
SamplerState wrapSampler : register(s0);

// What the vertex shader hands on to the rasterizer and the pixel shader.
struct PSInput
{
    float4 position : SV_POSITION;
    float2 texCoord : TEXCOORD;
};

// The vertex shader: the quad's positions are in normalized device coordinates already,
// so there are no matrices (learnopengl: gl_Position = vec4(aPos, 1.0)).
PSInput VSMain(float4 position : POSITION, float2 texCoord : TEXCOORD)
{
    PSInput result;

    result.position = float4(position.xyz, 1.0f);
    result.texCoord = texCoord;

    return result;
}

// The pixel shader: maps the colour buffer's high dynamic range to the window's 0..1.
float4 PSMain(PSInput input) : SV_TARGET
{
    // TODO: read the HDR colour from hdrBuffer at texCoord and return it gamma-corrected (no tone mapping yet)
    return float4(0.0f, 0.0f, 0.0f, 1.0f);
}
