#version 450

// the resolved (anti-aliased) picture of the scene
layout(binding = 1) uniform sampler2D screenTexture;

layout(location = 0) in vec2 fragTexCoord;

layout(location = 0) out vec4 outColor;

void main() {
    vec3 col = texture(screenTexture, fragTexCoord).rgb;
    float grayscale = 0.2126 * col.r + 0.7152 * col.g + 0.0722 * col.b;
    outColor = vec4(vec3(grayscale), 1.0);
}
