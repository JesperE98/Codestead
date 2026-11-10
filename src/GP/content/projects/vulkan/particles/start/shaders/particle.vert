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
    // TODO: pass vertex.zw on as TexCoords and pc.color as ParticleColor; the position: vertex.xy scaled by 10, moved by pc.offset, then the projection
}
