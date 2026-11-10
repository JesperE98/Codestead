#version 330 core
out vec4 FragColor;
in vec2 TexCoords;

uniform sampler2D image;

// shows a two-channel texture (red and green) on the screen quad, to look at the BRDF lookup texture
void main()
{
    FragColor = vec4(texture(image, TexCoords).rg, 0.0, 1.0);
}
