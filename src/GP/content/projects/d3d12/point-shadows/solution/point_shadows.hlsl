// The shaders of the scene, drawn from the camera. main.cpp compiles them at run time with D3DCompileFromFile.

// The textures, in the descriptor table of root parameter 2: the wood (t0) and the depth
// cubemap (t1) - the distance from the light to the closest surface in every direction,
// divided by far_plane. A TextureCube is read with a direction instead of a position.
Texture2D diffuseTexture : register(t0);
TextureCube depthMap : register(t1);
// The samplers, static samplers of the root signature: s0 for the wood (linear, WRAP),
// s1 for the depth cubemap (no filtering).
SamplerState wrapSampler : register(s0);
SamplerState shadowSampler : register(s1);

// Root constants set from main.cpp with SetGraphicsRoot32BitConstants (root parameter 0):
// the shaders see them as a constant buffer at register b0.
cbuffer ModelConstants : register(b0)
{
    float4x4 model;
    float4x4 normalMatrix;    // transpose(inverse(model)), computed in main.cpp
    bool reverseNormals;      // true for the room: it is lit from the inside
};

// The constant buffer at register b1 (the CBV in root parameter 1's table): the values
// that are the same for every draw of a frame.
cbuffer SceneConstantBuffer : register(b1)
{
    float4x4 view;
    float4x4 projection;
    float4x4 shadowMatrices[6];    // the light's view and projection, one per cube face
    float3 viewPos;
    float far_plane;
    float3 lightPos;
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
    // The normal is a direction: w = 0, so the matrix's translation does not apply.
    if (reverseNormals) // a slight hack to make sure the outer large cube displays lighting from the 'inside' instead of the default 'outside'.
        result.normal = mul(float4(-normal, 0.0f), normalMatrix).xyz;
    else
        result.normal = mul(float4(normal, 0.0f), normalMatrix).xyz;
    result.texCoord = texCoord;

    // Then view and projection, as before.
    result.position = mul(mul(worldPos, view), projection);

    return result;
}

// array of offset direction for sampling
static const float3 gridSamplingDisk[20] =
{
    float3(1, 1,  1), float3( 1, -1,  1), float3(-1, -1,  1), float3(-1, 1,  1),
    float3(1, 1, -1), float3( 1, -1, -1), float3(-1, -1, -1), float3(-1, 1, -1),
    float3(1, 1,  0), float3( 1, -1,  0), float3(-1, -1,  0), float3(-1, 1,  0),
    float3(1, 0,  1), float3(-1,  0,  1), float3( 1,  0, -1), float3(-1, 0, -1),
    float3(0, 1,  1), float3( 0, -1,  1), float3( 0, -1, -1), float3( 0, 1, -1)
};

// How much of the fragment is in shadow: 0.0 (lit) to 1.0 (in shadow), the average of 20
// tests around the direction to the fragment - soft shadow edges (PCF).
float ShadowCalculation(float3 fragPos)
{
    // get vector between fragment position and light position
    float3 fragToLight = fragPos - lightPos;
    // now get current linear depth as the length between the fragment and light position
    float currentDepth = length(fragToLight);
    // PCF: sample the depth cubemap around fragToLight, in 20 directions spread over a disk
    // that grows with the distance to the camera (farther away the edges can be softer)
    float shadow = 0.0f;
    float bias = 0.15f;
    int samples = 20;
    float viewDistance = length(viewPos - fragPos);
    float diskRadius = (1.0f + (viewDistance / far_plane)) / 25.0f;
    for (int i = 0; i < samples; ++i)
    {
        float closestDepth = depthMap.Sample(shadowSampler, fragToLight + gridSamplingDisk[i] * diskRadius).r;
        closestDepth *= far_plane;   // undo mapping [0;1]
        if (currentDepth - bias > closestDepth)
            shadow += 1.0f;
    }
    shadow /= float(samples);

    return shadow;
}

// The pixel shader: runs once per pixel a triangle covers and returns its colour (RGBA).
float4 PSMain(PSInput input) : SV_TARGET
{
    float3 color = diffuseTexture.Sample(wrapSampler, input.texCoord).rgb;
    float3 normal = normalize(input.normal);
    float3 lightColor = float3(0.3f, 0.3f, 0.3f);
    // ambient
    float3 ambient = 0.3f * lightColor;
    // diffuse
    float3 lightDir = normalize(lightPos - input.fragPos);
    float diff = max(dot(lightDir, normal), 0.0f);
    float3 diffuse = diff * lightColor;
    // specular
    float3 viewDir = normalize(viewPos - input.fragPos);
    float3 halfwayDir = normalize(lightDir + viewDir);
    float spec = pow(max(dot(normal, halfwayDir), 0.0f), 64.0f);
    float3 specular = spec * lightColor;
    // calculate shadow
    float shadow = ShadowCalculation(input.fragPos);
    float3 lighting = (ambient + (1.0f - shadow) * (diffuse + specular)) * color;

    return float4(lighting, 1.0f);
}
