#version 450

layout(binding = 0) uniform UniformBufferObject {
    mat4 view;
    mat4 proj;
    vec3 cameraPos;
} ubo;

layout(binding = 1) uniform samplerCube skybox;

layout(location = 0) in vec3 fragNormal;
layout(location = 1) in vec3 fragPosition;

layout(location = 0) out vec4 outColor;

void main() {
    float ratio = 1.00 / 1.52; // from air (1.00) into glass (1.52)
    vec3 I = normalize(fragPosition - ubo.cameraPos); // from the camera to the fragment
    vec3 R = refract(I, normalize(fragNormal), ratio); // bent at the surface
    outColor = vec4(texture(skybox, R).rgb, 1.0);
}
