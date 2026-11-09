#version 330 core
out vec4 FragColor;

struct Material {
    sampler2D diffuse;
    sampler2D specular;
    float shininess;
};

in vec3 FragPos;
in vec3 Normal;
in vec2 TexCoords;

uniform vec3 viewPos;
uniform Material material;

void main()
{
    // properties
    vec3 norm = normalize(Normal);
    vec3 viewDir = normalize(viewPos - FragPos);

    // our lighting is set up in 3 phases: directional, point lights and an optional flashlight.
    // for each phase, a calculate function returns the colour that light gives this fragment;
    // main() sums them up for this fragment's final colour.
    vec3 result = vec3(0.0);
    // TODO: phase 1: directional lighting
    // TODO: phase 2: point lights
    // TODO: phase 3: spot light

    FragColor = vec4(result, 1.0);
}
