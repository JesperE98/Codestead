#version 450

const int MAX_BONES = 100;
const int MAX_BONE_INFLUENCE = 4;

layout(binding = 0) uniform UniformBufferObject {
    mat4 view;
    mat4 proj;
    mat4 finalBonesMatrices[MAX_BONES];
} ubo;

layout(push_constant) uniform PushConstants {
    mat4 model;
} pc;

layout(location = 0) in vec3 pos;
layout(location = 1) in vec3 norm;
layout(location = 2) in vec2 tex;
layout(location = 3) in ivec4 boneIds;
layout(location = 4) in vec4 weights;

layout(location = 0) out vec2 TexCoords;

void main() {
    // the position as the weighted sum of where each of the vertex's bones moves it
    vec4 totalPosition = vec4(0.0);
    for (int i = 0; i < MAX_BONE_INFLUENCE; i++) {
        if (boneIds[i] == -1)
            continue;
        if (boneIds[i] >= MAX_BONES) {
            totalPosition = vec4(pos, 1.0);
            break;
        }
        vec4 localPosition = ubo.finalBonesMatrices[boneIds[i]] * vec4(pos, 1.0);
        totalPosition += localPosition * weights[i];
    }

    mat4 viewModel = ubo.view * pc.model;
    gl_Position = ubo.proj * viewModel * totalPosition;
    TexCoords = tex;
}
