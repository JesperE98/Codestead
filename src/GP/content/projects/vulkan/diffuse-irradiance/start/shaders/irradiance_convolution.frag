#version 450

layout(binding = 1) uniform samplerCube environmentMap;

layout(location = 0) in vec3 fragWorldPos;

layout(location = 0) out vec4 outColor;

const float PI = 3.14159265359;

void main() {
    // The world vector acts as the normal of a tangent surface
    // from the origin, aligned to fragWorldPos. Given this normal, calculate all
    // incoming radiance of the environment. The result of this radiance
    // is the radiance of light coming from -Normal direction, which is what
    // we use in the PBR shader to sample irradiance.
    vec3 N = normalize(fragWorldPos);

    vec3 irradiance = vec3(0.0);

    // TODO: add up the environment's radiance over the hemisphere around N (sampleDelta 0.1), weighted by cos(theta) * sin(theta)

    outColor = vec4(irradiance, 1.0);
}
