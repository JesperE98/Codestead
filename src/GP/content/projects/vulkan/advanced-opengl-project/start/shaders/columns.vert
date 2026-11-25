#version 450

layout(binding = 0) uniform UniformBufferObject {
    mat4 view;
    mat4 proj;
} ubo;

layout(location = 0) in vec3 inPosition;
layout(location = 1) in vec2 inTexCoord;

layout(location = 0) out vec2 fragTexCoord;

void main() {
    fragTexCoord = inTexCoord;
    // TODO: turn the cube into a column and give every instance (gl_InstanceIndex) a place of its own
    vec3 position = inPosition;
    gl_Position = ubo.proj * ubo.view * vec4(position, 1.0);
}
