#version 450

layout(push_constant) uniform PushConstants {
    mat4 transform;
} pc;

layout(location = 0) in vec3 inPosition;
layout(location = 1) in vec2 inTexCoord;

layout(location = 0) out vec2 fragTexCoord;

void main() {
    gl_Position = pc.transform * vec4(inPosition, 1.0);
    // learnopengl's +y points up, Vulkan's clip space +y points down: flip y
    gl_Position.y = -gl_Position.y;
    fragTexCoord = inTexCoord;
}
