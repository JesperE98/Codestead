#version 450

// the diffuse maps of the model's materials: material 0 "planet" and material 1 "rings"
layout(binding = 1) uniform sampler2D planetDiffuseMap;
layout(binding = 2) uniform sampler2D ringsDiffuseMap;
// and their specular maps
layout(binding = 3) uniform sampler2D planetSpecularMap;
layout(binding = 4) uniform sampler2D ringsSpecularMap;

struct Material {
    float shininess;
};

struct Light {
    vec3 position;

    vec3 ambient;
    vec3 diffuse;
    vec3 specular;
};

layout(binding = 0) uniform UniformBufferObject {
    mat4 view;
    mat4 proj;
    vec3 viewPos;
    Material material;
    Light light;
} ubo;

layout(location = 0) in vec3 fragPos;
layout(location = 1) in vec3 fragNormal;
layout(location = 2) in vec2 fragTexCoord;
layout(location = 3) flat in uint fragMaterialIndex;

layout(location = 0) out vec4 outColor;

void main() {
    // sample the textures of every material, then keep the ones of this fragment's material
    // (sampling outside an if keeps the texture's level of detail correct across the triangle's edges)
    vec3 planetDiffuse  = texture(planetDiffuseMap, fragTexCoord).rgb;
    vec3 ringsDiffuse   = texture(ringsDiffuseMap, fragTexCoord).rgb;
    vec3 planetSpecular = texture(planetSpecularMap, fragTexCoord).rgb;
    vec3 ringsSpecular  = texture(ringsSpecularMap, fragTexCoord).rgb;
    vec3 diffuseColor  = fragMaterialIndex == 0u ? planetDiffuse : ringsDiffuse;
    vec3 specularColor = fragMaterialIndex == 0u ? planetSpecular : ringsSpecular;

    // ambient
    vec3 ambient = ubo.light.ambient * diffuseColor;

    // diffuse
    vec3 norm = normalize(fragNormal);
    vec3 lightDir = normalize(ubo.light.position - fragPos);
    float diff = max(dot(norm, lightDir), 0.0);
    vec3 diffuse = ubo.light.diffuse * diff * diffuseColor;

    // specular
    vec3 viewDir = normalize(ubo.viewPos - fragPos);
    vec3 reflectDir = reflect(-lightDir, norm);
    float spec = pow(max(dot(viewDir, reflectDir), 0.0), ubo.material.shininess);
    vec3 specular = ubo.light.specular * spec * specularColor;

    vec3 result = ambient + diffuse + specular;
    outColor = vec4(result, 1.0);
}
