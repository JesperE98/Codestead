#version 330 core
out vec4 fragColor;

in vec3 worldPosition;
in vec3 worldNormal;
in vec2 texcoord;

// a rectangular light: its four corners in world space, its colour and intensity, and whether it shines both ways
struct Light
{
    float intensity;
    vec3 color;
    vec3 points[4];
    bool twoSided;
};
uniform Light areaLight;

struct Material
{
    sampler2D diffuse;
    vec4 albedoRoughness; // (x,y,z) = color, w = roughness
};
uniform Material material;

uniform vec3 viewPosition;
// TODO: the LTC textures (LTC1, LTC2), the lookup's scale and bias (LUT_SIZE, LUT_SCALE, LUT_BIAS), IntegrateEdgeVec
// and LTC_Evaluate

// PBR-maps for roughness (and metallic) are usually stored in non-linear
// color space (sRGB), so we use these functions to convert into linear RGB.
vec3 PowVec3(vec3 v, float p)
{
    return vec3(pow(v.x, p), pow(v.y, p), pow(v.z, p));
}

const float gamma = 2.2;
vec3 ToLinear(vec3 v) { return PowVec3(v, gamma); }
vec3 ToSRGB(vec3 v)   { return PowVec3(v, 1.0 / gamma); }

void main()
{
    // the floor's colour (an sRGB texture: already linear when sampled) and the specular colour
    vec3 mDiffuse = texture(material.diffuse, texcoord).xyz;
    vec3 mSpecular = ToLinear(vec3(0.23f, 0.23f, 0.23f));

    vec3 result = vec3(0.0f);

    vec3 N = normalize(worldNormal);
    vec3 V = normalize(viewPosition - worldPosition);
    vec3 P = worldPosition;
    float dotNV = clamp(dot(N, V), 0.0f, 1.0f);

    // TODO: the light's diffuse part: LTC_Evaluate with the identity matrix (a plain cosine) over the light's polygon

    fragColor = vec4(ToSRGB(result), 1.0f);
}
