#version 450

layout(binding = 1) uniform sampler2D hdrBuffer;

layout(location = 0) in vec2 fragTexCoord;

layout(location = 0) out vec4 outColor;

void main() {
    // TODO: read the floating point colour (hdrBuffer) and gamma-correct it: pow(color, vec3(1.0 / 2.2))
}
