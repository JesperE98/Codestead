#version 450

// the resolved (anti-aliased) picture of the scene
layout(binding = 1) uniform sampler2D screenTexture;

layout(location = 0) in vec2 fragTexCoord;

layout(location = 0) out vec4 outColor;

void main() {
    vec3 col = texture(screenTexture, fragTexCoord).rgb;
    // TODO: post-process the anti-aliased picture: learnopengl's weighted grayscale (0.2126 r + 0.7152 g + 0.0722 b)
    outColor = vec4(col, 1.0);
}
