#version 450

// the vertex shader reads the matrices of the uniform buffer
layout(binding = 0) uniform UniformBufferObject {
    mat4 view;
    mat4 proj;
} ubo;

layout(push_constant) uniform PushConstants {
    mat4 model;
} pc;

layout(location = 0) in vec3 inPosition;
// TODO: the other attributes of a Vertex: the normal (location 1), the texture coordinates (location 2) and the material index (location 3)

// TODO: an output for the texture coordinates (location 2)

void main() {
    // TODO: pass the texture coordinates on to the fragment shader
    gl_Position = ubo.proj * ubo.view * pc.model * vec4(inPosition, 1.0);
}
