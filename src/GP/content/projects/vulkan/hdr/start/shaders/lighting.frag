#version 450

// std140: the elements of an array are 16 bytes apart, so the light positions and colours are vec4s (only xyz is used)
layout(binding = 0) uniform UniformBufferObject {
    mat4 view;
    mat4 proj;
    vec4 lightPositions[4];
    vec4 lightColors[4];
    vec3 viewPos;
} ubo;

layout(binding = 1) uniform sampler2D diffuseTexture;

layout(location = 0) in VS_OUT {
    vec3 fragPos;
    vec3 normal;
    vec2 texCoord;
} fs_in;

layout(location = 0) out vec4 outColor;

void main() {
    vec3 color = texture(diffuseTexture, fs_in.texCoord).rgb;
    vec3 normal = normalize(fs_in.normal);
    // ambient
    vec3 ambient = 0.0 * color;
    // lighting
    vec3 lighting = vec3(0.0);
    for (int i = 0; i < 4; i++) {
        // diffuse
        vec3 lightDir = normalize(ubo.lightPositions[i].xyz - fs_in.fragPos);
        float diff = max(dot(lightDir, normal), 0.0);
        vec3 diffuse = ubo.lightColors[i].rgb * diff * color;
        vec3 result = diffuse;
        // attenuation (use quadratic as we have gamma correction)
        float distance = length(fs_in.fragPos - ubo.lightPositions[i].xyz);
        result *= 1.0 / (distance * distance);
        lighting += result;
    }
    // straight into the window, gamma-corrected: the window stores 0..1, everything brighter is cut off at 1.0 (white)
    vec3 result = pow(ambient + lighting, vec3(1.0 / 2.2));
    outColor = vec4(result, 1.0);
}
