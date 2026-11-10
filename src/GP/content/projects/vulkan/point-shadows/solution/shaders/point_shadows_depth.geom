#version 450

layout(triangles) in;
layout(triangle_strip, max_vertices = 18) out;

// the uniform buffer up to the members the geometry shader reads, so that their offsets match the C++ struct
layout(binding = 0) uniform UniformBufferObject {
    mat4 view;
    mat4 proj;
    vec3 viewPos;
    vec3 lightPos;
    float far_plane;
    mat4 shadowMatrices[6];
} ubo;

layout(location = 0) out vec4 fragPos; // FragPos from GS (output per emitvertex)

void main() {
    for (int face = 0; face < 6; ++face) {
        gl_Layer = face; // built-in variable that specifies to which face we render.
        for (int i = 0; i < 3; ++i) { // for each triangle's vertices
            fragPos = gl_in[i].gl_Position;
            gl_Position = ubo.shadowMatrices[face] * fragPos;
            EmitVertex();
        }
        EndPrimitive();
    }
}
