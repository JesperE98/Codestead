#version 330 core
layout (location = 0) in vec4 vertex; // <vec2 position, vec2 texCoords>

out vec2 TexCoords;
out vec4 ParticleColor;

uniform mat4 projection;
uniform vec2 offset;
uniform vec4 color;

void main()
{
    // TODO: a quad of scale 10 x 10 pixels whose top-left corner is at offset: pass the texture coordinates and the colour on
    gl_Position = vec4(0.0, 0.0, 0.0, 1.0);
}
