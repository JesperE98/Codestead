#version 450

layout(location = 0) in float Height;

layout(location = 0) out vec4 outColor;

void main() {
    float h = (Height + 16.0) / 64.0; // shift and scale the height into a grey value (0 .. 1)
    outColor = vec4(h, h, h, 1.0);
}
