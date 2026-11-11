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
    Light areaLights[32];
    int numAreaLights;
} ubo;

layout(binding = 3) uniform sampler2D diffuseMap; // learnopengl's material.diffuse

layout(location = 0) in vec3 worldPosition;
layout(location = 1) in vec3 worldNormal;
layout(location = 2) in vec2 texcoord;

layout(location = 0) out vec4 fragColor;

layout(binding = 1) uniform sampler2D LTC1; // for inverse M
layout(binding = 2) uniform sampler2D LTC2; // GGX norm, fresnel, 0(unused), sphere

const float LUT_SIZE  = 64.0; // ltc_texture size
const float LUT_SCALE = (LUT_SIZE - 1.0)/LUT_SIZE;
const float LUT_BIAS  = 0.5/LUT_SIZE;

// Vector form without project to the plane (dot with the normal)
// Use for proxy sphere clipping
vec3 IntegrateEdgeVec(vec3 v1, vec3 v2)
{
    // Using built-in acos() function will result flaws
    // Using fitting result for calculating acos()
    float x = dot(v1, v2);
    float y = abs(x);

    float a = 0.8543985 + (0.4965155 + 0.0145206*y)*y;
    float b = 3.4175940 + (4.1616724 + y)*y;
    float v = a / b;

    float theta_sintheta = (x > 0.0) ? v : 0.5*inversesqrt(max(1.0 - x*x, 1e-7)) - v;

    return cross(v1, v2)*theta_sintheta;
}

// P is fragPos in world space (LTC distribution)
vec3 LTC_Evaluate(vec3 N, vec3 V, vec3 P, mat3 Minv, vec3 points[4], bool twoSided)
{
    // construct orthonormal basis around N
    vec3 T1, T2;
    T1 = normalize(V - N * dot(V, N));
    T2 = cross(N, T1);

    // rotate area light in (T1, T2, N) basis
    Minv = Minv * transpose(mat3(T1, T2, N));

    // polygon (allocate 4 vertices for clipping)
    vec3 L[4];
    // transform polygon from LTC back to origin Do (cosine weighted)
    L[0] = Minv * (points[0] - P);
    L[1] = Minv * (points[1] - P);
    L[2] = Minv * (points[2] - P);
    L[3] = Minv * (points[3] - P);

    // use tabulated horizon-clipped sphere
    // check if the shading point is behind the light
    vec3 dir = points[0] - P; // LTC space
    vec3 lightNormal = cross(points[1] - points[0], points[3] - points[0]);
    bool behind = (dot(dir, lightNormal) < 0.0);

    // cos weighted space
    L[0] = normalize(L[0]);
    L[1] = normalize(L[1]);
    L[2] = normalize(L[2]);
    L[3] = normalize(L[3]);

    // integrate
    vec3 vsum = vec3(0.0);
    vsum += IntegrateEdgeVec(L[0], L[1]);
    vsum += IntegrateEdgeVec(L[1], L[2]);
    vsum += IntegrateEdgeVec(L[2], L[3]);
    vsum += IntegrateEdgeVec(L[3], L[0]);

    // form factor of the polygon in direction vsum
    float len = length(vsum);

    float z = vsum.z/len;
    if (behind)
        z = -z;

    vec2 uv = vec2(z*0.5f + 0.5f, len); // range [0, 1]
    uv = uv*LUT_SCALE + LUT_BIAS;

    // Fetch the form factor for horizon clipping
    float scale = texture(LTC2, uv).w;

    float sum = len*scale;
    if (!behind && !twoSided)
        sum = 0.0;

    // Outgoing radiance (solid angle) for the entire polygon
    vec3 Lo_i = vec3(sum, sum, sum);
    return Lo_i;
}

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

    // use roughness and sqrt(1-cos_theta) to sample M_texture
    vec2 uv = vec2(ubo.material.albedoRoughness.w, sqrt(1.0f - dotNV));
    uv = uv*LUT_SCALE + LUT_BIAS;

    // get 4 parameters for inverse_M
    vec4 t1 = texture(LTC1, uv);

    // Get 2 parameters for Fresnel calculation
    vec4 t2 = texture(LTC2, uv);

    mat3 Minv = mat3(
        vec3(t1.x, 0, t1.y),
        vec3(  0,  1,    0),
        vec3(t1.z, 0, t1.w)
    );

    // iterate through all area lights
    for (int i = 0; i < ubo.numAreaLights; i++)
    {
        // the light's corners
        vec3 points[4];
        points[0] = ubo.areaLights[i].points[0].xyz;
        points[1] = ubo.areaLights[i].points[1].xyz;
        points[2] = ubo.areaLights[i].points[2].xyz;
        points[3] = ubo.areaLights[i].points[3].xyz;

        // Evaluate LTC shading
        vec3 diffuse = LTC_Evaluate(N, V, P, mat3(1), points, ubo.areaLights[i].twoSided);
        vec3 specular = LTC_Evaluate(N, V, P, Minv, points, ubo.areaLights[i].twoSided);

        // GGX BRDF shadowing and Fresnel
        // t2.x: shadowedF90 (F90 normally it should be 1.0)
        // t2.y: Smith function for Geometric Attenuation Term, it is dot(V or L, H).
        specular *= mSpecular*t2.x + (1.0f - mSpecular) * t2.y;

        // Add contribution
        result += ubo.areaLights[i].color * ubo.areaLights[i].intensity * (specular + mDiffuse * diffuse);
    }

    fragColor = vec4(ToSRGB(result), 1.0f);
}
