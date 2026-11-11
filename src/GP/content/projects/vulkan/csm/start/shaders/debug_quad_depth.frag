#version 450

// the shadow maps: one array texture, a layer per cascade
layout(binding = 3) uniform sampler2DArray depthMap;

// the layer to show
layout(push_constant) uniform PushConstants {
    mat4 model;
    int layer;
} pc;

layout(location = 0) in vec2 fragTexCoord;

layout(location = 0) out vec4 outColor;

void main() {
    float depthValue = texture(depthMap, vec3(fragTexCoord, pc.layer)).r;
    outColor = vec4(vec3(depthValue), 1.0); // orthographic
}
