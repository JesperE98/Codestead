#version 450

// the shader runs 5 times per triangle (once per cascade): gl_InvocationID = 0 ... 4
layout(triangles, invocations = 5) in;
layout(triangle_strip, max_vertices = 3) out;

layout(binding = 2) uniform LightSpaceMatrices {
    mat4 lightSpaceMatrices[16];
};

void main() {
    for (int i = 0; i < 3; ++i) {
        gl_Position = lightSpaceMatrices[gl_InvocationID] * gl_in[i].gl_Position;
        gl_Layer = gl_InvocationID;
        EmitVertex();
    }
    EndPrimitive();
}
