#version 450

const int NR_LIGHTS = 32;

// std140: a vec3 starts at a multiple of 16 bytes - a float after each vec3 fills the 4 bytes up to the next one
struct Light {
    vec3 position;
    float linear;
    vec3 color;
    float quadratic;
    float radius;
};

layout(binding = 0) uniform UniformBufferObject {
    mat4 view;
    mat4 proj;
    Light lights[NR_LIGHTS];
    vec3 viewPos;
} ubo;

// the G-buffer: bindings 1, 2 and 3 (learnopengl's gPosition, gNormal and gAlbedoSpec texture units)
layout(binding = 1) uniform sampler2D gPosition;
layout(binding = 2) uniform sampler2D gNormal;
layout(binding = 3) uniform sampler2D gAlbedoSpec;

layout(location = 0) in vec2 fragTexCoord;

layout(location = 0) out vec4 outColor;

void main() {
    // retrieve data from gbuffer
    vec3 FragPos = texture(gPosition, fragTexCoord).rgb;
    vec3 Normal = texture(gNormal, fragTexCoord).rgb;
    vec3 Diffuse = texture(gAlbedoSpec, fragTexCoord).rgb;
    float Specular = texture(gAlbedoSpec, fragTexCoord).a;

    // then calculate lighting as usual
    vec3 lighting  = Diffuse * 0.1; // hard-coded ambient component
    vec3 viewDir  = normalize(ubo.viewPos - FragPos);
    for (int i = 0; i < NR_LIGHTS; ++i) {
        // calculate distance between light source and current fragment
        float distance = length(ubo.lights[i].position - FragPos);
        if (distance < ubo.lights[i].radius) {
            // diffuse
            vec3 lightDir = normalize(ubo.lights[i].position - FragPos);
            vec3 diffuse = max(dot(Normal, lightDir), 0.0) * Diffuse * ubo.lights[i].color;
            // specular
            vec3 halfwayDir = normalize(lightDir + viewDir);
            float spec = pow(max(dot(Normal, halfwayDir), 0.0), 16.0);
            vec3 specular = ubo.lights[i].color * spec * Specular;
            // attenuation
            float attenuation = 1.0 / (1.0 + ubo.lights[i].linear * distance + ubo.lights[i].quadratic * distance * distance);
            diffuse *= attenuation;
            specular *= attenuation;
            lighting += diffuse + specular;
        }
    }
    outColor = vec4(lighting, 1.0);
}
