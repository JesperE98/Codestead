// The shader of the depth pass: it draws the scene from the light into the shadow map.
// main.cpp compiles it at run time with D3DCompileFromFile. Only a vertex shader: there is
// no render target, so no colour to compute, and the rasterizer writes the depth by itself
// (learnopengl's fragment shader for this pass is empty).

// Root constants (root parameter 0): the model matrix of the draw.
cbuffer ModelConstants : register(b0)
{
    float4x4 model;
    float4x4 normalMatrix;
};

// The constant buffer at register b1: this shader only needs the first three matrices of it.
cbuffer SceneConstantBuffer : register(b1)
{
    float4x4 view;
    float4x4 projection;
    float4x4 lightSpaceMatrix;
};

// The vertex shader: the position as the light's view and projection see it.
float4 VSMain(float4 position : POSITION) : SV_POSITION
{
    return mul(mul(position, model), lightSpaceMatrix);
}
