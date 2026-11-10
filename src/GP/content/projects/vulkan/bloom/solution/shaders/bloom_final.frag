#version 450

// the uniform buffer up to exposure, so that its offset matches the C++ struct
layout(binding = 0) uniform UniformBufferObject {
    mat4 view;
    mat4 proj;
    vec4 lightPositions[4];
    vec4 lightColors[4];
    vec3 viewPos;
    float exposure;
} ubo;

layout(binding = 1) uniform sampler2D scene;
layout(binding = 2) uniform sampler2D bloomBlur;

layout(location = 0) in vec2 fragTexCoord;

layout(location = 0) out vec4 outColor;

void main() {
    const float gamma = 2.2;
    vec3 hdrColor = texture(scene, fragTexCoord).rgb;
    vec3 bloomColor = texture(bloomBlur, fragTexCoord).rgb;
    hdrColor += bloomColor; // additive blending
    // tone mapping
    vec3 result = vec3(1.0) - exp(-hdrColor * ubo.exposure);
    // also gamma correct while we're at it
    result = pow(result, vec3(1.0 / gamma));
    outColor = vec4(result, 1.0);
}
