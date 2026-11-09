#version 450

// TODO: the uniform block shared by the four pipelines (binding 0): the same UniformBufferObject as advanced_glsl.vert

layout(push_constant) uniform PushConstants {
    mat4 model;
} pc;

layout(location = 0) in vec3 inPosition;

void main() {
    // TODO: gl_Position from the uniform block's matrices and the push constant's model matrix
}
