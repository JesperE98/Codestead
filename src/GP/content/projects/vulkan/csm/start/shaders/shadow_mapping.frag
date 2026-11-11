#version 450

layout(binding = 0) uniform UniformBufferObject {
    mat4 view;
    mat4 proj;
    vec3 viewPos;
    vec3 lightDir;
} ubo;

layout(binding = 1) uniform sampler2D diffuseTexture;

// TODO: the light-space matrices (binding 2) and the shadow map array (binding 3)

layout(location = 0) in VS_OUT {
    vec3 fragPos;
    vec3 normal;
    vec2 texCoord;
} fs_in;

layout(location = 0) out vec4 outColor;

// TODO: CascadeLayer - the fragment's cascade from its depth in view space

// TODO: ShadowCalculation - look the fragment up in its cascade's layer of the shadow maps

void main() {
    vec3 color = texture(diffuseTexture, fs_in.texCoord).rgb;
    vec3 normal = normalize(fs_in.normal);
    vec3 lightColor = vec3(0.3);
    // ambient
    vec3 ambient = 0.3 * lightColor;
    // diffuse
    float diff = max(dot(ubo.lightDir, normal), 0.0);
    vec3 diffuse = diff * lightColor;
    // specular
    vec3 viewDir = normalize(ubo.viewPos - fs_in.fragPos);
    vec3 halfwayDir = normalize(ubo.lightDir + viewDir);
    float spec = pow(max(dot(normal, halfwayDir), 0.0), 64.0);
    vec3 specular = spec * lightColor;
    // calculate shadow
    float shadow = 0.0; // no shadows yet
    vec3 lighting = (ambient + (1.0 - shadow) * (diffuse + specular)) * color;

    outColor = vec4(lighting, 1.0);
}
