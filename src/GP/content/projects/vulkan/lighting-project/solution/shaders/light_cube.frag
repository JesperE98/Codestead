#version 450

// the same push constants as in the vertex shader, and after the model matrix the colour of the light this lamp
// stands for
layout(push_constant) uniform PushConstants {
    mat4 model;
    vec3 color;
} pc;

layout(location = 0) out vec4 outColor;

void main() {
    outColor = vec4(pc.color, 1.0);
}
