#version 450

layout(binding = 1) uniform samplerCube environmentMap;

layout(location = 0) in vec3 fragWorldPos;

layout(location = 0) out vec4 outColor;

void main() {
    // TODO: sample the environment map in the direction fragWorldPos, tone map and gamma correct the colour
    outColor = vec4(0.0, 0.0, 0.0, 1.0);
}
