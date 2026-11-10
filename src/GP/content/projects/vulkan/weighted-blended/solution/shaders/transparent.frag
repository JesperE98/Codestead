#version 450

// shader outputs
layout(location = 0) out vec4 accum;
layout(location = 1) out float reveal;

// material color
layout(push_constant) uniform PushConstants {
    mat4 mvp;
    vec4 color;
} pc;

void main() {
    // weight function
    float weight = clamp(pow(min(1.0, pc.color.a * 10.0) + 0.01, 3.0) * 1e8 * pow(1.0 - gl_FragCoord.z * 0.9, 3.0), 1e-2, 3e3);

    // store pixel color accumulation
    accum = vec4(pc.color.rgb * pc.color.a, pc.color.a) * weight;

    // store pixel revealage threshold
    reveal = pc.color.a;
}
