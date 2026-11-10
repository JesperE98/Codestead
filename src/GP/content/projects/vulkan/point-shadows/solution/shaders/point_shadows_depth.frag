#version 450

layout(binding = 0) uniform UniformBufferObject {
    mat4 view;
    mat4 proj;
    vec3 viewPos;
    vec3 lightPos;
    float far_plane;
} ubo;

layout(location = 0) in vec4 fragPos;

void main() {
    float lightDistance = length(fragPos.xyz - ubo.lightPos);

    // map to [0;1] range by dividing by far_plane
    lightDistance = lightDistance / ubo.far_plane;

    // write this as modified depth
    gl_FragDepth = lightDistance;
}
