#version 450

// the push constants: the light cube's colour comes after the model matrix
layout(push_constant) uniform PushConstants {
    mat4 model;
    vec3 lightColor;
} pc;

layout(location = 0) in VS_OUT {
    vec3 fragPos;
    vec3 normal;
    vec2 texCoord;
} fs_in;

layout(location = 0) out vec4 outColor;

void main() {
    outColor = vec4(pc.lightColor, 1.0);
}
