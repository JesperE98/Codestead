#version 330 core
layout (triangles) in;
layout (triangle_strip, max_vertices = 3) out;

in VS_OUT {
    vec2 texCoords;
} gs_in[];

out vec2 TexCoords;

// TODO: uniform float time; explode(position, normal) and GetNormal() - move each triangle along its normal

void main() {
    gl_Position = gl_in[0].gl_Position;
    TexCoords = gs_in[0].texCoords;
    EmitVertex();
    gl_Position = gl_in[1].gl_Position;
    TexCoords = gs_in[1].texCoords;
    EmitVertex();
    gl_Position = gl_in[2].gl_Position;
    TexCoords = gs_in[2].texCoords;
    EmitVertex();
    EndPrimitive();
}
