#version 450

layout(location = 0) in vec2 inPosition;
layout(location = 1) in vec3 inColor;

// the outputs for the geometry shader, in an interface block
layout(location = 0) out VS_OUT {
    vec3 color;
} vs_out;

void main() {
    vs_out.color = inColor;
    gl_Position = vec4(inPosition.x, inPosition.y, 0.0, 1.0);
    // Vulkan draws a point list only if the last shader before the rasterizer sets the points' size: 1 pixel
    gl_PointSize = 1.0;
}
