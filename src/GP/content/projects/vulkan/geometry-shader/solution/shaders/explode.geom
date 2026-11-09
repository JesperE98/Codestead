#version 450

layout(triangles) in;
layout(triangle_strip, max_vertices = 3) out;

layout(location = 0) in VS_OUT {
    vec2 texCoord;
    flat uint materialIndex;
} gs_in[];

layout(location = 0) out vec2 fragTexCoord;
layout(location = 1) flat out uint fragMaterialIndex;

// the time in seconds: a new member of the uniform buffer (the matrices before it are not used here)
layout(binding = 0) uniform UniformBufferObject {
    mat4 view;
    mat4 proj;
    float time;
} ubo;

vec4 explode(vec4 position, vec3 normal) {
    float magnitude = 2.0;
    vec3 direction = normal * ((sin(ubo.time) + 1.0) / 2.0) * magnitude; // 0 .. 2 and back, following sin(time)
    return position + vec4(direction, 0.0);
}

vec3 GetNormal() {
    vec3 a = vec3(gl_in[0].gl_Position) - vec3(gl_in[1].gl_Position);
    vec3 b = vec3(gl_in[2].gl_Position) - vec3(gl_in[1].gl_Position);
    // learnopengl returns cross(a, b); Vulkan's projection flips y (proj[1][1] *= -1), which mirrors clip space and
    // turns that vector around: b x a points out of the model here
    return normalize(cross(b, a));
}

void main() {
    vec3 normal = GetNormal();

    gl_Position = explode(gl_in[0].gl_Position, normal);
    fragTexCoord = gs_in[0].texCoord;
    fragMaterialIndex = gs_in[0].materialIndex;
    EmitVertex();
    gl_Position = explode(gl_in[1].gl_Position, normal);
    fragTexCoord = gs_in[1].texCoord;
    fragMaterialIndex = gs_in[1].materialIndex;
    EmitVertex();
    gl_Position = explode(gl_in[2].gl_Position, normal);
    fragTexCoord = gs_in[2].texCoord;
    fragMaterialIndex = gs_in[2].materialIndex;
    EmitVertex();
    EndPrimitive();
}
