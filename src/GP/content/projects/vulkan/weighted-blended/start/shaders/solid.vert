#version 450

// shader inputs
layout(location = 0) in vec3 position;
layout(location = 1) in vec2 uv; // not used, but in the vertex buffer

// mvp matrix (and the colour, used by the fragment shader)
layout(push_constant) uniform PushConstants {
    mat4 mvp;
    vec4 color;
} pc;

void main() {
    gl_Position = pc.mvp * vec4(position, 1.0);
}
