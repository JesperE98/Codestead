#version 450

layout(binding = 1) uniform sampler2D texSampler;

layout(location = 0) in vec2 fragTexCoord;

layout(location = 0) out vec4 outColor;

float near = 0.1;
float far = 100.0;

// The depth buffer's value back to the distance from the camera (the inverse of the projection's depth).
// Vulkan's depth is already 0..1 (GLM_FORCE_DEPTH_ZERO_TO_ONE): no "depth * 2.0 - 1.0" back to NDC as in OpenGL.
float LinearizeDepth(float depth) {
    return (near * far) / (far - depth * (far - near));
}

void main() {
    float depth = LinearizeDepth(gl_FragCoord.z) / far; // divide by far to get depth in range [0,1] for visualization purposes
    outColor = vec4(vec3(depth), 1.0);
}
