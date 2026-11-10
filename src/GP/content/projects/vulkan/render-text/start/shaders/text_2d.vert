#version 450

layout(binding = 0) uniform UniformBufferObject {
    mat4 projection;
} ubo;

layout(location = 0) in vec4 vertex; // <vec2 pos, vec2 tex>

layout(location = 0) out vec2 TexCoords;

void main() {
    // TODO: transform the position with the projection and pass the texture coordinates on
    gl_Position = vec4(0.0, 0.0, 0.0, 1.0);
}
