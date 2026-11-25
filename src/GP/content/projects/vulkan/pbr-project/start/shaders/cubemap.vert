#version 450

// one face of a capture: the capture's projection (90 degrees: exactly one face of the cube) times the view from the
// centre of the cube towards that face
layout(push_constant) uniform CapturePushConstants {
    mat4 projectionView;
} pc;

layout(location = 0) in vec3 inPosition;
layout(location = 1) in vec3 inNormal;   // not used, but in the vertex buffer
layout(location = 2) in vec2 inTexCoord; // not used, but in the vertex buffer
layout(location = 3) in vec3 inTangent;  // not used, but in the vertex buffer

layout(location = 0) out vec3 fragWorldPos;

void main() {
    fragWorldPos = inPosition;
    gl_Position = pc.projectionView * vec4(fragWorldPos, 1.0);
}
