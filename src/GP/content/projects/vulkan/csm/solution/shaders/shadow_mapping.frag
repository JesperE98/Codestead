#version 450

layout(binding = 0) uniform UniformBufferObject {
    mat4 view;
    mat4 proj;
    vec3 viewPos;
    float farPlane;
    vec3 lightDir;
    int cascadeCount;   // number of frusta - 1
    vec4 cascadePlaneDistances[16]; // std140: 16 bytes per element - only x is used
} ubo;

layout(binding = 1) uniform sampler2D diffuseTexture;

layout(binding = 2) uniform LightSpaceMatrices {
    mat4 lightSpaceMatrices[16];
};

layout(binding = 3) uniform sampler2DArray shadowMap;

layout(location = 0) in VS_OUT {
    vec3 fragPos;
    vec3 normal;
    vec2 texCoord;
} fs_in;

layout(location = 0) out vec4 outColor;

// the cascade of a fragment: the first one whose far distance lies beyond the fragment's depth in view space
int CascadeLayer(vec3 fragPosWorldSpace) {
    vec4 fragPosViewSpace = ubo.view * vec4(fragPosWorldSpace, 1.0);
    float depthValue = abs(fragPosViewSpace.z);

    int layer = -1;
    for (int i = 0; i < ubo.cascadeCount; ++i) {
        if (depthValue < ubo.cascadePlaneDistances[i].x) {
            layer = i;
            break;
        }
    }
    if (layer == -1) {
        layer = ubo.cascadeCount;
    }
    return layer;
}

float ShadowCalculation(vec3 fragPosWorldSpace) {
    // select cascade layer
    int layer = CascadeLayer(fragPosWorldSpace);

    vec4 fragPosLightSpace = lightSpaceMatrices[layer] * vec4(fragPosWorldSpace, 1.0);
    // perform perspective divide
    vec3 projCoords = fragPosLightSpace.xyz / fragPosLightSpace.w;
    // transform x and y to the [0,1] range of texture coordinates; z is in [0,1] already (GLM_FORCE_DEPTH_ZERO_TO_ONE)
    projCoords.xy = projCoords.xy * 0.5 + 0.5;

    // get depth of current fragment from light's perspective
    float currentDepth = projCoords.z;

    // keep the shadow at 0.0 when outside the far_plane region of the light's frustum.
    if (currentDepth > 1.0) {
        return 0.0;
    }
    // calculate bias (based on depth map resolution and slope)
    vec3 normal = normalize(fs_in.normal);
    float bias = max(0.05 * (1.0 - dot(normal, ubo.lightDir)), 0.005);
    const float biasModifier = 0.5;
    if (layer == ubo.cascadeCount) {
        bias *= 1 / (ubo.farPlane * biasModifier);
    } else {
        bias *= 1 / (ubo.cascadePlaneDistances[layer].x * biasModifier);
    }

    // PCF
    float shadow = 0.0;
    vec2 texelSize = 1.0 / vec2(textureSize(shadowMap, 0));
    for (int x = -1; x <= 1; ++x) {
        for (int y = -1; y <= 1; ++y) {
            float pcfDepth = texture(shadowMap, vec3(projCoords.xy + vec2(x, y) * texelSize, layer)).r;
            shadow += (currentDepth - bias) > pcfDepth ? 1.0 : 0.0;
        }
    }
    shadow /= 9.0;

    return shadow;
}

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
    float shadow = ShadowCalculation(fs_in.fragPos);
    vec3 lighting = (ambient + (1.0 - shadow) * (diffuse + specular)) * color;

    outColor = vec4(lighting, 1.0);
}
