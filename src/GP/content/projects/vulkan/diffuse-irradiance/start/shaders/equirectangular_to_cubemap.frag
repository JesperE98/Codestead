#version 450

layout(binding = 1) uniform sampler2D equirectangularMap;

layout(location = 0) in vec3 fragWorldPos;

layout(location = 0) out vec4 outColor;

// TODO: SampleSphericalMap(v): the texture coordinates in the equirectangular map for the direction v

void main() {
    // TODO: the colour of the equirectangular map in this fragment's direction, normalize(fragWorldPos)
    outColor = vec4(0.0, 0.0, 0.0, 1.0);
}
