#version 450

layout(triangles) in;
layout(line_strip, max_vertices = 6) out;

layout(binding = 0) uniform UniformBufferObject {
    mat4 view;
    mat4 proj;
} ubo;

layout(location = 0) in VS_OUT {
    vec3 normal;
} gs_in[];

const float MAGNITUDE = 0.2;

void GenerateLine(int index) {
    gl_Position = ubo.proj * gl_in[index].gl_Position;
    EmitVertex();
    gl_Position = ubo.proj * (gl_in[index].gl_Position + vec4(gs_in[index].normal, 0.0) * MAGNITUDE);
    EmitVertex();
    EndPrimitive();
}

void main() {
    GenerateLine(0); // first vertex normal
    GenerateLine(1); // second vertex normal
    GenerateLine(2); // third vertex normal
}
