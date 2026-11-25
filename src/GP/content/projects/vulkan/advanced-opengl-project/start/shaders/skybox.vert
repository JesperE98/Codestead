#version 450

layout(binding = 0) uniform UniformBufferObject {
    mat4 view;
    mat4 proj;
} ubo;

layout(location = 0) in vec3 inPosition;

layout(location = 0) out vec3 fragTexCoord;

void main() {
    // TODO: the sky's vertex shader (Cubemaps): the direction to the vertex, and the position at the largest depth
}
