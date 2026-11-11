#version 450

// the vertex shader only reads the first members of the uniform buffer: the matrices
layout(binding = 0) uniform UniformBufferObject {
    mat4 view;
    mat4 proj;
} ubo;

layout(push_constant) uniform PushConstants {
    mat4 model;
    vec3 lightColor;
} pc;

layout(location = 0) in vec3 aPosition;
layout(location = 1) in vec3 aNormal;
layout(location = 2) in vec2 aTexcoord;

layout(location = 0) out vec3 worldPosition;
layout(location = 1) out vec3 worldNormal;
layout(location = 2) out vec2 texcoord;

void main() {
    vec4 worldpos = pc.model * vec4(aPosition, 1.0f);
    worldPosition = worldpos.xyz;
    worldNormal = mat3(pc.model) * aNormal; // learnopengl's normalMatrix = mat3(model) (model has no scaling)
    texcoord = aTexcoord;

    gl_Position = ubo.proj * ubo.view * worldpos;
}
