#version 450

layout(binding = 0) uniform UniformBufferObject {
    mat4 view;
    mat4 proj;
} ubo;

layout(location = 0) in vec3 inPosition;
layout(location = 1) in vec3 inNormal; // not used here: declared because the pipeline's vertex input has it
layout(location = 2) in vec2 inTexCoord;
layout(location = 3) in uint inMaterialIndex; // not used either (the rock has one material)
// TODO: the rock's model matrix as a per-instance attribute (a mat4 at location 4: inInstanceMatrix)

layout(location = 0) out vec2 fragTexCoord;

void main() {
    fragTexCoord = inTexCoord;
    // TODO: place the rock with its instance's matrix: ubo.proj * ubo.view * inInstanceMatrix * vec4(inPosition, 1.0)
    gl_Position = ubo.proj * ubo.view * vec4(inPosition, 1.0);
}
