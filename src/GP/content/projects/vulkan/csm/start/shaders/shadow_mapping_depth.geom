#version 450

layout(triangles) in;
layout(triangle_strip, max_vertices = 3) out;

// TODO: one invocation per cascade (invocations = 5): transform the triangle with that cascade's light-space
// matrix (the LightSpaceMatrices uniform block, binding 2) and send it to that layer of the shadow maps (gl_Layer)
void main() {
    for (int i = 0; i < 3; ++i) {
        gl_Position = gl_in[i].gl_Position;
        EmitVertex();
    }
    EndPrimitive();
}
