#version 450

// shader outputs
layout(location = 0) out vec4 frag;

// material color (alpha = opacity)
layout(push_constant) uniform PushConstants {
    mat4 mvp;
    vec4 color;
} pc;

void main() {
    // ordinary alpha blending: the colour with its alpha, blended over what is already there
    frag = pc.color;
}
