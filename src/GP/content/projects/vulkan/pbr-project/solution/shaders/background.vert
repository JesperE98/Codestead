#version 450

// the vertex shader only reads the first members of the uniform buffer: the matrices
layout(binding = 0) uniform UniformBufferObject {
    mat4 view;
    mat4 proj;
} ubo;

layout(location = 0) in vec3 inPosition;
layout(location = 1) in vec3 inNormal;   // not used, but in the vertex buffer
layout(location = 2) in vec2 inTexCoord; // not used, but in the vertex buffer
layout(location = 3) in vec3 inTangent;  // not used, but in the vertex buffer

layout(location = 0) out vec3 fragWorldPos;

void main() {
    fragWorldPos = inPosition;

    mat4 rotView = mat4(mat3(ubo.view));
    vec4 clipPos = ubo.proj * rotView * vec4(fragWorldPos, 1.0);

    gl_Position = clipPos.xyww;
}
