#version 330 core
out vec4 FragColor;

in vec2 TexCoords;

uniform sampler2D tex;

void main()
{
    // debugging shader output: show the texture coordinates as a colour (u = red, v = green)
    FragColor = vec4(TexCoords, 0.0, 1.0);
    // FragColor = texture(tex, TexCoords);
}
