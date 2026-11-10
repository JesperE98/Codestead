#version 450

// This shader performs downsampling on a texture,
// as taken from Call Of Duty method, presented at ACM Siggraph 2014.

// Remember to add bilinear minification filter for this texture!
// Remember to use a floating-point texture format (for HDR)!
// Remember to use edge clamping for this texture!
layout(binding = 1) uniform sampler2D srcTexture;

// TODO: the push constants up to srcResolution (the size of the texture being read)

layout(location = 0) in vec2 texCoord;
layout(location = 0) out vec3 downsample;

void main() {
    // TODO: take 13 samples a ... m around texCoord, 1 and 2 source texels apart, and add them with learnopengl's weights
    downsample = vec3(0.0);
}
