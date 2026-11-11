#version 450

// the model matrix: the first member of the push constants
layout(push_constant) uniform PushConstants {
    mat4 model;
} pc;

layout(location = 0) in vec3 inPosition;

void main() {
    // world space: the geometry shader applies each cascade's light-space matrix
    gl_Position = pc.model * vec4(inPosition, 1.0);
}
