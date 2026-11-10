#version 450

layout(triangles) in;
layout(triangle_strip, max_vertices = 3) out;

layout(location = 0) in VS_OUT {
    vec2 texCoord;
    flat uint materialIndex;
} gs_in[];

layout(location = 0) out vec2 fragTexCoord;
layout(location = 1) flat out uint fragMaterialIndex;

// TODO: the time (from the uniform buffer), explode(position, normal) and GetNormal() - move each triangle along its normal

void main() {
    gl_Position = gl_in[0].gl_Position;
    fragTexCoord = gs_in[0].texCoord;
    fragMaterialIndex = gs_in[0].materialIndex;
    EmitVertex();
    gl_Position = gl_in[1].gl_Position;
    fragTexCoord = gs_in[1].texCoord;
    fragMaterialIndex = gs_in[1].materialIndex;
    EmitVertex();
    gl_Position = gl_in[2].gl_Position;
    fragTexCoord = gs_in[2].texCoord;
    fragMaterialIndex = gs_in[2].materialIndex;
    EmitVertex();
    EndPrimitive();
}
