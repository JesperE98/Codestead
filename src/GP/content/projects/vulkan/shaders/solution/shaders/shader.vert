#version 450

layout(push_constant) uniform PushConstants {
    float xOffset;
} pc;

layout(location = 0) in vec3 inPosition;
layout(location = 1) in vec3 inColor;

layout(location = 0) out vec3 fragColor;

void main() {
    gl_Position = vec4(inPosition.x + pc.xOffset, -inPosition.y, inPosition.z, 1.0);
    fragColor = inPosition; // the position as the color (negative values become 0)
}
