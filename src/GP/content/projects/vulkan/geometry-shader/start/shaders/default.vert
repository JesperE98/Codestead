#version 450

layout(binding = 0) uniform UniformBufferObject {
    mat4 view;
    mat4 proj;
} ubo;

layout(push_constant) uniform PushConstants {
    mat4 model;
} pc;

layout(location = 0) in vec3 inPosition;
layout(location = 1) in vec3 inNormal; // not used here: declared because the pipeline's vertex input has it
layout(location = 2) in vec2 inTexCoord;
layout(location = 3) in uint inMaterialIndex;

layout(location = 0) out vec2 fragTexCoord;
// "flat": the value of the triangle's first vertex, not interpolated (an integer cannot be)
layout(location = 1) flat out uint fragMaterialIndex;

void main() {
    fragTexCoord = inTexCoord;
    fragMaterialIndex = inMaterialIndex;
    gl_Position = ubo.proj * ubo.view * pc.model * vec4(inPosition, 1.0);
}
