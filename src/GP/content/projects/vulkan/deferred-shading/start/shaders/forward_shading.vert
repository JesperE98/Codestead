#version 450

// the vertex shader only reads the first members of the uniform buffer: the matrices
layout(binding = 0) uniform UniformBufferObject {
    mat4 view;
    mat4 proj;
} ubo;

// the push constants up to the model matrix
layout(push_constant) uniform PushConstants {
    mat4 model;
} pc;

layout(location = 0) in vec3 inPosition;
layout(location = 1) in vec3 inNormal;
layout(location = 2) in vec2 inTexCoord;

layout(location = 0) out VS_OUT {
    vec3 fragPos;
    vec3 normal;
    vec2 texCoord;
} vs_out;

void main() {
    vec4 worldPos = pc.model * vec4(inPosition, 1.0);
    vs_out.fragPos = worldPos.xyz;
    vs_out.texCoord = inTexCoord;

    mat3 normalMatrix = transpose(inverse(mat3(pc.model)));
    vs_out.normal = normalMatrix * inNormal;

    gl_Position = ubo.proj * ubo.view * worldPos;
}
