// The shaders of the scene, drawn from the camera. main.cpp compiles them at run time with D3DCompileFromFile.

// The texture, in the descriptor table of root parameter 2: the wood (t0).
Texture2D diffuseTexture : register(t0);
// The sampler, a static sampler of the root signature: s0 for the wood (linear, WRAP).
SamplerState wrapSampler : register(s0);

// Root constants set from main.cpp with SetGraphicsRoot32BitConstants (root parameter 0):
// the shaders see them as a constant buffer at register b0.
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
    float3 viewPos;
    float3 lightDir;    // the direction towards the light
};

// What the vertex shader hands on to the rasterizer and the pixel shader.
struct PSInput
{
    float4 position : SV_POSITION;
    float3 fragPos : POSITION;    // the position in world space
    float3 normal : NORMAL;
    float2 texCoord : TEXCOORD0;
};

// The vertex shader: runs once per vertex.
PSInput VSMain(float4 position : POSITION, float3 normal : NORMAL, float2 texCoord : TEXCOORD)
{
    PSInput result;

    // The position in world space (only the model matrix applied), for the lighting.
    float4 worldPos = mul(position, model);
    result.fragPos = worldPos.xyz;
    // The normal is a direction: w = 0, so the matrix's translation does not apply.
    result.normal = mul(float4(normal, 0.0f), normalMatrix).xyz;
    result.texCoord = texCoord;

    // Then view and projection, as before.
    result.position = mul(mul(worldPos, view), projection);

    return result;
}

// TODO: the cascades - the fragment's cascade (CascadeLayer)

// TODO: ShadowCalculation// TODO: ShadowCalculation - pick the fragment's cascade, look it up in that layer of the shadow maps

// The pixel shader: runs once per pixel// The pixel shader: runs once per pixel a triangle covers and returns its colour (RGBA).
float4 PSMain(PSInput input) : SV_TARGET
{
    float3 color = diffuseTexture.Sample(wrapSampler, input.texCoord).rgb;
    float3 normal = normalize(input.normal);
    float3 lightColor = float3(0.3f, 0.3f, 0.3f);
    // ambient
    float3 ambient = 0.3f * lightColor;
    // diffuse
    float diff = max(dot(lightDir, normal), 0.0f);
    float3 diffuse = diff * lightColor;
    // specular
    float3 viewDir = normalize(viewPos - input.fragPos);
    float3 halfwayDir = normalize(lightDir + viewDir);
    float spec = pow(max(dot(normal, halfwayDir), 0.0f), 64.0f);
    float3 specular = spec * lightColor;
    // calculate shadow
    float shadow = 0.0f;    // TODO: 1.0 in shadow, 0.0 in the light (ShadowCalculation)
    float3 lighting = (ambient + (1.0f - shadow) * (diffuse + specular)) * color;

    return float4(lighting, 1.0f);
}
