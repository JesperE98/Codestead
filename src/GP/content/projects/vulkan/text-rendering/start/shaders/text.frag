#version 450

layout(binding = 1) uniform sampler2D text;

layout(push_constant) uniform PushConstants {
    vec3 textColor;
} pc;

layout(location = 0) in vec2 TexCoords;

layout(location = 0) out vec4 color;

void main() {
    // the glyph's coverage (the atlas's red channel) becomes the alpha: blending keeps the letter, drops the rest
    vec4 sampled = vec4(1.0, 1.0, 1.0, texture(text, TexCoords).r);
    color = vec4(pc.textColor, 1.0) * sampled;
}
