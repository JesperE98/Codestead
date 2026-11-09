#version 330 core
layout (location = 0) in vec3 aPos;

// TODO: move projection and view into a uniform block shared by all programs: layout (std140) uniform Matrices
uniform mat4 projection;
uniform mat4 view;
uniform mat4 model;

void main()
{
    gl_Position = projection * view * model * vec4(aPos, 1.0);
}
