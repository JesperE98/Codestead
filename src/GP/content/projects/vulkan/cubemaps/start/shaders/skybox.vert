#version 450

layout(binding = 0) uniform UniformBufferObject {
    mat4 view;
    mat4 proj;
} ubo;

layout(location = 0) in vec3 inPosition;

layout(location = 0) out vec3 fragTexCoord;

void main() {
    // TODO: a cube map is sampled with a direction: use the vertex position itself (fragTexCoord = inPosition), and place
    // the vertex with ubo.proj and the view matrix without its translation, mat4(mat3(ubo.view))
}
