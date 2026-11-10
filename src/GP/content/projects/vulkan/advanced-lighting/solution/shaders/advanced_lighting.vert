#version 450

// the vertex shader only reads the first members of the uniform buffer: the matrices
layout(binding = 0) uniform UniformBufferObject {
    mat4 view;
    mat4 proj;
} ubo;

layout(location = 0) in vec3 inPosition;
layout(location = 1) in vec3 inNormal;
layout(location = 2) in vec2 inTexCoord;

// an interface block (see "Advanced GLSL")
layout(location = 0) out VS_OUT {
    vec3 fragPos;
    vec3 normal;
    vec2 texCoord;
} vs_out;

void main() {
    vs_out.fragPos = inPosition; // the floor has no model matrix: its positions are already world positions
    vs_out.normal = inNormal;
    vs_out.texCoord = inTexCoord;
    gl_Position = ubo.proj * ubo.view * vec4(inPosition, 1.0);
}
