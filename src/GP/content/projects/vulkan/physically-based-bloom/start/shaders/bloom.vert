#version 450

// the vertex shader only reads the first members of the uniform buffer: the matrices
layout(binding = 0) uniform UniformBufferObject {
    mat4 view;
    mat4 proj;
} ubo;

// the push constants up to the model matrix (the rest is for the fragment shaders)
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
    vs_out.fragPos = vec3(pc.model * vec4(inPosition, 1.0));
    vs_out.texCoord = inTexCoord;

    mat3 normalMatrix = transpose(inverse(mat3(pc.model)));
    vs_out.normal = normalize(normalMatrix * inNormal);

    gl_Position = ubo.proj * ubo.view * pc.model * vec4(inPosition, 1.0);
}
