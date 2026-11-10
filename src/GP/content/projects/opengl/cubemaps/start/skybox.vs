#version 330 core
layout (location = 0) in vec3 aPos;

out vec3 TexCoords;

uniform mat4 projection;
uniform mat4 view;

void main()
{
    // TODO: the cube map is sampled with a direction: use the vertex position itself (TexCoords = aPos), then place the vertex with projection * view
}
