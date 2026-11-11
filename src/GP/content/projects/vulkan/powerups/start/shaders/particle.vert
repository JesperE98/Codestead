#version 450

layout(binding = 0) uniform UniformBufferObject {
    mat4 projection;
} ubo;

layout(push_constant) uniform ParticleConstants {
    vec2 offset;
    vec4 color;
} pc;

layout(location = 0) in vec4 vertex; // <vec2 position, vec2 texCoords>

layout(location = 0) out vec2 TexCoords;
layout(location = 1) out vec4 ParticleColor;

void main() {
    float scale = 10.0f;
    TexCoords = vertex.zw;
    ParticleColor = pc.color;
    gl_Position = ubo.projection * vec4((vertex.xy * scale) + pc.offset, 0.0, 1.0);
}
