#version 450

layout(binding = 0) uniform UniformBufferObject {
    mat4 view;
    mat4 proj;
    vec3 viewPos;
    vec3 lightPos;
} ubo;

layout(binding = 1) uniform sampler2D floorTexture;

layout(push_constant) uniform PushConstants {
    bool blinn;
} pc;

layout(location = 0) in VS_OUT {
    vec3 fragPos;
    vec3 normal;
    vec2 texCoord;
} fs_in;

layout(location = 0) out vec4 outColor;

void main() {
    vec3 color = texture(floorTexture, fs_in.texCoord).rgb;
    // ambient
    vec3 ambient = 0.05 * color;
    // diffuse
    vec3 lightDir = normalize(ubo.lightPos - fs_in.fragPos);
    vec3 normal = normalize(fs_in.normal);
    float diff = max(dot(lightDir, normal), 0.0);
    vec3 diffuse = diff * color;
    // specular
    vec3 viewDir = normalize(ubo.viewPos - fs_in.fragPos);
    float spec = 0.0;
    if (pc.blinn) {
        // TODO: Blinn-Phong: the halfway vector between the light and view directions; spec = (its dot product with the normal) to the power 8.0
    } else {
        vec3 reflectDir = reflect(-lightDir, normal);
        spec = pow(max(dot(viewDir, reflectDir), 0.0), 8.0);
    }
    vec3 specular = vec3(0.3) * spec; // assuming bright white light color
    outColor = vec4(ambient + diffuse + specular, 1.0);
}
