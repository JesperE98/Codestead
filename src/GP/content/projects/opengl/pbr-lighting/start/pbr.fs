#version 330 core
out vec4 FragColor;
in vec2 TexCoords;
in vec3 WorldPos;
in vec3 Normal;

// material parameters
uniform vec3 albedo;
uniform float metallic;
uniform float roughness;
uniform float ao;

// lights
uniform vec3 lightPositions[4];
uniform vec3 lightColors[4];

uniform vec3 camPos;

const float PI = 3.14159265359;
// ----------------------------------------------------------------------------
// TODO: DistributionGGX(N, H, roughness): the normal distribution function (Trowbridge-Reitz GGX)
// ----------------------------------------------------------------------------
// TODO: GeometrySchlickGGX(NdotV, roughness) and GeometrySmith(N, V, L, roughness): the geometry function
// ----------------------------------------------------------------------------
// TODO: fresnelSchlick(cosTheta, F0): the Fresnel equation
// ----------------------------------------------------------------------------
void main()
{
    vec3 N = normalize(Normal);
    vec3 V = normalize(camPos - WorldPos);

    // reflectance equation
    vec3 Lo = vec3(0.0);
    // TODO: for each of the 4 lights add its outgoing radiance to Lo

    // ambient lighting (note that the next IBL tutorial will replace
    // this ambient lighting with environment lighting).
    vec3 ambient = vec3(0.03) * albedo * ao;

    vec3 color = ambient + Lo;

    // TODO: HDR tonemapping and gamma correction

    FragColor = vec4(color, 1.0);
}
