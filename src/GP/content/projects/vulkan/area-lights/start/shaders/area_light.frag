#version 450

// learnopengl's struct Light (std140: the corners are vec4s, so the C++ struct can use glm::vec4 – .xyz is used)
struct Light {
    float intensity;
    vec3 color;
    vec4 points[4];
    bool twoSided;
};

// learnopengl's struct Material without the sampler (no samplers in uniform blocks in Vulkan): see binding 3
struct Material {
    vec4 albedoRoughness; // (x,y,z) = color, w = roughness
};

layout(binding = 0) uniform UniformBufferObject {
    mat4 view;
    mat4 proj;
    vec3 viewPosition;
    Material material;
    Light areaLight;
} ubo;

layout(binding = 3) uniform sampler2D diffuseMap; // learnopengl's material.diffuse

layout(location = 0) in vec3 worldPosition;
layout(location = 1) in vec3 worldNormal;
layout(location = 2) in vec2 texcoord;

layout(location = 0) out vec4 fragColor;

// TODO: the LTC textures (LTC1 at binding 1, LTC2 at binding 2), the lookup's scale and bias (LUT_SIZE, LUT_SCALE,
// LUT_BIAS), IntegrateEdgeVec and LTC_Evaluate

// PBR-maps for roughness (and metallic) are usually stored in non-linear
// color space (sRGB), so we use these functions to convert into linear RGB.
vec3 PowVec3(vec3 v, float p)
{
    return vec3(pow(v.x, p), pow(v.y, p), pow(v.z, p));
}

const float gamma = 2.2;
vec3 ToLinear(vec3 v) { return PowVec3(v, gamma); }
vec3 ToSRGB(vec3 v)   { return PowVec3(v, 1.0/gamma); }


void main()
{
    // the floor's colour (an sRGB texture: already linear when sampled) and the specular colour
    vec3 mDiffuse = texture(diffuseMap, texcoord).xyz;
    vec3 mSpecular = ToLinear(vec3(0.23f, 0.23f, 0.23f));

    vec3 result = vec3(0.0f);

    vec3 N = normalize(worldNormal);
    vec3 V = normalize(ubo.viewPosition - worldPosition);
    vec3 P = worldPosition;
    float dotNV = clamp(dot(N, V), 0.0f, 1.0f);

    // TODO: the light's diffuse part: LTC_Evaluate with the identity matrix (a plain cosine) over the light's polygon

    fragColor = vec4(ToSRGB(result), 1.0f);
}
