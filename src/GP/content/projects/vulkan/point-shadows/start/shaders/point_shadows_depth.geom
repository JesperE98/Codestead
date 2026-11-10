#version 450

layout(triangles) in;
layout(triangle_strip, max_vertices = 18) out;

// TODO: the uniform buffer up to shadowMatrices; each triangle drawn six times, once into each face of the cube map
// (gl_Layer = face), with that face's matrix; the world position passed on to the fragment shader

void main() {
}
