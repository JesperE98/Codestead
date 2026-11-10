#version 450

// TODO: the uniform buffer block (binding 2) with the view and projection matrices
// TODO: the push constant block with the model matrix

layout(location = 0) in vec3 inPosition;
layout(location = 1) in vec2 inTexCoord;

layout(location = 0) out vec2 fragTexCoord;

void main() {
    gl_Position = vec4(inPosition, 1.0);
    // learnopengl's +y points up, Vulkan's clip space +y points down: flip y
    gl_Position.y = -gl_Position.y;
    fragTexCoord = inTexCoord;
}
