#version 450

layout(binding = 1) uniform sampler2D sprite;

layout(location = 0) in vec2 TexCoords;
layout(location = 1) in vec4 ParticleColor;

layout(location = 0) out vec4 color;

void main() {
    // TODO: the colour: the texture's colour times ParticleColor
}
