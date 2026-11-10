#version 330 core
out vec4 FragColor;

in vec2 TexCoords;

uniform sampler2D image;

uniform bool horizontal;
uniform float weight[5] = float[] (0.2270270270, 0.1945945946, 0.1216216216, 0.0540540541, 0.0162162162);

void main()
{
    // TODO: a 9-tap Gaussian blur in one direction: the texel at TexCoords times weight[0], plus the 4 texels on each side (horizontal or vertical) times weight[1..4]
}
