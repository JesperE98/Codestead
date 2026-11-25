#version 330 core
layout (location = 0) in vec3 aPos;
layout (location = 1) in vec2 aTexCoords;

out vec2 TexCoords;

uniform mat4 view;
uniform mat4 projection;

void main()
{
    TexCoords = aTexCoords;
    // TODO: turn the cube into a column and give every instance (gl_InstanceID) a place of its own
    vec3 position = aPos;
    gl_Position = projection * view * vec4(position, 1.0);
}
