#version 450

layout(binding = 0) uniform UniformBufferObject {
    mat4 view;
    mat4 proj;
} ubo;

layout(location = 0) in vec3 inPosition;

layout(location = 0) out vec3 fragTexCoord;

void main() {
    fragTexCoord = inPosition; // the direction from the centre of the cube to the vertex
    mat4 view = mat4(mat3(ubo.view)); // remove translation from the view matrix: the sky never comes nearer
    vec4 pos = ubo.proj * view * vec4(inPosition, 1.0);
    gl_Position = pos.xyww; // z = w: after the perspective divide the depth is 1.0, the largest depth value
}
