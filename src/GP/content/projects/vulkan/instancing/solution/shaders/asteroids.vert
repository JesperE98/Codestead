#version 450

layout(binding = 0) uniform UniformBufferObject {
    mat4 view;
    mat4 proj;
} ubo;

layout(location = 0) in vec3 inPosition;
layout(location = 1) in vec3 inNormal; // not used here: declared because the pipeline's vertex input has it
layout(location = 2) in vec2 inTexCoord;
layout(location = 3) in uint inMaterialIndex; // not used either (the rock has one material)
layout(location = 4) in mat4 inInstanceMatrix; // a mat4 attribute takes four locations: 4, 5, 6 and 7

layout(location = 0) out vec2 fragTexCoord;

void main() {
    fragTexCoord = inTexCoord;
    gl_Position = ubo.proj * ubo.view * inInstanceMatrix * vec4(inPosition, 1.0);
}
