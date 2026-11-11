#version 450

layout(location = 0) in float Height;

layout(location = 0) out vec4 outColor;

void main() {
    // TODO: the height as a grey value (Height runs from -16 to 48)
    outColor = vec4(1.0, 1.0, 1.0, 1.0);
}
