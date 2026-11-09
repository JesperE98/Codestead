#version 450

layout(location = 0) in vec2 inPosition;
layout(location = 1) in vec3 inColor;

layout(location = 0) out vec3 fragColor;

void main() {
    fragColor = inColor;
    gl_Position = vec4(inPosition.x, inPosition.y, 0.0, 1.0);
    // Vulkan draws a point list only if the last shader before the rasterizer sets the points' size: 1 pixel
    gl_PointSize = 1.0;
}
