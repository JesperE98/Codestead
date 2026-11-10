// The shaders of the scene (learnopengl's 7.bloom.vs / 7.bloom.fs). main.cpp compiles them at
// run time with D3DCompileFromFile.

// The texture of the draw (the wood or the container): register t0, in the descriptor table
// of root parameter 2.
Texture2D diffuseTexture : register(t0);
// The sampler: register s0, the static sampler of the root signature (linear, WRAP).
SamplerState wrapSampler : register(s0);

// Root constants set from main.cpp with SetGraphicsRoot32BitConstants (root parameter 0):
// the shaders see them as a constant buffer at register b0.
cbuffer ModelConstants : register(b0)
{
    float4x4 model;
    float4x4 normalMatrix;    // transpose(inverse(model)), computed in main.cpp
    float3 lightColor;        // only the light cubes use it (light_box.hlsl)
};

// A point light: where it is and its colour - brighter than 1.0 is fine.
struct Light
{
    float3 Position;
    float3 Color;
};

// The constant buffer at register b1 (the CBV in root parameter 1's table): the values
// that are the same for every draw of a frame.
cbuffer SceneConstantBuffer : register(b1)
{
    float4x4 view;
    float4x4 projection;
    Light lights[4];
    float3 viewPos;
};

// What the vertex shader hands on to the rasterizer and the pixel shader.
struct PSInput
{
    float4 position : SV_POSITION;
    float3 fragPos : POSITION;    // the position in world space
    float3 normal : NORMAL;
    float2 texCoord : TEXCOORD;
};

// The vertex shader: runs once per vertex.
PSInput VSMain(float4 position : POSITION, float3 normal : NORMAL, float2 texCoord : TEXCOORD)
{
    PSInput result;

    // The position in world space (only the model matrix applied), for the lighting.
    float4 worldPos = mul(position, model);
    result.fragPos = worldPos.xyz;
    result.texCoord = texCoord;

    // The normal is a direction: w = 0, so the matrix's translation does not apply.
    result.normal = normalize(mul(float4(normal, 0.0f), normalMatrix).xyz);

    // Then view and projection, as before.
    result.position = mul(mul(worldPos, view), projection);

    return result;
}

// The pixel shader: runs once per pixel a triangle covers and returns its colour (RGBA).
float4 PSMain(PSInput input) : SV_TARGET
{
    float3 color = diffuseTexture.Sample(wrapSampler, input.texCoord).rgb;
    float3 normal = normalize(input.normal);
    // ambient
    float3 ambient = 0.0f * color;
    // lighting
    float3 lighting = float3(0.0f, 0.0f, 0.0f);
    for (int i = 0; i < 4; i++)
    {
        // diffuse
        float3 lightDir = normalize(lights[i].Position - input.fragPos);
        float diff = max(dot(lightDir, normal), 0.0f);
        float3 result = lights[i].Color * diff * color;
        // attenuation (use quadratic as we have gamma correction)
        float distance = length(input.fragPos - lights[i].Position);
        result *= 1.0f / (distance * distance);
        lighting += result;
    }
    float3 result = ambient + lighting;
    return float4(result, 1.0f);
}
