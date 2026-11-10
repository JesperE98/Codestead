#version 450

// the vertex shader reads the matrices of the uniform buffer
layout(binding = 0) uniform UniformBufferObject {
    mat4 view;
    mat4 proj;
} ubo;

layout(push_constant) uniform PushConstants {
    mat4 model;
} pc;

layout(location = 0) in vec3 inPosition;
layout(location = 1) in vec3 inNormal;
layout(location = 2) in vec2 inTexCoord;
layout(location = 3) in uint inMaterialIndex;

layout(location = 2) out vec2 fragTexCoord;
// "flat": the value of the triangle's first vertex, not interpolated (an integer cannot be)
layout(location = 3) flat out uint fragMaterialIndex;

void main() {
    fragTexCoord = inTexCoord;
    fragMaterialIndex = inMaterialIndex;
    gl_Position = ubo.proj * ubo.view * pc.model * vec4(inPosition, 1.0);
}
