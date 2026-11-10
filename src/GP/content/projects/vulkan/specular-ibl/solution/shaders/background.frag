#version 450

layout(binding = 1) uniform samplerCube environmentMap;

layout(location = 0) in vec3 fragWorldPos;

layout(location = 0) out vec4 outColor;

void main() {
    vec3 envColor = textureLod(environmentMap, fragWorldPos, 0.0).rgb;

    // HDR tonemap and gamma correct
    envColor = envColor / (envColor + vec3(1.0));
    envColor = pow(envColor, vec3(1.0 / 2.2));

    outColor = vec4(envColor, 1.0);
}
