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
    // zero out memory since an out variable is initialized with undefined values by default
    color = vec4(0.0);

    vec3 samples[9]; // learnopengl's "sample" is a keyword in GLSL 4.50
    // sample from texture offsets if using convolution matrix
    if (pc.chaos != 0 || pc.shake != 0)
        for (int i = 0; i < 9; i++)
            samples[i] = vec3(texture(scene, TexCoords.st + kernels.offsets[i].xy));

    // process effects
    if (pc.chaos != 0) {
        for (int i = 0; i < 9; i++)
            color += vec4(samples[i] * kernels.edge_kernel[i].x, 0.0);
        color.a = 1.0;
    } else if (pc.confuse != 0) {
        color = vec4(1.0 - texture(scene, TexCoords).rgb, 1.0);
    } else if (pc.shake != 0) {
        for (int i = 0; i < 9; i++)
            color += vec4(samples[i] * kernels.blur_kernel[i].x, 0.0);
        color.a = 1.0;
    } else {
        // alpha 1: the texture has an alpha channel (where the sprites' transparent parts were drawn it is below 1);
        // OpenGL's GL_RGB texture has none and reads 1
        color = vec4(texture(scene, TexCoords).rgb, 1.0);
    }
}
