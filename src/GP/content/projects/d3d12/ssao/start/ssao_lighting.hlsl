// The shaders of the lighting pass (learnopengl's 9.ssao.vs / 9.ssao_lighting.fs): a screen
// quad that lights every pixel from the G-buffer, its ambient light darkened by the
// ambient occlusion. main.cpp compiles them at run time with D3DCompileFromFile.

// The G-buffer: gPosition and gNormal at registers t0 and t1 (root parameter 2's table),
// gAlbedo at t2 (root parameter 3's table).
Texture2D gPosition : register(t0);
Texture2D gNormal : register(t1);
Texture2D gAlbedo : register(t2);
// The sampler: s0 (point, CLAMP).
SamplerState clampSampler : register(s0);

// A point light: where it is (in view space), its colour and its attenuation (the constant
// term is 1.0).
struct Light
{
    float3 Position;
    float3 Color;

    float Linear;
    float Quadratic;
};

// The constant buffer at register b1 (the CBV in root parameter 1's table): the lighting
// pass needs the light, so the declaration stops after it.
cbuffer SceneConstantBuffer : register(b1)
{
    float4x4 view;
    float4x4 projection;
    Light light;
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
    float3 FragPos = gPosition.Sample(clampSampler, input.texCoord).rgb;
    float3 Normal = gNormal.Sample(clampSampler, input.texCoord).rgb;
    float3 Diffuse = gAlbedo.Sample(clampSampler, input.texCoord).rgb;

    // then calculate lighting as usual
    float3 ambient = 0.3f * Diffuse;
    float3 lighting = ambient;
    float3 viewDir = normalize(-FragPos); // viewpos is (0.0.0)
    // diffuse
    float3 lightDir = normalize(light.Position - FragPos);
    float3 diffuse = max(dot(Normal, lightDir), 0.0f) * Diffuse * light.Color;
    // specular
    float3 halfwayDir = normalize(lightDir + viewDir);
    float spec = pow(max(dot(Normal, halfwayDir), 0.0f), 8.0f);
    float3 specular = light.Color * spec;
    // attenuation
    float distance = length(light.Position - FragPos);
    float attenuation = 1.0f / (1.0f + light.Linear * distance + light.Quadratic * distance * distance);
    diffuse *= attenuation;
    specular *= attenuation;
    lighting += diffuse + specular;

    return float4(lighting, 1.0f);
}
