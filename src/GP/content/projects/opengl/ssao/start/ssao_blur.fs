#version 330 core
out float FragColor;

in vec2 TexCoords;

uniform sampler2D ssaoInput;

void main()
{
    // TODO: the average of the 4 x 4 texels around TexCoords (offsets -2, -1, 0, 1 texels in x and y)
}
