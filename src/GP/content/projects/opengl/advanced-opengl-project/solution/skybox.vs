#version 330 core
layout (location = 0) in vec3 aPos;

out vec3 TexCoords;

uniform mat4 projection;
uniform mat4 view;

void main()
{
    TexCoords = aPos; // the direction from the centre of the cube to the vertex
    vec4 pos = projection * view * vec4(aPos, 1.0);
    gl_Position = pos.xyww; // z = w: after the perspective divide the depth is 1.0, the largest depth value
}
