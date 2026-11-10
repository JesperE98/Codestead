#version 450

// the push constants: the light's colour comes after the model matrix
layout(push_constant) uniform PushConstants {
    mat4 model;
    vec3 lightColor;
} pc;

layout(location = 0) out vec4 outColor;

void main() {
    outColor = vec4(pc.lightColor, 1.0);
}
