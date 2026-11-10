// The shaders of forward rendering: every box is lit by all 32 lights right away, while it is
// drawn (the lighting of learnopengl's 8.1.deferred_shading.fs, in the boxes' own pixel
// shader). main.cpp compiles them at run time with D3DCompileFromFile.

// The box's maps: registers t0 and t1, in the descriptor table of root parameter 2 (learnopengl:
// texture_diffuse1 and texture_specular1).
Texture2D texture_diffuse1 : register(t0);
Texture2D texture_specular1 : register(t1);
// The sampler: register s0, the static sampler of the root signature (linear, WRAP).
SamplerState wrapSampler : register(s0);

// Root constants set from main.cpp with SetGraphicsRoot32BitConstants (root parameter 0):
// the shaders see them as a constant buffer at register b0.
cbuffer ModelConstants : register(b0)
{
    float4x4 model;
    float4x4 normalMatrix;    // transpose(inverse(model)), computed in main.cpp
    float3 lightColor;        // only the light cubes use it
};

// A point light: where it is, its colour and its attenuation (the constant term is 1.0).
struct Light
{
    float3 Position;
    float3 Color;

    float Linear;
    float Quadratic;
};
#define NR_LIGHTS 32

// The constant buffer at register b1 (the CBV in root parameter 1's table): the values
// that are the same for every draw of a frame.
cbuffer SceneConstantBuffer : register(b1)
{
    float4x4 view;
    float4x4 projection;
    Light lights[NR_LIGHTS];
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

    float4 worldPos = mul(position, model);
    result.fragPos = worldPos.xyz;
    result.texCoord = texCoord;

    // The normal is a direction: w = 0, so the matrix's translation does not apply.
    result.normal = mul(float4(normal, 0.0f), normalMatrix).xyz;

    result.position = mul(mul(worldPos, view), projection);

    return result;
}

// The pixel shader: runs once per pixel a box covers and loops over all the lights.
float4 PSMain(PSInput input) : SV_TARGET
{
    // the surface's data, straight from the vertex shader and the textures
    float3 normal = normalize(input.normal);
    float3 Diffuse = texture_diffuse1.Sample(wrapSampler, input.texCoord).rgb;
    float Specular = texture_specular1.Sample(wrapSampler, input.texCoord).r;

    // then calculate lighting: every fragment loops over all the lights
    float3 lighting = Diffuse * 0.1f; // hard-coded ambient component
    float3 viewDir = normalize(viewPos - input.fragPos);
    for (int i = 0; i < NR_LIGHTS; ++i)
    {
        // diffuse
        float3 lightDir = normalize(lights[i].Position - input.fragPos);
        float3 diffuse = max(dot(normal, lightDir), 0.0f) * Diffuse * lights[i].Color;
        // specular
        float3 halfwayDir = normalize(lightDir + viewDir);
        float spec = pow(max(dot(normal, halfwayDir), 0.0f), 16.0f);
        float3 specular = lights[i].Color * spec * Specular;
        // attenuation
        float distance = length(lights[i].Position - input.fragPos);
        float attenuation = 1.0f / (1.0f + lights[i].Linear * distance + lights[i].Quadratic * distance * distance);
        diffuse *= attenuation;
        specular *= attenuation;
        lighting += diffuse + specular;
    }
    return float4(lighting, 1.0f);
}
