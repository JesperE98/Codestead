#version 450

// The lighting maps are textures; a uniform block cannot hold a sampler, so they have bindings of their own.
layout(binding = 0) uniform sampler2D diffuseMap;
layout(binding = 1) uniform sampler2D specularMap;

struct Material {
    float shininess;
};

struct DirLight {
    vec3 direction;

    vec3 ambient;
    vec3 diffuse;
    vec3 specular;
};

struct PointLight {
    vec3 position;

    float constant;
    float linear;
    float quadratic;

    vec3 ambient;
    vec3 diffuse;
    vec3 specular;
};

struct SpotLight {
    vec3 position;
    vec3 direction;
    float cutOff;
    float outerCutOff;

    float constant;
    float linear;
    float quadratic;

    vec3 ambient;
    vec3 diffuse;
    vec3 specular;
};

#define NR_POINT_LIGHTS 4

layout(binding = 2) uniform UniformBufferObject {
    mat4 view;
    mat4 proj;
    vec3 viewPos;
    Material material;
    DirLight dirLight;
    PointLight pointLights[NR_POINT_LIGHTS];
    SpotLight spotLight;
} ubo;

layout(location = 0) in vec3 fragPos;
layout(location = 1) in vec3 fragNormal;
layout(location = 2) in vec2 fragTexCoord;

layout(location = 0) out vec4 outColor;

// function prototypes
vec3 CalcDirLight(DirLight light, vec3 normal, vec3 viewDir);
vec3 CalcPointLight(PointLight light, vec3 normal, vec3 fragPos, vec3 viewDir);
vec3 CalcSpotLight(SpotLight light, vec3 normal, vec3 fragPos, vec3 viewDir);

void main() {
    // properties
    vec3 norm = normalize(fragNormal);
    vec3 viewDir = normalize(ubo.viewPos - fragPos);

    // our lighting is set up in 3 phases: directional, point lights and an optional flashlight.
    // for each phase, a calculate function returns the colour that light gives this fragment;
    // main() sums them up for this fragment's final colour.
    // phase 1: directional lighting
    vec3 result = CalcDirLight(ubo.dirLight, norm, viewDir);
    // phase 2: point lights
    for (int i = 0; i < NR_POINT_LIGHTS; i++)
        result += CalcPointLight(ubo.pointLights[i], norm, fragPos, viewDir);
    // phase 3: spot light
    result += CalcSpotLight(ubo.spotLight, norm, fragPos, viewDir);

    outColor = vec4(result, 1.0);
}

// calculates the color when using a directional light.
vec3 CalcDirLight(DirLight light, vec3 normal, vec3 viewDir) {
    vec3 lightDir = normalize(-light.direction);
    // diffuse shading
    float diff = max(dot(normal, lightDir), 0.0);
    // specular shading
    vec3 reflectDir = reflect(-lightDir, normal);
    float spec = pow(max(dot(viewDir, reflectDir), 0.0), ubo.material.shininess);
    // combine results
    vec3 ambient = light.ambient * vec3(texture(diffuseMap, fragTexCoord));
    vec3 diffuse = light.diffuse * diff * vec3(texture(diffuseMap, fragTexCoord));
    vec3 specular = light.specular * spec * vec3(texture(specularMap, fragTexCoord));
    return (ambient + diffuse + specular);
}

// calculates the color when using a point light.
vec3 CalcPointLight(PointLight light, vec3 normal, vec3 fragPos, vec3 viewDir) {
    vec3 lightDir = normalize(light.position - fragPos);
    // diffuse shading
    float diff = max(dot(normal, lightDir), 0.0);
    // specular shading
    vec3 reflectDir = reflect(-lightDir, normal);
    float spec = pow(max(dot(viewDir, reflectDir), 0.0), ubo.material.shininess);
    // attenuation
    float distance = length(light.position - fragPos);
    float attenuation = 1.0 / (light.constant + light.linear * distance + light.quadratic * (distance * distance));
    // combine results
    vec3 ambient = light.ambient * vec3(texture(diffuseMap, fragTexCoord));
    vec3 diffuse = light.diffuse * diff * vec3(texture(diffuseMap, fragTexCoord));
    vec3 specular = light.specular * spec * vec3(texture(specularMap, fragTexCoord));
    ambient *= attenuation;
    diffuse *= attenuation;
    specular *= attenuation;
    return (ambient + diffuse + specular);
}

// calculates the color when using a spot light.
vec3 CalcSpotLight(SpotLight light, vec3 normal, vec3 fragPos, vec3 viewDir) {
    vec3 lightDir = normalize(light.position - fragPos);
    // diffuse shading
    float diff = max(dot(normal, lightDir), 0.0);
    // specular shading
    vec3 reflectDir = reflect(-lightDir, normal);
    float spec = pow(max(dot(viewDir, reflectDir), 0.0), ubo.material.shininess);
    // attenuation
    float distance = length(light.position - fragPos);
    float attenuation = 1.0 / (light.constant + light.linear * distance + light.quadratic * (distance * distance));
    // spotlight intensity
    float theta = dot(lightDir, normalize(-light.direction));
    float epsilon = light.cutOff - light.outerCutOff;
    float intensity = clamp((theta - light.outerCutOff) / epsilon, 0.0, 1.0);
    // combine results
    vec3 ambient = light.ambient * vec3(texture(diffuseMap, fragTexCoord));
    vec3 diffuse = light.diffuse * diff * vec3(texture(diffuseMap, fragTexCoord));
    vec3 specular = light.specular * spec * vec3(texture(specularMap, fragTexCoord));
    ambient *= attenuation * intensity;
    diffuse *= attenuation * intensity;
    specular *= attenuation * intensity;
    return (ambient + diffuse + specular);
}
