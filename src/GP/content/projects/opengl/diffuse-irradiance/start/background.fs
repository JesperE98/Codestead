#version 330 core
out vec4 FragColor;
in vec3 WorldPos;

uniform samplerCube environmentMap;

void main()
{
    // TODO: sample the environment map in the direction WorldPos, tone map and gamma correct the colour
    FragColor = vec4(0.0, 0.0, 0.0, 1.0);
}
