#version 450

layout(binding = 0) uniform UniformBufferObject {
    mat4 view;
    mat4 proj;
    vec3 viewPos;
    vec3 lightPos;
} ubo;

layout(push_constant) uniform PushConstants {
    mat4 model;
} pc;

layout(location = 0) in vec3 inPosition;
layout(location = 1) in vec3 inNormal;
layout(location = 2) in vec2 inTexCoord;

layout(location = 0) out VS_OUT {
    vec3 fragPos;
    vec3 normal;
    vec2 texCoord;
} vs_out;

void main() {
    vs_out.fragPos = vec3(pc.model * vec4(inPosition, 1.0));
    vs_out.normal = transpose(inverse(mat3(pc.model))) * inNormal;
    vs_out.texCoord = inTexCoord;

    gl_Position = ubo.proj * ubo.view * pc.model * vec4(inPosition, 1.0);
}
