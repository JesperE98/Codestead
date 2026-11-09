// The vertex shader of learnopengl's uniform buffer demo, for all four pipeline states.
// main.cpp compiles it at run time with D3DCompileFromFile.

// Root constants set from main.cpp with SetGraphicsRoot32BitConstants: the vertex
// shader sees them as a constant buffer at register b0.
cbuffer ModelConstants : register(b0)
{
    float4x4 model;
};

// The constant buffer at register b1 (the CBV in root parameter 1's table): the view and
// projection matrices. Every pipeline state that declares it reads the same buffer, set
// once per frame - what learnopengl's uniform block "Matrices" is for.
cbuffer SceneConstantBuffer : register(b1)
{
    float4x4 view;
    float4x4 projection;
};

// The vertex shader: only the position (the input layout's texture coordinates are not read).
float4 VSMain(float4 position : POSITION) : SV_POSITION
{
    return mul(mul(mul(position, model), view), projection);
}
