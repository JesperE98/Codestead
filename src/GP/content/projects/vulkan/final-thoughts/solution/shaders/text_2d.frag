#version 450

layout(binding = 1) uniform sampler2D text;

layout(push_constant) uniform TextConstants {
    vec3 textColor;
} pc;

layout(location = 0) in vec2 TexCoords;

layout(location = 0) out vec4 color;

void main() {
    // the glyph atlas has one channel (red): it is the glyph's coverage, used as alpha
    vec4 sampled = vec4(1.0, 1.0, 1.0, texture(text, TexCoords).r);
    color = vec4(pc.textColor, 1.0) * sampled;
}
