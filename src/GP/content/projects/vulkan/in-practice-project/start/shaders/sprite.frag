#version 450

layout(binding = 1) uniform sampler2D image;

layout(push_constant) uniform PushConstants {
    mat4 model;
    vec3 spriteColor;
} pc;

layout(location = 0) in vec2 TexCoords;

layout(location = 0) out vec4 color;

void main() {
    color = vec4(pc.spriteColor, 1.0) * texture(image, TexCoords);
}
