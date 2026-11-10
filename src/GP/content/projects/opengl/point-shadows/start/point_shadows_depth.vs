#version 330 core
layout (location = 0) in vec3 aPos;

uniform mat4 model;

void main()
{
    // TODO: the world position (model * aPos): the geometry shader projects it once per cube map face
}
