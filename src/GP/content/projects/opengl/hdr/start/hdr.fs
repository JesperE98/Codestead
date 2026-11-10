#version 330 core
out vec4 FragColor;

in vec2 TexCoords;

uniform sampler2D hdrBuffer;

void main()
{
    // TODO: read the HDR colour from hdrBuffer at TexCoords and write it gamma corrected (no tone mapping yet)
}
