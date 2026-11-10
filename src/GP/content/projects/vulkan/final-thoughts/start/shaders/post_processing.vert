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
    gl_Position = vec4(vertex.xy, 0.0, 1.0);
    vec2 texture = vertex.zw;
    if (pc.chaos != 0) {
        float strength = 0.3;
        // Vulkan's texture v points down (OpenGL's up): minus here, so the picture moves as in OpenGL
        vec2 pos = vec2(texture.x + sin(pc.time) * strength, texture.y - cos(pc.time) * strength);
        TexCoords = pos;
    } else if (pc.confuse != 0) {
        TexCoords = vec2(1.0 - texture.x, 1.0 - texture.y);
    } else {
        TexCoords = texture;
    }
    if (pc.shake != 0) {
        float strength = 0.01;
        gl_Position.x += cos(pc.time * 10.0) * strength;
        gl_Position.y -= cos(pc.time * 15.0) * strength; // Vulkan's clip space y points down: minus moves up, as OpenGL's +
    }
}
