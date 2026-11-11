#version 450

// the diffuse maps of the model's materials: material 0 "planet" and material 1 "rings"
layout(binding = 1) uniform sampler2D planetDiffuseMap;
layout(binding = 2) uniform sampler2D ringsDiffuseMap;

layout(location = 2) in vec2 fragTexCoord;
layout(location = 3) flat in uint fragMaterialIndex;

layout(location = 0) out vec4 outColor;

void main() {
    // sample the texture of every material, then keep the one of this fragment's material
    // (sampling outside an if keeps the texture's level of detail correct across the triangle's edges)
    vec4 planetColor = texture(planetDiffuseMap, fragTexCoord);
    vec4 ringsColor = texture(ringsDiffuseMap, fragTexCoord);
    outColor = fragMaterialIndex == 0u ? planetColor : ringsColor;
}
