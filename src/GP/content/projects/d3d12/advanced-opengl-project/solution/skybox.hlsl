// The skybox's shaders. main.cpp compiles them at run time with D3DCompileFromFile.

// The cube map: register t0, in the descriptor table of root parameter 2.
TextureCube skybox : register(t0);
// The sampler: register s1, the static sampler that clamps to the edge.
SamplerState clampSampler : register(s1);

// The constant buffer at register b1 (the CBV in root parameter 1's table): the
// view and projection matrices, the same for every draw of a frame.
cbuffer SceneConstantBuffer : register(b1)
{
    float4x4 view;
    float4x4 projection;
};

// What the vertex shader hands on to the rasterizer and the pixel shader.
struct PSInput
{
    float4 position : SV_POSITION;
    float3 texCoords : TEXCOORD;    // a direction, not a point on a 2D image
};

// The vertex shader: the skybox stays around the camera, however far it moves.
PSInput VSMain(float3 position : POSITION)
{
    PSInput result;

    // The direction from the centre of the cube to the vertex.
    result.texCoords = position;
    // (float3x3)view is the view matrix without its translation (learnopengl:
    // mat4(mat3(view))): the camera turns, but never gets nearer to the sky.
    float3 viewPosition = mul(position, (float3x3)view);
    float4 pos = mul(float4(viewPosition, 1.0f), projection);
    // z = w: after the perspective divide the depth is 1.0, the largest depth value.
    result.position = pos.xyww;

    return result;
}

// The pixel shader: the cube map's colour in the direction texCoords.
float4 PSMain(PSInput input) : SV_TARGET
{
    return skybox.Sample(clampSampler, input.texCoords);
}
