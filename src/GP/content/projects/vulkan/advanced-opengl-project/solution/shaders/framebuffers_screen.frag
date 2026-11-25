#version 450

layout(binding = 1) uniform sampler2D screenTexture;

layout(location = 0) in vec2 fragTexCoord;

layout(location = 0) out vec4 outColor;

void main() {
    vec3 col = texture(screenTexture, fragTexCoord).rgb;
    // a vignette: full brightness in the middle, fading to black towards the corners
    float distanceFromCentre = length(fragTexCoord - vec2(0.5));
    col *= 1.0 - smoothstep(0.4, 0.7, distanceFromCentre);
    outColor = vec4(col, 1.0);
}
