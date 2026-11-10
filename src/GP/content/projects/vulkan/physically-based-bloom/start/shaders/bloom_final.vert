#version 450

// The screen quad: its corners are already in normalized device coordinates, no matrices needed.
layout(location = 0) in vec3 inPosition;
layout(location = 1) in vec3 inNormal; // not used, but in the vertex buffer
layout(location = 2) in vec2 inTexCoord;

layout(location = 0) out vec2 fragTexCoord;

void main() {
    fragTexCoord = inTexCoord;
    gl_Position = vec4(inPosition, 1.0);
}
