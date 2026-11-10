#version 450

// The lighting maps are textures; a uniform block cannot hold a sampler, so they have bindings of their own.
layout(binding = 0) uniform sampler2D diffuseMap;
layout(binding = 1) uniform sampler2D specularMap;

struct Material {
    float shininess;
};

struct Light {
    vec3 position;
    vec3 direction;
    float cutOff;
    float outerCutOff;

    vec3 ambient;
    vec3 diffuse;
    vec3 specular;

    float constant;
    float linear;
    float quadratic;
};

layout(binding = 2) uniform UniformBufferObject {
    mat4 view;
    mat4 proj;
    vec3 viewPos;
    Material material;
    Light light;
} ubo;

layout(location = 0) in vec3 fragPos;
layout(location = 1) in vec3 fragNormal;
layout(location = 2) in vec2 fragTexCoord;

layout(location = 0) out vec4 outColor;

void main() {
    // ambient
    vec3 ambient = ubo.light.ambient * texture(diffuseMap, fragTexCoord).rgb;

    // diffuse
    vec3 norm = normalize(fragNormal);
    vec3 lightDir = normalize(ubo.light.position - fragPos);
    float diff = max(dot(norm, lightDir), 0.0);
    vec3 diffuse = ubo.light.diffuse * diff * texture(diffuseMap, fragTexCoord).rgb;

    // specular
    vec3 viewDir = normalize(ubo.viewPos - fragPos);
    vec3 reflectDir = reflect(-lightDir, norm);
    float spec = pow(max(dot(viewDir, reflectDir), 0.0), ubo.material.shininess);
    vec3 specular = ubo.light.specular * spec * texture(specularMap, fragTexCoord).rgb;

    // spotlight (soft edges)
    float theta = dot(lightDir, normalize(-ubo.light.direction));
    float epsilon = (ubo.light.cutOff - ubo.light.outerCutOff);
    float intensity = clamp((theta - ubo.light.outerCutOff) / epsilon, 0.0, 1.0);
    diffuse  *= intensity;
    specular *= intensity;

    // attenuation
    float distance    = length(ubo.light.position - fragPos);
    float attenuation = 1.0 / (ubo.light.constant + ubo.light.linear * distance + ubo.light.quadratic * (distance * distance));
    ambient  *= attenuation;
    diffuse  *= attenuation;
    specular *= attenuation;

    vec3 result = ambient + diffuse + specular;
    outColor = vec4(result, 1.0);
}
