#version 450

layout(push_constant) uniform PushConstants {
    mat4 model;
    vec3 lightColor;
} pc;

layout(location = 0) out vec4 color;

void main() {
    color = vec4(pc.lightColor, 1.0f);
}
