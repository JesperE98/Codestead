#version 450

layout(binding = 0) uniform UniformBufferObject {
    mat4 view;
    mat4 proj;
} ubo;

layout(push_constant) uniform PushConstants {
    mat4 model;
} pc;

layout(location = 0) in vec3 inPosition;
layout(location = 1) in vec3 inNormal;
// not used here: declared because the pipeline's vertex input has them
layout(location = 2) in vec2 inTexCoord;
layout(location = 3) in uint inMaterialIndex;

layout(location = 0) out VS_OUT {
    vec3 normal;
} vs_out;

void main() {
    // the geometry shader works in view space: the position and the normal are only multiplied by view * model
    mat3 normalMatrix = mat3(transpose(inverse(ubo.view * pc.model)));
    vs_out.normal = normalize(normalMatrix * inNormal); // normalized: the model is scaled, the lines must still be 0.2 long
    gl_Position = ubo.view * pc.model * vec4(inPosition, 1.0);
}
