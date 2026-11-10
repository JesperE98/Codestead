#version 330 core
layout (location = 0) in vec4 vertex; // <vec2 position, vec2 texCoords>

out vec2 TexCoords;

uniform mat4 model;
// note that we're omitting the view matrix; the view never changes so we basically have an identity view matrix and can therefore omit it.
uniform mat4 projection;

void main()
{
    // TODO: pass the texture coordinates on and transform the position with projection * model
    gl_Position = vec4(0.0, 0.0, 0.0, 1.0);
}
