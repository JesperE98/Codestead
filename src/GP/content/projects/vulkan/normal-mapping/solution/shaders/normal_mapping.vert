#version 450

layout(binding = 0) uniform UniformBufferObject {
    mat4 view;
    mat4 proj;
    vec3 viewPos;
    vec3 lightPos;
} ubo;

layout(push_constant) uniform PushConstants {
    mat4 model;
} pc;

layout(location = 0) in vec3 inPosition;
layout(location = 1) in vec3 inNormal;
layout(location = 2) in vec2 inTexCoord;
layout(location = 3) in vec3 inTangent;
layout(location = 4) in vec3 inBitangent;

layout(location = 0) out VS_OUT {
    vec3 fragPos;
    vec2 texCoord;
    vec3 tangentLightPos;
    vec3 tangentViewPos;
    vec3 tangentFragPos;
} vs_out;

void main() {
    vs_out.fragPos = vec3(pc.model * vec4(inPosition, 1.0));
    vs_out.texCoord = inTexCoord;

    mat3 normalMatrix = transpose(inverse(mat3(pc.model)));
    vec3 T = normalize(normalMatrix * inTangent);
    vec3 N = normalize(normalMatrix * inNormal);
    T = normalize(T - dot(T, N) * N); // Gram-Schmidt: make T perpendicular to N again
    vec3 B = cross(N, T);

    mat3 TBN = transpose(mat3(T, B, N)); // world space -> tangent space (the inverse of an orthonormal matrix is its transpose)
    vs_out.tangentLightPos = TBN * ubo.lightPos;
    vs_out.tangentViewPos  = TBN * ubo.viewPos;
    vs_out.tangentFragPos  = TBN * vs_out.fragPos;

    gl_Position = ubo.proj * ubo.view * pc.model * vec4(inPosition, 1.0);
}
