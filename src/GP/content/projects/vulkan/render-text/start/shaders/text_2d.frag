#version 450

layout(binding = 1) uniform sampler2D text;

layout(push_constant) uniform TextConstants {
    vec3 textColor;
} pc;

layout(location = 0) in vec2 TexCoords;

layout(location = 0) out vec4 color;

void main() {
    // TODO: the glyph atlas's red channel as the alpha of textColor
    color = vec4(pc.textColor, 1.0);
}
