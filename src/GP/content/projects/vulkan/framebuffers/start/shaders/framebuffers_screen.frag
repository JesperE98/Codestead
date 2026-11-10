#version 450

layout(binding = 1) uniform sampler2D screenTexture;

layout(location = 0) in vec2 fragTexCoord;

layout(location = 0) out vec4 outColor;

void main() {
    // TODO: the colour of the offscreen image (screenTexture) at fragTexCoord, with alpha 1.0
}
