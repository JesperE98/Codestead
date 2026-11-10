#version 450

// the vertex shader only reads the first members of the uniform buffer: the matrices
layout(binding = 0) uniform UniformBufferObject {
    mat4 view;
    mat4 proj;
} ubo;

// the push constants up to the model matrix (the rest is for the fragment shader)
layout(push_constant) uniform PushConstants {
    mat4 model;
} pc;

layout(location = 0) in vec3 inPosition;
layout(location = 1) in vec3 inNormal;
layout(location = 2) in vec2 inTexCoord;
layout(location = 3) in vec3 inTangent;

layout(location = 0) out vec2 fragTexCoord;
layout(location = 1) out vec3 fragWorldPos;
layout(location = 2) out vec3 fragNormal;
layout(location = 3) out vec3 fragTangent;

void main() {
    fragTexCoord = inTexCoord;
    fragWorldPos = vec3(pc.model * vec4(inPosition, 1.0));
    mat3 normalMatrix = transpose(inverse(mat3(pc.model)));
    fragNormal = normalMatrix * inNormal;
    fragTangent = mat3(pc.model) * inTangent;

    gl_Position = ubo.proj * ubo.view * vec4(fragWorldPos, 1.0);
}
