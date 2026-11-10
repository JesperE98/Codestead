// The shaders of the cubes. main.cpp compiles them at run time with D3DCompileFromFile.

// The cube map: register t0, in the descriptor table of root parameter 2.
TextureCube skybox : register(t0);
// The sampler: register s1, the static sampler that clamps to the edge.
SamplerState clampSampler : register(s1);

// Root constants set from main.cpp with SetGraphicsRoot32BitConstants: the vertex
// shader sees them as a constant buffer at register b0.
cbuffer ModelConstants : register(b0)
{
    float4x4 model;
    float4x4 normalMatrix;    // transpose(inverse(model)), computed in main.cpp
};

// The constant buffer at register b1 (the CBV in root parameter 1's table): the values
// that are the same for every draw of a frame.
cbuffer SceneConstantBuffer : register(b1)
{
    float4x4 view;
    float4x4 projection;
    float3 cameraPos;
};

// What the vertex shader hands on to the rasterizer and the pixel shader.
struct PSInput
{
    float4 position : SV_POSITION;
    float3 normal : NORMAL;
    float3 fragPos : POSITION;    // the position in world space
};

// The vertex shader: runs once per vertex.
PSInput VSMain(float4 position : POSITION, float3 normal : NORMAL)
{
    PSInput result;

    float4 worldPosition = mul(position, model);
    result.position = mul(mul(worldPosition, view), projection);
    result.fragPos = worldPosition.xyz;
    result.normal = mul(float4(normal, 0.0f), normalMatrix).xyz;

    return result;
}

// The pixel shader: runs once per pixel a triangle covers and returns its colour (RGBA).
float4 PSMain(PSInput input) : SV_TARGET
{
    // The direction from the camera to the pixel, bent where it enters the glass: the
    // cube map is sampled in the refracted direction.
    float ratio = 1.00f / 1.52f;    // from air (1.00) into glass (1.52)
    float3 I = normalize(input.fragPos - cameraPos);
    float3 R = refract(I, normalize(input.normal), ratio);
    return float4(skybox.Sample(clampSampler, R).rgb, 1.0f);
}
