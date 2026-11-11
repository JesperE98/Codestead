#version 330 core

// This shader performs upsampling on a texture,
// as taken from Call Of Duty method, presented at ACM Siggraph 2014.

// Remember to add bilinear minification filter for this texture!
// Remember to use a floating-point texture format (for HDR)!
// Remember to use edge clamping for this texture!
uniform sampler2D srcTexture;
uniform float filterRadius;

in vec2 texCoord;
layout (location = 0) out vec3 upsample;

void main()
{
    // TODO: take 9 samples around the current texel (filterRadius apart) and combine them with a 3x3 tent filter
    upsample = texture(srcTexture, texCoord).rgb;
}
