#version 450

layout(triangles) in;
layout(line_strip, max_vertices = 6) out;

// TODO: for every vertex of the triangle, emit a line (two vertices, then EndPrimitive) from the vertex along its normal (length 0.2), projected with the projection matrix of the uniform buffer

void main() {
}
