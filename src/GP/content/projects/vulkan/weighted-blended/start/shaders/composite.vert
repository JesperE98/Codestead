#version 450

// shader inputs
layout(location = 0) in vec3 position;
layout(location = 1) in vec2 uv; // not used, but in the vertex buffer

void main() {
    gl_Position = vec4(position, 1.0);
}
