#version 330 core
layout (triangles) in;
layout (triangle_strip, max_vertices=18) out;

uniform mat4 shadowMatrices[6];

out vec4 FragPos; // FragPos from GS (output per emitvertex)

void main()
{
    // TODO: emit the triangle six times, once per cube map face: gl_Layer = face, FragPos = the world position, gl_Position = shadowMatrices[face] * FragPos
}
