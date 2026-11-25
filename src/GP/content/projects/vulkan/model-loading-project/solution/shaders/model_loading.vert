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

layout(location = 0) out vec3 fragPos;
layout(location = 1) out vec3 fragNormal;
layout(location = 2) out vec2 fragTexCoord;
// "flat": the value of the triangle's first vertex, not interpolated (an integer cannot be)
layout(location = 3) flat out uint fragMaterialIndex;

void main() {
    // the lighting is calculated in world space: the fragment's position after the model matrix
    fragPos = vec3(pc.model * vec4(inPosition, 1.0));
    // the normal matrix: rotations and scaling of the model matrix without the translation (and right for non-uniform scaling)
    fragNormal = mat3(transpose(inverse(pc.model))) * inNormal;
    fragTexCoord = inTexCoord;
    fragMaterialIndex = inMaterialIndex;

    gl_Position = ubo.proj * ubo.view * vec4(fragPos, 1.0);
}
