#version 450

// shader outputs
layout(location = 0) out vec4 frag;

// material color (learnopengl's vec3: only rgb is used)
layout(push_constant) uniform PushConstants {
    mat4 mvp;
    vec4 color;
} pc;

void main() {
    frag = vec4(pc.color.rgb, 1.0);
}
