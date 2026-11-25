#version 450

layout(binding = 0) uniform sampler2D texSampler;
layout(binding = 1) uniform sampler2D faceSampler;

layout(location = 0) in vec2 fragTexCoord;

layout(location = 0) out vec4 outColor;

void main() {
    // 80% container, 20% face
    outColor = mix(texture(texSampler, fragTexCoord), texture(faceSampler, fragTexCoord), 0.2);
}
