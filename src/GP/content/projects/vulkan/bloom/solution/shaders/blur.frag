#version 450

layout(binding = 1) uniform sampler2D image;

// the push constants up to horizontal: blur along x (true) or along y (false)
layout(push_constant) uniform PushConstants {
    mat4 model;
    vec3 lightColor;
    bool horizontal;
} pc;

layout(location = 0) in vec2 fragTexCoord;

layout(location = 0) out vec4 outColor;

const float weight[5] = float[] (0.2270270270, 0.1945945946, 0.1216216216, 0.0540540541, 0.0162162162);

void main() {
    vec2 tex_offset = 1.0 / textureSize(image, 0); // gets size of single texel
    vec3 result = texture(image, fragTexCoord).rgb * weight[0];
    if (pc.horizontal) {
        for (int i = 1; i < 5; ++i) {
            result += texture(image, fragTexCoord + vec2(tex_offset.x * i, 0.0)).rgb * weight[i];
            result += texture(image, fragTexCoord - vec2(tex_offset.x * i, 0.0)).rgb * weight[i];
        }
    } else {
        for (int i = 1; i < 5; ++i) {
            result += texture(image, fragTexCoord + vec2(0.0, tex_offset.y * i)).rgb * weight[i];
            result += texture(image, fragTexCoord - vec2(0.0, tex_offset.y * i)).rgb * weight[i];
        }
    }
    outColor = vec4(result, 1.0);
}
