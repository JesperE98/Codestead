#version 450

layout(binding = 0) uniform UniformBufferObject {
    mat4 view;
    mat4 proj;
} ubo;

layout(location = 0) in vec3 inPosition;
layout(location = 1) in vec2 inTexCoord;

layout(location = 0) out vec2 fragTexCoord;

void main() {
    fragTexCoord = inTexCoord;
    // the cube stretched into a column 0.5 x 3 x 0.5 standing on the floor (y from -0.5 to 2.5); instance i stands at
    // x = -4 + 2i, 4 units behind the sculptures
    vec3 position = inPosition * vec3(0.5, 3.0, 0.5) + vec3(-4.0 + 2.0 * gl_InstanceIndex, 1.0, -4.0);
    gl_Position = ubo.proj * ubo.view * vec4(position, 1.0);
}
