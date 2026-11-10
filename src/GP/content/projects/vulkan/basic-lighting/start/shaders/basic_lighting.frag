#version 450

layout(binding = 2) uniform UniformBufferObject {
    mat4 view;
    mat4 proj;
    vec3 objectColor;
    vec3 lightColor;
} ubo;

layout(location = 0) out vec4 outColor;

void main() {
    outColor = vec4(ubo.lightColor * ubo.objectColor, 1.0);
}
