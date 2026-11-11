#version 450

layout(push_constant) uniform PostProcessingConstants {
    float time;
    int   chaos;
    int   confuse;
    int   shake;
} pc;

layout(location = 0) in vec4 vertex; // <vec2 position, vec2 texCoords>

layout(location = 0) out vec2 TexCoords;

void main() {
    // TODO: chaos: texture coordinates swirling with time (strength 0.3); confuse: mirrored in x and y; shake: the position wobbling with time (strength 0.01)
    gl_Position = vec4(vertex.xy, 0.0, 1.0);
    TexCoords = vertex.zw;
}
