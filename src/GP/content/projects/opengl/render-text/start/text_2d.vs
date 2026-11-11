#version 330 core
layout (location = 0) in vec4 vertex; // <vec2 pos, vec2 tex>
out vec2 TexCoords;

uniform mat4 projection;

void main()
{
    // TODO: transform the position with the projection and pass the texture coordinates on
    gl_Position = vec4(0.0, 0.0, 0.0, 1.0);
}
