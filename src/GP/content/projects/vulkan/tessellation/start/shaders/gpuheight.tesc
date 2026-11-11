#version 450

// the patch: 4 control points in, 4 out
layout(vertices = 4) out;

layout(binding = 0) uniform UniformBufferObject {
    mat4 view;
    mat4 proj;
} ubo;

layout(push_constant) uniform PushConstants {
    mat4 model;
} pc;

layout(location = 0) in vec2 TexCoord[];
layout(location = 0) out vec2 TextureCoord[];

void main() {
    // pass the control point (and its texture coordinate) through
    gl_out[gl_InvocationID].gl_Position = gl_in[gl_InvocationID].gl_Position;
    TextureCoord[gl_InvocationID] = TexCoord[gl_InvocationID];

    // the tessellation levels: once per patch (by invocation 0)
    if (gl_InvocationID == 0) {
        // TODO: how finely to tessellate - for now 1 everywhere: no new vertices, every patch stays one quad
        gl_TessLevelOuter[0] = 1;
        gl_TessLevelOuter[1] = 1;
        gl_TessLevelOuter[2] = 1;
        gl_TessLevelOuter[3] = 1;

        gl_TessLevelInner[0] = 1;
        gl_TessLevelInner[1] = 1;
    }
}
