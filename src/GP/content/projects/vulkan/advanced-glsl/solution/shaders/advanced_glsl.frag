#version 450

layout(binding = 1) uniform sampler2D frontTexture;
layout(binding = 2) uniform sampler2D backTexture;

layout(location = 0) in VS_OUT {
    vec2 texCoord;
} fs_in;

layout(location = 0) out vec4 outColor;

void main() {
    if (gl_FrontFacing) { // true for the front faces (the pipeline's frontFace: counter-clockwise on screen)
        outColor = texture(frontTexture, fs_in.texCoord);
    } else {
        outColor = texture(backTexture, fs_in.texCoord);
    }
}
