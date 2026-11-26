#version 450

layout(binding = 0) uniform sampler2D texSampler;
layout(binding = 1) uniform sampler2D faceSampler;

// the same push constants as in the vertex shader: this stage reads the colour of the body being drawn
layout(push_constant) uniform PushConstants {
    mat4 model;
    vec3 color;
} pc;

layout(location = 0) in vec2 fragTexCoord;

layout(location = 0) out vec4 outColor;

void main() {
    // 80% container, 20% face
    vec4 texColor = mix(texture(texSampler, fragTexCoord), texture(faceSampler, fragTexCoord), 0.2);
    // then paint it: 60% the body's colour, 40% the texture (so the wood still shows through)
    outColor = mix(texColor, vec4(pc.color, 1.0), 0.6);
}
