#version 450

// shader outputs
layout(location = 0) out vec4 frag;

// TODO: the composite pass - read the accumulation and revealage images and blend their average colour over the opaque image
void main() {
    frag = vec4(0.0);
}
