#version 330 core
layout (location = 0) in vec3 pos;
layout (location = 1) in vec3 norm;
layout (location = 2) in vec2 tex;
// TODO: the bone ids (location 3, ivec4) and weights (location 4, vec4)

uniform mat4 projection;
uniform mat4 view;
uniform mat4 model;

// TODO: the final bone matrices (MAX_BONES = 100) and MAX_BONE_INFLUENCE = 4

out vec2 TexCoords;

void main()
{
    // TODO: the position as the weighted sum of where each of the vertex's bones moves it
    vec4 totalPosition = vec4(pos, 1.0);

    mat4 viewModel = view * model;
    gl_Position = projection * viewModel * totalPosition;
    TexCoords = tex;
}
