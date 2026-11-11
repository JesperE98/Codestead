#version 450

layout(binding = 0) uniform sampler2D tex;

layout(location = 0) in vec2 fragTexCoord;

layout(location = 0) out vec4 outColor;

void main() {
    vec3 texCol = texture(tex, fragTexCoord).rgb;
    outColor = vec4(texCol, 1.0);
}
