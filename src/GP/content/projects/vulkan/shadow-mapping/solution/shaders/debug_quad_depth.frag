#version 450

layout(binding = 2) uniform sampler2D depthMap;

layout(location = 0) in vec2 fragTexCoord;

layout(location = 0) out vec4 outColor;

void main() {
    float depthValue = texture(depthMap, fragTexCoord).r;
    outColor = vec4(vec3(depthValue), 1.0); // orthographic: the depth is linear already
}
