#version 450

layout(binding = 0) uniform UniformBufferObject {
    mat4 projection;
} ubo;

layout(push_constant) uniform PushConstants {
    mat4 model;
    vec3 spriteColor;
} pc;

layout(location = 0) in vec4 vertex; // <vec2 position, vec2 texCoords>

layout(location = 0) out vec2 TexCoords;

void main() {
    TexCoords = vertex.zw;
    // no view matrix: the view never changes (the window shows the game's 800 x 600 pixels)
    gl_Position = ubo.projection * pc.model * vec4(vertex.xy, 0.0, 1.0);
}
