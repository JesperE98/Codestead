// The shaders of the background (learnopengl's background.vs / background.fs): the cube
// around the camera, showing the environment cube map. main.cpp compiles them at run time
// with D3DCompileFromFile.

// The cube map: register t0, in the descriptor table of root parameter 2.
TextureCube environmentMap : register(t0);
// The sampler: register s0, the static sampler of the root signature (linear, CLAMP).
SamplerState clampSampler : register(s0);

// The constant buffer at register b1 (the CBV in root parameter 1's table): the camera's
// view and projection matrices come first in it.
cbuffer SceneConstantBuffer : register(b1)
{
    float4x4 view;
    float4x4 projection;
};

// What the vertex shader hands on to the rasterizer and the pixel shader.
struct PSInput
{
    float4 position : SV_POSITION;
    float3 worldPos : POSITION;    // the position on the cube: a direction into the sky
};

// The vertex shader: the background stays around the camera, however far it moves.
PSInput VSMain(float3 position : POSITION)
{
    PSInput result;

    result.worldPos = position;

    // TODO: keep only the view matrix's rotation and give the cube the largest depth (z = w, so the depth is 1.0)
    result.position = float4(0.0f, 0.0f, 0.0f, 1.0f);

    return result;
}

// The pixel shader: the cube map's colour in the direction worldPos.
float4 PSMain(PSInput input) : SV_TARGET
{
    // TODO: sample the environment map in the direction input.worldPos, tone map and gamma correct the colour
    return float4(0.0f, 0.0f, 0.0f, 1.0f);
}
