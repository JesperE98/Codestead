#version 450

const int NR_LIGHTS = 32;

// std140: a vec3 starts at a multiple of 16 bytes - a float after each vec3 fills the 4 bytes up to the next one
struct Light {
    vec3 position;
    float linear;
    vec3 color;
    float quadratic;
};

layout(binding = 0) uniform UniformBufferObject {
    mat4 view;
    mat4 proj;
    Light lights[NR_LIGHTS];
    vec3 viewPos;
} ubo;

layout(binding = 1) uniform sampler2D texture_diffuse1;
layout(binding = 2) uniform sampler2D texture_specular1;

layout(location = 0) in VS_OUT {
    vec3 fragPos;
    vec3 normal;
    vec2 texCoord;
} fs_in;

layout(location = 0) out vec4 outColor;

void main() {
    // the surface's data, straight from the vertex shader and the textures
    vec3 normal = normalize(fs_in.normal);
    vec3 Diffuse = texture(texture_diffuse1, fs_in.texCoord).rgb;
    float Specular = texture(texture_specular1, fs_in.texCoord).r;

    // then calculate lighting: every fragment loops over all the lights
    vec3 lighting  = Diffuse * 0.1; // hard-coded ambient component
    vec3 viewDir  = normalize(ubo.viewPos - fs_in.fragPos);
    for (int i = 0; i < NR_LIGHTS; ++i) {
        // diffuse
        vec3 lightDir = normalize(ubo.lights[i].position - fs_in.fragPos);
        vec3 diffuse = max(dot(normal, lightDir), 0.0) * Diffuse * ubo.lights[i].color;
        // specular
        vec3 halfwayDir = normalize(lightDir + viewDir);
        float spec = pow(max(dot(normal, halfwayDir), 0.0), 16.0);
        vec3 specular = ubo.lights[i].color * spec * Specular;
        // attenuation
        float distance = length(ubo.lights[i].position - fs_in.fragPos);
        float attenuation = 1.0 / (1.0 + ubo.lights[i].linear * distance + ubo.lights[i].quadratic * distance * distance);
        diffuse *= attenuation;
        specular *= attenuation;
        lighting += diffuse + specular;
    }
    outColor = vec4(lighting, 1.0);
}
