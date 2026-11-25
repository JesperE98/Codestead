#version 450

layout(binding = 1) uniform sampler2D screenTexture;

layout(location = 0) in vec2 fragTexCoord;

layout(location = 0) out vec4 outColor;

const float offset = 1.0 / 300.0; // the distance to the neighbouring samples

void main() {
    // in Vulkan v points down in an image: -offset is the row above
    vec2 offsets[9] = vec2[](
        vec2(-offset, -offset), // top-left
        vec2( 0.0,    -offset), // top-center
        vec2( offset, -offset), // top-right
        vec2(-offset,  0.0),    // center-left
        vec2( 0.0,     0.0),    // center-center
        vec2( offset,  0.0),    // center-right
        vec2(-offset,  offset), // bottom-left
        vec2( 0.0,     offset), // bottom-center
        vec2( offset,  offset)  // bottom-right
    );

    float kernel[9] = float[](
        1.0,  1.0, 1.0,
        1.0, -8.0, 1.0,
        1.0,  1.0, 1.0
    );

    vec3 sampleTex[9];
    for (int i = 0; i < 9; i++) {
        sampleTex[i] = vec3(texture(screenTexture, fragTexCoord.st + offsets[i]));
    }
    vec3 col = vec3(0.0);
    for (int i = 0; i < 9; i++) {
        col += sampleTex[i] * kernel[i];
    }

    outColor = vec4(col, 1.0);
}
