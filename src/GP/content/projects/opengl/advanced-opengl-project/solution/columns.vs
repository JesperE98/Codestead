#version 330 core
layout (location = 0) in vec3 aPos;
layout (location = 1) in vec2 aTexCoords;

out vec2 TexCoords;

uniform mat4 view;
uniform mat4 projection;

void main()
{
    TexCoords = aTexCoords;
    // the cube stretched into a column 0.5 x 3 x 0.5 standing on the floor (y from -0.5 to 2.5); instance i stands at
    // x = -4 + 2i, 4 units behind the sculptures
    vec3 position = aPos * vec3(0.5, 3.0, 0.5) + vec3(-4.0 + 2.0 * gl_InstanceID, 1.0, -4.0);
    gl_Position = projection * view * vec4(position, 1.0);
}
