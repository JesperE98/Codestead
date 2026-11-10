#version 450

layout(location = 0) in VS_OUT {
    vec3 fragPos;
    vec3 normal;
    vec2 texCoord;
} fs_in;

// location n = colour attachment n of the G-buffer's subpass (learnopengl's glDrawBuffers)
layout(location = 0) out vec4 gPosition;
layout(location = 1) out vec4 gNormal;
layout(location = 2) out vec4 gAlbedo;

void main() {
    // store the fragment position vector in the first gbuffer texture
    gPosition = vec4(fs_in.fragPos, 1.0);
    // also store the per-fragment normals into the gbuffer
    gNormal = vec4(normalize(fs_in.normal), 1.0);
    // and the diffuse per-fragment color
    gAlbedo = vec4(vec3(0.95), 1.0);
}
