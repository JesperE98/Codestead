#version 450

// the rock's texture (the rock's descriptor set has it at bindings 1 and 2)
layout(binding = 1) uniform sampler2D rockDiffuseMap;

layout(location = 0) in vec2 fragTexCoord;

layout(location = 0) out vec4 outColor;

void main() {
    outColor = texture(rockDiffuseMap, fragTexCoord);
}
