// The shaders of the lit objects (the containers). main.cpp compiles them at run time with D3DCompileFromFile.

// Root constants set from main.cpp with SetGraphicsRoot32BitConstants (root parameter 0):
// the shaders see them as a constant buffer at register b0.
cbuffer ModelConstants : register(b0)
{
    float4x4 model;
    float4x4 normalMatrix;    // transpose(inverse(model)), computed in main.cpp
};

// The material's diffuse colour and specular strength are textures: registers t0 and t1,
// in the descriptor table of root parameter 2. (Textures cannot be members of a cbuffer
// or its structs.)
Texture2D diffuseMap : register(t0);
Texture2D specularMap : register(t1);
// The sampler: register s0, the static sampler of the root signature.
SamplerState wrapSampler : register(s0);

// The rest of the material.
struct Material
{
    float shininess;
};

struct DirLight
{
    float3 direction;

    float3 ambient;
    float3 diffuse;
    float3 specular;
};

// (linear is a word of HLSL: the attenuation terms are called constantTerm, linearTerm
// and quadraticTerm.)
struct PointLight
{
    float3 position;

    float constantTerm;
    float linearTerm;
    float quadraticTerm;

    float3 ambient;
    float3 diffuse;
    float3 specular;
};

struct SpotLight
{
    float3 position;
    float3 direction;
    float cutOff;
    float outerCutOff;

    float constantTerm;
    float linearTerm;
    float quadraticTerm;

    float3 ambient;
    float3 diffuse;
    float3 specular;
};

#define NR_POINT_LIGHTS 4

// The constant buffer at register b1 (the CBV in root parameter 1's table): the values
// that are the same for every draw of a frame.
cbuffer SceneConstantBuffer : register(b1)
{
    float4x4 view;
    float4x4 projection;
    float3 viewPos;
    Material material;
    DirLight dirLight;
    PointLight pointLights[NR_POINT_LIGHTS];
    SpotLight spotLight;
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
    result.normal = mul(float4(normal, 0.0f), normalMatrix).xyz;
    result.texCoord = texCoord;

    // Then view and projection, as before.
    result.position = mul(mul(worldPos, view), projection);

    return result;
}

// calculates the color when using a directional light.
float3 CalcDirLight(DirLight light, float3 normal, float3 viewDir, float2 texCoord)
{
    float3 lightDir = normalize(-light.direction);
    // diffuse shading
    float diff = max(dot(normal, lightDir), 0.0f);
    // specular shading
    float3 reflectDir = reflect(-lightDir, normal);
    float spec = pow(max(dot(viewDir, reflectDir), 0.0f), material.shininess);
    // combine results
    float3 ambient = light.ambient * diffuseMap.Sample(wrapSampler, texCoord).rgb;
    float3 diffuse = light.diffuse * diff * diffuseMap.Sample(wrapSampler, texCoord).rgb;
    float3 specular = light.specular * spec * specularMap.Sample(wrapSampler, texCoord).rgb;
    return (ambient + diffuse + specular);
}

// calculates the color when using a point light.
float3 CalcPointLight(PointLight light, float3 normal, float3 fragPos, float3 viewDir, float2 texCoord)
{
    float3 lightDir = normalize(light.position - fragPos);
    // diffuse shading
    float diff = max(dot(normal, lightDir), 0.0f);
    // specular shading
    float3 reflectDir = reflect(-lightDir, normal);
    float spec = pow(max(dot(viewDir, reflectDir), 0.0f), material.shininess);
    // attenuation (dist: distance is the name of an HLSL function)
    float dist = length(light.position - fragPos);
    float attenuation = 1.0f / (light.constantTerm + light.linearTerm * dist + light.quadraticTerm * (dist * dist));
    // combine results
    float3 ambient = light.ambient * diffuseMap.Sample(wrapSampler, texCoord).rgb;
    float3 diffuse = light.diffuse * diff * diffuseMap.Sample(wrapSampler, texCoord).rgb;
    float3 specular = light.specular * spec * specularMap.Sample(wrapSampler, texCoord).rgb;
    ambient *= attenuation;
    diffuse *= attenuation;
    specular *= attenuation;
    return (ambient + diffuse + specular);
}

// calculates the color when using a spot light.
float3 CalcSpotLight(SpotLight light, float3 normal, float3 fragPos, float3 viewDir, float2 texCoord)
{
    float3 lightDir = normalize(light.position - fragPos);
    // diffuse shading
    float diff = max(dot(normal, lightDir), 0.0f);
    // specular shading
    float3 reflectDir = reflect(-lightDir, normal);
    float spec = pow(max(dot(viewDir, reflectDir), 0.0f), material.shininess);
    // attenuation (dist: distance is the name of an HLSL function)
    float dist = length(light.position - fragPos);
    float attenuation = 1.0f / (light.constantTerm + light.linearTerm * dist + light.quadraticTerm * (dist * dist));
    // spotlight intensity
    float theta = dot(lightDir, normalize(-light.direction));
    float epsilon = light.cutOff - light.outerCutOff;
    float intensity = clamp((theta - light.outerCutOff) / epsilon, 0.0f, 1.0f);
    // combine results
    float3 ambient = light.ambient * diffuseMap.Sample(wrapSampler, texCoord).rgb;
    float3 diffuse = light.diffuse * diff * diffuseMap.Sample(wrapSampler, texCoord).rgb;
    float3 specular = light.specular * spec * specularMap.Sample(wrapSampler, texCoord).rgb;
    ambient *= attenuation * intensity;
    diffuse *= attenuation * intensity;
    specular *= attenuation * intensity;
    return (ambient + diffuse + specular);
}

// The pixel shader: runs once per pixel a triangle covers and returns its colour (RGBA).
float4 PSMain(PSInput input) : SV_TARGET
{
    // properties
    float3 norm = normalize(input.normal);
    float3 viewDir = normalize(viewPos - input.fragPos);

    // our lighting is set up in 3 phases: directional, point lights and an optional flashlight.
    // for each phase, a calculate function returns the colour that light gives this fragment;
    // PSMain sums them up for this fragment's final colour.
    // phase 1: directional lighting
    float3 result = CalcDirLight(dirLight, norm, viewDir, input.texCoord);
    // phase 2: point lights
    for (int i = 0; i < NR_POINT_LIGHTS; i++)
        result += CalcPointLight(pointLights[i], norm, input.fragPos, viewDir, input.texCoord);
    // phase 3: spot light
    result += CalcSpotLight(spotLight, norm, input.fragPos, viewDir, input.texCoord);

    return float4(result, 1.0f);
}
