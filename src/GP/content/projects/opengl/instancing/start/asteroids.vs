#version 330 core
layout (location = 0) in vec3 aPos;
layout (location = 2) in vec2 aTexCoords;
// TODO: the rock's model matrix as a per-instance attribute (a mat4 at location 3: aInstanceMatrix)

out vec2 TexCoords;

uniform mat4 projection;
uniform mat4 view;

void main()
{
    TexCoords = aTexCoords;
    // TODO: place the rock with its instance's matrix: projection * view * aInstanceMatrix * vec4(aPos, 1.0f)
    gl_Position = projection * view * vec4(aPos, 1.0f);
}
