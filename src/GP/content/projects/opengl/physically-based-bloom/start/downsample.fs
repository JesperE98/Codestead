#version 330 core

// This shader performs downsampling on a texture,
// as taken from Call Of Duty method, presented at ACM Siggraph 2014.

// Remember to add bilinear minification filter for this texture!
// Remember to use a floating-point texture format (for HDR)!
// Remember to use edge clamping for this texture!
uniform sampler2D srcTexture;
uniform vec2 srcResolution;

in vec2 texCoord;
layout (location = 0) out vec3 downsample;

void main()
{
    // TODO: take 13 samples around the current texel and combine them with the weights 0.125, 0.03125, 0.0625, 0.125
    downsample = texture(srcTexture, texCoord).rgb;
}
