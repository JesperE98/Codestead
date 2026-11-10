#version 330 core
out vec4 FragColor;

in vec2 TexCoords;

uniform sampler2D screenTexture;

void main()
{
    vec3 col = texture(screenTexture, TexCoords).rgb;
    // TODO: post-processing: show the colour as grey (grayscale = 0.2126 * r + 0.7152 * g + 0.0722 * b)
    FragColor = vec4(col, 1.0);
}
