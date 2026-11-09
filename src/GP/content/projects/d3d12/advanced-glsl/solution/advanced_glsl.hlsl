// The shaders. main.cpp compiles them at run time with D3DCompileFromFile.

// The textures of the draw: registers t0 and t1, in the descriptor table of root parameter 2.
Texture2D frontTexture : register(t0);
Texture2D backTexture : register(t1);
// The sampler: register s0, the static sampler of the root signature (WRAP: the floor's
// texture coordinates go up to 2, so its texture repeats).
SamplerState wrapSampler : register(s0);

// Root constants set from main.cpp with SetGraphicsRoot32BitConstants: the vertex
// shader sees them as a constant buffer at register b0.
cbuffer ModelConstants : register(b0)
{
    float4x4 model;
};

// The constant buffer at register b1 (the CBV in root parameter 1's table): the
// view and projection matrices, the same for every draw of a frame.
cbuffer SceneConstantBuffer : register(b1)
{
    float4x4 view;
    float4x4 projection;
};

// What the vertex shader hands on to the pixel shader, as one block: a struct is HLSL's
// interface block (GLSL: out VS_OUT { ... } vs_out; / in VS_OUT { ... } fs_in;). The
// semantics (TEXCOORD ...) match the fields of the two stages.
struct VS_OUT
{
    float4 position : SV_POSITION;
    float2 texCoord : TEXCOORD;
};

// The vertex shader: runs once per vertex.
VS_OUT VSMain(float4 position : POSITION, float2 texCoord : TEXCOORD)
{
    VS_OUT vs_out;

    // model, then view, then projection (GLSL: projection * view * model * position).
    vs_out.position = mul(mul(mul(position, model), view), projection);
    vs_out.texCoord = texCoord;

    return vs_out;
}

// The pixel shader: runs once per pixel a triangle covers and returns its colour (RGBA).
// SV_IsFrontFace: true for the front faces (counter-clockwise on the screen, the PSO's
// FrontCounterClockwise), false for the back faces - GLSL's gl_FrontFacing.
float4 PSMain(VS_OUT fs_in, bool isFrontFace : SV_IsFrontFace) : SV_TARGET
{
    if (isFrontFace)
        return frontTexture.Sample(wrapSampler, fs_in.texCoord);
    else
        return backTexture.Sample(wrapSampler, fs_in.texCoord);
}
