// The shaders of the animated model. main.cpp compiles them at run time with D3DCompileFromFile.

// Root constants set from main.cpp with SetGraphicsRoot32BitConstants (root parameter 0):
// the vertex shader sees them as a constant buffer at register b0.
cbuffer ModelConstants : register(b0)
{
    float4x4 model;
};

static const int MAX_BONES = 100;
static const int MAX_BONE_INFLUENCE = 4;

// The constant buffer at register b1 (the CBV in root parameter 1's table): the view and
// projection matrices and the bones' final matrices, the same for every draw of a frame.
cbuffer SceneConstantBuffer : register(b1)
{
    float4x4 view;
    float4x4 projection;
    float4x4 finalBonesMatrices[MAX_BONES];
};

// The mesh's diffuse map: register t0 (learnopengl's texture_diffuse1).
Texture2D texture_diffuse1 : register(t0);
// The sampler: register s0, the static sampler of the root signature.
SamplerState wrapSampler : register(s0);

// What the vertex shader hands on to the rasterizer and the pixel shader.
struct PSInput
{
    float4 position : SV_POSITION;
    float2 texCoords : TEXCOORD;
};

// The vertex shader: the vertex's bones (BLENDINDICES, -1 = none) and how much each one
// moves it (BLENDWEIGHT). The normal is not used.
PSInput VSMain(float3 pos : POSITION, float3 norm : NORMAL, float2 tex : TEXCOORD, int4 boneIds : BLENDINDICES, float4 weights : BLENDWEIGHT)
{
    PSInput result;

    // the position as the weighted sum of where each of the vertex's bones moves it
    float4 totalPosition = float4(0.0f, 0.0f, 0.0f, 0.0f);
    for (int i = 0; i < MAX_BONE_INFLUENCE; i++)
    {
        if (boneIds[i] == -1)
            continue;
        if (boneIds[i] >= MAX_BONES)
        {
            totalPosition = float4(pos, 1.0f);
            break;
        }
        float4 localPosition = mul(float4(pos, 1.0f), finalBonesMatrices[boneIds[i]]);
        totalPosition += localPosition * weights[i];
    }

    float4x4 viewModel = mul(model, view);
    result.position = mul(mul(totalPosition, viewModel), projection);
    result.texCoords = tex;

    return result;
}

float4 PSMain(PSInput input) : SV_TARGET
{
    return texture_diffuse1.Sample(wrapSampler, input.texCoords);
}
