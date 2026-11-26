#version 450

layout(push_constant) uniform PushConstants {
    float mixValue;
    float time; // seconds since the program started
} pc;

layout(binding = 0) uniform sampler2D texSampler;
layout(binding = 1) uniform sampler2D faceSampler;

layout(location = 0) in vec3 fragColor;
layout(location = 1) in vec2 fragTexCoord;

layout(location = 0) out vec4 outColor;

void main() {
    // tinted by the colour of the corners, interpolated across the sign
    vec4 color = mix(texture(texSampler, fragTexCoord), texture(faceSampler, vec2(1.0 - fragTexCoord.x, fragTexCoord.y)), pc.mixValue) * vec4(fragColor, 1.0);
    // the glow: the brightness goes between 0.4 and 1.0 and back, once every pi seconds - a little later
    // the further right we are (fragTexCoord.x goes from 0 to 4), so the light runs across the sign from left to right
    float glow = 0.7 + 0.3 * sin(pc.time * 2.0 - fragTexCoord.x);
    outColor = vec4(color.rgb * glow, 1.0);
}
