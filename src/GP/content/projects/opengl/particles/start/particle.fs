#version 330 core
in vec2 TexCoords;
in vec4 ParticleColor;
out vec4 color;

uniform sampler2D sprite;

void main()
{
    // TODO: the particle texture's colour multiplied by the particle's colour
    color = vec4(1.0);
}
