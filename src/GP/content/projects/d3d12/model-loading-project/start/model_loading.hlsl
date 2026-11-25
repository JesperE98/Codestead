// The shaders of the model. main.cpp compiles them at run time with D3DCompileFromFile.

// Root constants set from main.cpp with SetGraphicsRoot32BitConstants (root parameter 0):
// the vertex shader sees them as a constant buffer at register b0.
cbuffer ModelConstants : register(b0)
{
    float4x4 model;
    float4x4 normalMatrix;    // transpose(inverse(model)), computed in main.cpp
};

// The rest of the material: its textures are below.
struct Material
{
    float shininess;
};

// The light: where it is and how strong its ambient, diffuse and specular parts are.
struct Light
{
    float3 position;
    float3 ambient;
    float3 diffuse;
    float3 specular;
};

// The constant buffer at register b1 (the CBV in root parameter 1's table): the
// values that are the same for every draw of a frame.
cbuffer SceneConstantBuffer : register(b1)
{
    float4x4 view;
    float4x4 projection;
    float3 viewPos;
    Material material;
    Light light;
};

// The mesh's textures, in the descriptor table of root parameter 2: its diffuse map is
// register t0 (learnopengl's texture_diffuse1).
Texture2D texture_diffuse1 : register(t0);
Texture2D texture_specular1 : register(t1);    // the specular map: t1
// The sampler: register s0, the static sampler of the root signature.
SamplerState wrapSampler : register(s0);

// What the vertex shader hands on to the rasterizer and the pixel shader.
struct PSInput
{
    float4 position : SV_POSITION;
    float3 fragPos : POSITION;    // the position in world space
    float3 normal : NORMAL;
    float2 texCoords : TEXCOORD;
};

// The vertex shader: runs once per vertex.
PSInput VSMain(float4 position : POSITION, float3 normal : NORMAL, float2 texCoords : TEXCOORD)
{
    PSInput result;

    // The position in world space (only the model matrix applied), for the lighting.
    float4 worldPos = mul(position, model);
    result.fragPos = worldPos.xyz;
    // The normal is a direction: w = 0, so the matrix's translation does not apply.
    result.normal = mul(float4(normal, 0.0f), normalMatrix).xyz;
    result.texCoords = texCoords;
    result.position = mul(mul(worldPos, view), projection);

    return result;
}

// The pixel shader: Phong lighting with the diffuse and the specular map.
float4 PSMain(PSInput input) : SV_TARGET
{
    float3 diffuseColor = texture_diffuse1.Sample(wrapSampler, input.texCoords).rgb;

    // ambient
    float3 ambient = light.ambient * diffuseColor;

    // diffuse
    float3 norm = normalize(input.normal);
    float3 lightDir = normalize(light.position - input.fragPos);
    float diff = max(dot(norm, lightDir), 0.0f);
    float3 diffuse = light.diffuse * diff * diffuseColor;

    // specular
    float3 viewDir = normalize(viewPos - input.fragPos);
    float3 reflectDir = reflect(-lightDir, norm);
    float spec = pow(max(dot(viewDir, reflectDir), 0.0f), material.shininess);
    float3 specular = light.specular * spec * texture_specular1.Sample(wrapSampler, input.texCoords).rgb;

    float3 result = ambient + diffuse + specular;
    return float4(result, 1.0f);
}
