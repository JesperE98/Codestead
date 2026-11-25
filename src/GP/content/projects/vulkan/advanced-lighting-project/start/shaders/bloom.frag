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
layout(location = 1) out vec4 brightColor; // the second colour attachment

void main() {
    vec3 color = texture(diffuseTexture, fs_in.texCoord).rgb;
    vec3 normal = normalize(fs_in.normal);
    // ambient
    vec3 ambient = 0.0 * color;
    // lighting
    vec3 lighting = vec3(0.0);
    vec3 viewDir = normalize(ubo.viewPos - fs_in.fragPos);
    for (int i = 0; i < 4; i++) {
        // diffuse
        vec3 lightDir = normalize(ubo.lightPositions[i].xyz - fs_in.fragPos);
        float diff = max(dot(lightDir, normal), 0.0);
        vec3 result = ubo.lightColors[i].rgb * diff * color;
        // attenuation (use quadratic as we have gamma correction)
        float distance = length(fs_in.fragPos - ubo.lightPositions[i].xyz);
        result *= 1.0 / (distance * distance);
        lighting += result;
    }
    vec3 result = ambient + lighting;
    // check whether result is higher than some threshold, if so, output as bloom threshold color
    float brightness = dot(result, vec3(0.2126, 0.7152, 0.0722));
    if (brightness > 1.0)
        brightColor = vec4(result, 1.0);
    else
        brightColor = vec4(0.0, 0.0, 0.0, 1.0);
    outColor = vec4(result, 1.0);
}
