// The shaders of the lit object (the cube). main.cpp compiles them at run time with D3DCompileFromFile.

// Root constants set from main.cpp with SetGraphicsRoot32BitConstants (root parameter 0):
// the shaders see them as a constant buffer at register b0.
cbuffer ModelConstants : register(b0)
{
    float4x4 model;
    float4x4 normalMatrix;    // transpose(inverse(model)), computed in main.cpp
};

// The surface of the object: the colours it reflects under ambient, diffuse and
// specular light, and how sharp its highlight is.
struct Material
{
    float3 ambient;
    float3 diffuse;
    float3 specular;
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

// The constant buffer at register b1 (the CBV in root parameter 1's table): the values
// that are the same for every draw of a frame.
cbuffer SceneConstantBuffer : register(b1)
{
    float4x4 view;
    float4x4 projection;
    float3 viewPos;
    Material material;
    Light light;
};

// What the vertex shader hands on to the rasterizer and the pixel shader.
struct PSInput
{
    float4 position : SV_POSITION;
    float3 fragPos : POSITION;    // the position in world space
    float3 normal : NORMAL;
};

// The vertex shader: runs once per vertex.
PSInput VSMain(float4 position : POSITION, float3 normal : NORMAL)
{
    PSInput result;

    // The position in world space (only the model matrix applied), for the lighting.
    float4 worldPos = mul(position, model);
    result.fragPos = worldPos.xyz;
    // The normal is a direction: w = 0, so the matrix's translation does not apply.
    result.normal = mul(float4(normal, 0.0f), normalMatrix).xyz;

    // Then view and projection, as before.
    result.position = mul(mul(worldPos, view), projection);

    return result;
}

// The pixel shader: runs once per pixel a triangle covers and returns its colour (RGBA).
float4 PSMain(PSInput input) : SV_TARGET
{
    // ambient
    float3 ambient = light.ambient * material.ambient;

    // diffuse
    float3 norm = normalize(input.normal);
    float3 lightDir = normalize(light.position - input.fragPos);
    float diff = max(dot(norm, lightDir), 0.0f);
    float3 diffuse = light.diffuse * (diff * material.diffuse);

    // specular
    float3 viewDir = normalize(viewPos - input.fragPos);
    float3 reflectDir = reflect(-lightDir, norm);
    float spec = pow(max(dot(viewDir, reflectDir), 0.0f), material.shininess);
    float3 specular = light.specular * (spec * material.specular);

    float3 result = ambient + diffuse + specular;
    return float4(result, 1.0f);
}
