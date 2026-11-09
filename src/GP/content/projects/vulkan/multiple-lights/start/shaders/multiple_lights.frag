#version 450

// The lighting maps are textures; a uniform block cannot hold a sampler, so they have bindings of their own.
layout(binding = 0) uniform sampler2D diffuseMap;
layout(binding = 1) uniform sampler2D specularMap;

struct Material {
    float shininess;
};

layout(binding = 2) uniform UniformBufferObject {
    mat4 view;
    mat4 proj;
    vec3 viewPos;
    Material material;
} ubo;

layout(location = 0) in vec3 fragPos;
layout(location = 1) in vec3 fragNormal;
layout(location = 2) in vec2 fragTexCoord;

layout(location = 0) out vec4 outColor;

void main() {
    // properties
    vec3 norm = normalize(fragNormal);
    vec3 viewDir = normalize(ubo.viewPos - fragPos);

    // our lighting is set up in 3 phases: directional, point lights and an optional flashlight.
    // for each phase, a calculate function returns the colour that light gives this fragment;
    // main() sums them up for this fragment's final colour.
    vec3 result = vec3(0.0);
    // TODO: phase 1: directional lighting
    // TODO: phase 2: point lights
    // TODO: phase 3: spot light

    outColor = vec4(result, 1.0);
}
