#version 330 core
out vec4 FragColor;
in vec3 WorldPos;

uniform sampler2D equirectangularMap;

// TODO: SampleSphericalMap(v): the texture coordinates in the equirectangular map for the direction v

void main()
{
    // TODO: the colour of the equirectangular map in this fragment's direction, normalize(WorldPos)
    FragColor = vec4(0.0, 0.0, 0.0, 1.0);
}
