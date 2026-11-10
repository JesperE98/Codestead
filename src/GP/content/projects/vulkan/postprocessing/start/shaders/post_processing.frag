#version 450

layout(binding = 0) uniform PostProcessingUniforms {
    vec4  offsets[9];     // .xy (std140: every array element takes 16 bytes)
    ivec4 edge_kernel[9]; // .x
    vec4  blur_kernel[9]; // .x
} kernels;

layout(binding = 1) uniform sampler2D scene;

layout(push_constant) uniform PostProcessingConstants {
    float time;
    int   chaos;
    int   confuse;
    int   shake;
} pc;

layout(location = 0) in vec2 TexCoords;

layout(location = 0) out vec4 color;

void main() {
    // TODO: chaos: the edge kernel over 9 samples; confuse: the inverted colour; shake: the blur kernel over 9 samples
    // (alpha 1: the texture has an alpha channel, below 1 where the sprites' transparent parts were drawn)
    color = vec4(texture(scene, TexCoords).rgb, 1.0);
}
