#version 330 core
in vec4 FragPos;

uniform vec3 lightPos;
uniform float far_plane;

void main()
{
    // TODO: write the distance to the light, divided by far_plane, as the depth (gl_FragDepth)
}
