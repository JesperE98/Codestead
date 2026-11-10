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

// the outputs for the geometry shader, in an interface block
layout(location = 0) out VS_OUT {
    vec2 texCoord;
    flat uint materialIndex;
} vs_out;

void main() {
    vs_out.texCoord = inTexCoord;
    vs_out.materialIndex = inMaterialIndex;
    gl_Position = ubo.proj * ubo.view * pc.model * vec4(inPosition, 1.0);
}
