#version 450

layout(location = 0) in vec2 inPosition;
layout(location = 1) in vec3 inColor;
layout(location = 2) in vec2 inOffset; // an instanced array: a new value for every instance

layout(location = 0) out vec3 fragColor;

void main() {
    vec2 pos = inPosition * (gl_InstanceIndex / 100.0); // the quads grow from the first instance (bottom-left) to the last (top-right)
    fragColor = inColor;
    gl_Position = vec4(pos + inOffset, 0.0, 1.0);
}
