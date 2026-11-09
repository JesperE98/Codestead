#version 450

layout(push_constant) uniform PushConstants {
    float mixValue;
} pc;

layout(binding = 0) uniform sampler2D texSampler;
layout(binding = 1) uniform sampler2D faceSampler;

layout(location = 0) in vec3 fragColor;
layout(location = 1) in vec2 fragTexCoord;

layout(location = 0) out vec4 outColor;

void main() {
    outColor = mix(texture(texSampler, fragTexCoord), texture(faceSampler, vec2(1.0 - fragTexCoord.x, fragTexCoord.y)), pc.mixValue);
}
