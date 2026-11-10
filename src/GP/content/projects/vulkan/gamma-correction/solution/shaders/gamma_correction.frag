#version 450

// std140: the elements of an array are 16 bytes apart, so the positions and colours are vec4s (only xyz is used)
layout(binding = 0) uniform UniformBufferObject {
    mat4 view;
    mat4 proj;
    vec4 lightPositions[4];
    vec4 lightColors[4];
    vec3 viewPos;
} ubo;

layout(binding = 1) uniform sampler2D floorTexture;

layout(location = 0) in VS_OUT {
    vec3 fragPos;
    vec3 normal;
    vec2 texCoord;
} fs_in;

layout(location = 0) out vec4 outColor;

vec3 BlinnPhong(vec3 normal, vec3 fragPos, vec3 lightPos, vec3 lightColor) {
    // diffuse
    vec3 lightDir = normalize(lightPos - fragPos);
    float diff = max(dot(lightDir, normal), 0.0);
    vec3 diffuse = diff * lightColor;
    // specular
    vec3 viewDir = normalize(ubo.viewPos - fragPos);
    vec3 halfwayDir = normalize(lightDir + viewDir);
    float spec = pow(max(dot(normal, halfwayDir), 0.0), 64.0);
    vec3 specular = spec * lightColor;
    // simple attenuation
    float distance = length(lightPos - fragPos);
    float attenuation = 1.0 / (distance * distance); // physically right, now that the lighting happens in linear space

    diffuse *= attenuation;
    specular *= attenuation;

    return diffuse + specular;
}

void main() {
    vec3 color = texture(floorTexture, fs_in.texCoord).rgb;
    vec3 lighting = vec3(0.0);
    for (int i = 0; i < 4; ++i)
        lighting += BlinnPhong(normalize(fs_in.normal), fs_in.fragPos, ubo.lightPositions[i].xyz, ubo.lightColors[i].xyz);
    color *= lighting;
    // gamma correction: the monitor darkens colours by the power 2.2, so brighten them by the inverse power first
    color = pow(color, vec3(1.0 / 2.2));
    outColor = vec4(color, 1.0);
}
