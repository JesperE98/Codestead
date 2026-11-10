#version 450

layout(binding = 1) uniform sampler2D image;

// TODO: the push constants up to horizontal (blur along x or along y)

layout(location = 0) in vec2 fragTexCoord;

layout(location = 0) out vec4 outColor;

const float weight[5] = float[] (0.2270270270, 0.1945945946, 0.1216216216, 0.0540540541, 0.0162162162);

void main() {
    // TODO: a 9-tap Gaussian blur in one direction: the texel at fragTexCoord times weight[0], plus the 4 texels on each
    // side (horizontal or vertical) times weight[1..4]
}
