#version 450

// shader inputs
layout(location = 0) in vec2 texture_coords;

// shader outputs
layout(location = 0) out vec4 frag;

// screen image
layout(binding = 0) uniform sampler2D screen;

void main() {
    frag = vec4(texture(screen, texture_coords).rgb, 1.0);
}
