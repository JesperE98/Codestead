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
        const int MIN_TESS_LEVEL = 2;
        const int MAX_TESS_LEVEL = 8;
        const float MIN_DISTANCE = 250;
        const float MAX_DISTANCE = 450;

        // the corners in eye space (the camera looks along -z)
        vec4 eyeSpacePos00 = ubo.view * pc.model * gl_in[0].gl_Position;
        vec4 eyeSpacePos01 = ubo.view * pc.model * gl_in[1].gl_Position;
        vec4 eyeSpacePos10 = ubo.view * pc.model * gl_in[2].gl_Position;
        vec4 eyeSpacePos11 = ubo.view * pc.model * gl_in[3].gl_Position;

        // "distance" from camera scaled between 0 and 1
        float distance00 = clamp((abs(eyeSpacePos00.z) - MIN_DISTANCE) / (MAX_DISTANCE - MIN_DISTANCE), 0.0, 1.0);
        float distance01 = clamp((abs(eyeSpacePos01.z) - MIN_DISTANCE) / (MAX_DISTANCE - MIN_DISTANCE), 0.0, 1.0);
        float distance10 = clamp((abs(eyeSpacePos10.z) - MIN_DISTANCE) / (MAX_DISTANCE - MIN_DISTANCE), 0.0, 1.0);
        float distance11 = clamp((abs(eyeSpacePos11.z) - MIN_DISTANCE) / (MAX_DISTANCE - MIN_DISTANCE), 0.0, 1.0);

        // each edge from its nearer corner (two patches sharing an edge compute the same level: no cracks)
        float tessLevel0 = mix(MAX_TESS_LEVEL, MIN_TESS_LEVEL, min(distance10, distance00));
        float tessLevel1 = mix(MAX_TESS_LEVEL, MIN_TESS_LEVEL, min(distance00, distance01));
        float tessLevel2 = mix(MAX_TESS_LEVEL, MIN_TESS_LEVEL, min(distance01, distance11));
        float tessLevel3 = mix(MAX_TESS_LEVEL, MIN_TESS_LEVEL, min(distance11, distance10));

        gl_TessLevelOuter[0] = tessLevel0;
        gl_TessLevelOuter[1] = tessLevel1;
        gl_TessLevelOuter[2] = tessLevel2;
        gl_TessLevelOuter[3] = tessLevel3;

        gl_TessLevelInner[0] = max(tessLevel1, tessLevel3);
        gl_TessLevelInner[1] = max(tessLevel0, tessLevel2);
    }
}
