#version 450

layout(binding = 2) uniform sampler2D depthMap;

layout(location = 0) in vec2 fragTexCoord;

layout(location = 0) out vec4 outColor;

void main() {
    // TODO: the depth map's value (its r component) at fragTexCoord as a grey colour (an orthographic projection's depth
    // is linear already)
    outColor = vec4(0.0, 0.0, 0.0, 1.0);
}
