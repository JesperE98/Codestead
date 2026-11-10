#version 450

// std140: a vec3 starts at a multiple of 16 bytes - a float after each vec3 fills the 4 bytes up to the next one
struct Light {
    vec3 position;
    float linear;
    vec3 color;
    float quadratic;
};

// the uniform buffer up to the light
layout(binding = 0) uniform UniformBufferObject {
    mat4 view;
    mat4 proj;
    Light light;
} ubo;

// the G-buffer: bindings 1, 2 and 3 (learnopengl's gPosition, gNormal and gAlbedo texture units)
layout(binding = 1) uniform sampler2D gPosition;
layout(binding = 2) uniform sampler2D gNormal;
layout(binding = 3) uniform sampler2D gAlbedo;
layout(binding = 6) uniform sampler2D ssao; // the blurred SSAO image

layout(location = 0) in vec2 fragTexCoord;

layout(location = 0) out vec4 outColor;

void main() {
    // retrieve data from gbuffer
    vec3 FragPos = texture(gPosition, fragTexCoord).rgb;
    vec3 Normal = texture(gNormal, fragTexCoord).rgb;
    vec3 Diffuse = texture(gAlbedo, fragTexCoord).rgb;
    float AmbientOcclusion = texture(ssao, fragTexCoord).r;

    // then calculate lighting as usual
    vec3 ambient = vec3(0.3 * Diffuse * AmbientOcclusion);
    vec3 lighting  = ambient;
    vec3 viewDir  = normalize(-FragPos); // viewpos is (0.0.0)
    // diffuse
    vec3 lightDir = normalize(ubo.light.position - FragPos);
    vec3 diffuse = max(dot(Normal, lightDir), 0.0) * Diffuse * ubo.light.color;
    // specular
    vec3 halfwayDir = normalize(lightDir + viewDir);
    float spec = pow(max(dot(Normal, halfwayDir), 0.0), 8.0);
    vec3 specular = ubo.light.color * spec;
    // attenuation
    float distance = length(ubo.light.position - FragPos);
    float attenuation = 1.0 / (1.0 + ubo.light.linear * distance + ubo.light.quadratic * distance * distance);
    diffuse *= attenuation;
    specular *= attenuation;
    lighting += diffuse + specular;

    outColor = vec4(lighting, 1.0);
}
