#version 450

layout(binding = 1) uniform sampler2D image;

layout(location = 0) in vec2 fragTexCoord;

layout(location = 0) out vec4 outColor;

// shows a two-channel texture (red and green) on the screen quad, to look at the BRDF lookup texture
void main() {
    // v = 0 (roughness 0) at the bottom of the window, as in a graph: the window's y points down in Vulkan, so v is flipped
    outColor = vec4(texture(image, vec2(fragTexCoord.x, 1.0 - fragTexCoord.y)).rg, 0.0, 1.0);
}
