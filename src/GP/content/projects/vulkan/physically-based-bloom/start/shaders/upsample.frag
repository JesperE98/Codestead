#version 450

// This shader performs upsampling on a texture,
// as taken from Call Of Duty method, presented at ACM Siggraph 2014.

// Remember to add bilinear minification filter for this texture!
// Remember to use a floating-point texture format (for HDR)!
// Remember to use edge clamping for this texture!
layout(binding = 1) uniform sampler2D srcTexture;

// TODO: the push constants up to filterRadius (the filter's radius in texture coordinates)

layout(location = 0) in vec2 texCoord;
layout(location = 0) out vec3 upsample;

void main() {
    // TODO: a 3 x 3 tent filter: 9 samples filterRadius apart, weighted 1 2 1 / 2 4 2 / 1 2 1, divided by 16
    upsample = vec3(0.0);
}
