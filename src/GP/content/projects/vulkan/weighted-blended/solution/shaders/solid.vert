#version 450

// shader inputs
layout(location = 0) in vec3 position;

// mvp matrix (and the colour, used by the fragment shader)
layout(push_constant) uniform PushConstants {
    mat4 mvp;
    vec4 color;
} pc;

void main() {
    gl_Position = pc.mvp * vec4(position, 1.0);
}
