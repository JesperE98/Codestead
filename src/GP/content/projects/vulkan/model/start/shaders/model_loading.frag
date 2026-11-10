#version 450

layout(location = 2) in vec2 fragTexCoord;

layout(location = 0) out vec4 outColor;

void main() {
    // no textures yet: show the texture coordinates as a colour (red = u, green = v)
    outColor = vec4(fragTexCoord, 0.0, 1.0);
}
