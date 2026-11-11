#version 450

layout(binding = 0) uniform UniformBufferObject {
    mat4 view;
    mat4 proj;
} ubo;

layout(push_constant) uniform PushConstants {
    mat4 model;
} pc;

layout(location = 0) in vec3 inPosition;

layout(location = 0) out float Height;

void main() {
    Height = inPosition.y;
    gl_Position = ubo.proj * ubo.view * pc.model * vec4(inPosition, 1.0);
}
