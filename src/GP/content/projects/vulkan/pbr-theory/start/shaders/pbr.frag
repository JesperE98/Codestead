#version 450

// std140: the elements of an array are 16 bytes apart, so the light positions and colours are vec4s (only xyz is used)
layout(binding = 0) uniform UniformBufferObject {
    mat4 view;
    mat4 proj;
    // lights
    vec4 lightPositions[4];
    vec4 lightColors[4];
    // material parameters (the same for every sphere)
    vec3 albedo;
    float ao;
    vec3 camPos;
} ubo;

// material parameters (one sphere's): they come after the model matrix
layout(push_constant) uniform PushConstants {
    mat4 model;
    float metallic;
    float roughness;
} pc;

layout(location = 0) in vec2 fragTexCoord;
layout(location = 1) in vec3 fragWorldPos;
layout(location = 2) in vec3 fragNormal;

layout(location = 0) out vec4 outColor;

const float PI = 3.14159265359;
// ----------------------------------------------------------------------------
// TODO: DistributionGGX(N, H, roughness): the normal distribution function (Trowbridge-Reitz GGX)
// ----------------------------------------------------------------------------
// TODO: GeometrySchlickGGX(NdotV, roughness) and GeometrySmith(N, V, L, roughness): the geometry function
// ----------------------------------------------------------------------------
// TODO: fresnelSchlick(cosTheta, F0): the Fresnel equation
// ----------------------------------------------------------------------------
void main() {
    vec3 albedo     = ubo.albedo;
    float metallic  = pc.metallic;
    float roughness = pc.roughness;
    float ao        = ubo.ao;

    vec3 N = normalize(fragNormal);
    vec3 V = normalize(ubo.camPos - fragWorldPos);

    // reflectance equation
    vec3 Lo = vec3(0.0);
    // TODO: for each of the 4 lights add its outgoing radiance to Lo

    // ambient lighting (note that the next IBL tutorial will replace
    // this ambient lighting with environment lighting).
    vec3 ambient = vec3(0.03) * albedo * ao;

    vec3 color = ambient + Lo;

    // TODO: HDR tonemapping and gamma correction

    outColor = vec4(color, 1.0);
}
