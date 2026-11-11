#version 410 core
layout (location = 0) in vec3 aPos;

uniform mat4 model;

void main()
{
    // world space: the geometry shader applies each cascade's light-space matrix
    gl_Position = model * vec4(aPos, 1.0);
}
