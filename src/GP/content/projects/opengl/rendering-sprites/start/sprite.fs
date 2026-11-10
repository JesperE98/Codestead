#version 330 core
in vec2 TexCoords;
out vec4 color;

uniform sampler2D image;
uniform vec3 spriteColor;

void main()
{
    // TODO: the sprite's texture colour multiplied by spriteColor
    color = vec4(1.0);
}
