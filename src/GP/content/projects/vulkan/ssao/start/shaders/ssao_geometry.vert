#version 450

// the vertex shader only reads the first members of the uniform buffer: the matrices
layout(binding = 0) uniform UniformBufferObject {
    mat4 view;
    mat4 proj;
} ubo;

layout(push_constant) uniform PushConstants {
    mat4 model;
    bool invertedNormals;
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
    // the G-buffer is in view space: positions and normals as the camera sees them
    vec4 viewPos = ubo.view * pc.model * vec4(inPosition, 1.0);
    vs_out.fragPos = viewPos.xyz;
    vs_out.texCoord = inTexCoord;

    mat3 normalMatrix = transpose(inverse(mat3(ubo.view * pc.model)));
    vs_out.normal = normalMatrix * (pc.invertedNormals ? -inNormal : inNormal);

    gl_Position = ubo.proj * viewPos;
}
