// The shaders of the floor. main.cpp compiles them at run time with D3DCompileFromFile.

// The floor's texture: register t0, in the descriptor table of root parameter 1.
Texture2D floorTexture : register(t0);
// The sampler: register s0, the static sampler of the root signature (WRAP: the texture
// coordinates go up to 10, so the wood repeats).
SamplerState wrapSampler : register(s0);

// The constant buffer at register b0 (the CBV in root parameter 0's table): the values
// that are the same for every draw of a frame. Every element of an array starts a new
// 16-byte row, so the lights' positions and colours are float4s (w is not used).
cbuffer SceneConstantBuffer : register(b0)
{
    float4x4 view;
    float4x4 projection;
    float4 lightPositions[4];
    float4 lightColors[4];
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

    // The floor has no model matrix: its positions are already world positions.
    result.fragPos = position.xyz;
    result.normal = normal;
    result.texCoord = texCoord;
    result.position = mul(mul(position, view), projection);

    return result;
}

// The diffuse and specular light of one point light (Blinn-Phong), weakened with the distance.
float3 BlinnPhong(float3 normal, float3 fragPos, float3 lightPos, float3 lightColor)
{
    // diffuse
    float3 lightDir = normalize(lightPos - fragPos);
    float diff = max(dot(lightDir, normal), 0.0f);
    float3 diffuse = diff * lightColor;
    // specular
    float3 viewDir = normalize(viewPos - fragPos);
    float3 halfwayDir = normalize(lightDir + viewDir);
    float spec = pow(max(dot(normal, halfwayDir), 0.0f), 64.0f);
    float3 specular = spec * lightColor;
    // simple attenuation
    float lightDistance = length(lightPos - fragPos);
    float attenuation = 1.0f / (lightDistance * lightDistance);    // quadratic: physically right, in linear space

    diffuse *= attenuation;
    specular *= attenuation;

    return diffuse + specular;
}

// The pixel shader: runs once per pixel a triangle covers and returns its colour (RGBA).
float4 PSMain(PSInput input) : SV_TARGET
{
    float3 color = floorTexture.Sample(wrapSampler, input.texCoord).rgb;
    float3 lighting = float3(0.0f, 0.0f, 0.0f);
    for (int i = 0; i < 4; ++i)
        lighting += BlinnPhong(normalize(input.normal), input.fragPos, lightPositions[i].xyz, lightColors[i].rgb);
    color *= lighting;
    // Gamma correction: the monitor shows a value v as about v to the power 2.2, so the
    // linear colour is raised to the power 1 / 2.2 first.
    float gamma = 2.2f;
    color = pow(color, float3(1.0f / gamma, 1.0f / gamma, 1.0f / gamma));
    return float4(color, 1.0f);
}
