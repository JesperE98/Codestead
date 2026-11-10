#version 330 core
in vec2 TexCoords;
out vec4 color;

uniform sampler2D scene;
uniform vec2  offsets[9];
uniform int   edge_kernel[9];
uniform float blur_kernel[9];

uniform bool chaos;
uniform bool confuse;
uniform bool shake;

void main()
{
    // TODO: chaos: the edge kernel over 9 samples; confuse: the inverted colour; shake: the blur kernel over 9 samples
    color = texture(scene, TexCoords);
}
