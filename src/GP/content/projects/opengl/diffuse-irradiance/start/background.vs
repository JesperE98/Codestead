#version 330 core
layout (location = 0) in vec3 aPos;

uniform mat4 projection;
uniform mat4 view;

out vec3 WorldPos;

void main()
{
    WorldPos = aPos;

    // TODO: keep only the view matrix's rotation and give the cube the largest depth (z = w, so the depth is 1.0)
    gl_Position = vec4(0.0, 0.0, 0.0, 1.0);
}
