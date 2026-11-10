// The shaders of the lighting pass (learnopengl's 8.1.deferred_shading.vs / .fs, with 8.2's
// light volumes): a screen quad that lights every pixel with what the G-buffer holds for it.
// main.cpp compiles them at run time with D3DCompileFromFile.

// The G-buffer: gPosition and gNormal at registers t0 and t1 (root parameter 2's table),
// gAlbedoSpec at t2 (root parameter 3's table).
Texture2D gPosition : register(t0);
Texture2D gNormal : register(t1);
Texture2D gAlbedoSpec : register(t2);
// The sampler: register s1, the root signature's second static sampler (point, CLAMP).
SamplerState pointSampler : register(s1);

// A point light: where it is, its colour and its attenuation (the constant term is 1.0),
// and how far its light reaches (Radius, computed in main.cpp).
struct Light
{
    float3 Position;
    float3 Color;

    float Linear;
    float Quadratic;
    float Radius;
};
#define NR_LIGHTS 32

// The constant buffer at register b1 (the CBV in root parameter 1's table).
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
    float2 texCoord : TEXCOORD;
};

// The vertex shader: the quad's positions are in normalized device coordinates already.
PSInput VSMain(float4 position : POSITION, float2 texCoord : TEXCOORD)
{
    PSInput result;

    result.position = float4(position.xyz, 1.0f);
    result.texCoord = texCoord;

    return result;
}

// The pixel shader: runs once per pixel of the window.
float4 PSMain(PSInput input) : SV_TARGET
{
    // retrieve data from gbuffer
    float3 FragPos = gPosition.Sample(pointSampler, input.texCoord).rgb;
    float3 Normal = gNormal.Sample(pointSampler, input.texCoord).rgb;
    float3 Diffuse = gAlbedoSpec.Sample(pointSampler, input.texCoord).rgb;
    float Specular = gAlbedoSpec.Sample(pointSampler, input.texCoord).a;

    // then calculate lighting as usual
    float3 lighting = Diffuse * 0.1f; // hard-coded ambient component
    float3 viewDir = normalize(viewPos - FragPos);
    for (int i = 0; i < NR_LIGHTS; ++i)
    {
        // calculate distance between light source and current fragment
        float distance = length(lights[i].Position - FragPos);
        if (distance < lights[i].Radius)
        {
            // diffuse
            float3 lightDir = normalize(lights[i].Position - FragPos);
            float3 diffuse = max(dot(Normal, lightDir), 0.0f) * Diffuse * lights[i].Color;
            // specular
            float3 halfwayDir = normalize(lightDir + viewDir);
            float spec = pow(max(dot(Normal, halfwayDir), 0.0f), 16.0f);
            float3 specular = lights[i].Color * spec * Specular;
            // attenuation
            float attenuation = 1.0f / (1.0f + lights[i].Linear * distance + lights[i].Quadratic * distance * distance);
            diffuse *= attenuation;
            specular *= attenuation;
            lighting += diffuse + specular;
        }
    }
    return float4(lighting, 1.0f);
}
