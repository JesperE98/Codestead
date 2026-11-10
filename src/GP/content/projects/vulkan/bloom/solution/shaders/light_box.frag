#version 450

// the push constants: the light cube's colour comes after the model matrix
layout(push_constant) uniform PushConstants {
    mat4 model;
    vec3 lightColor;
} pc;

layout(location = 0) in VS_OUT {
    vec3 fragPos;
    vec3 normal;
    vec2 texCoord;
} fs_in;

layout(location = 0) out vec4 outColor;
layout(location = 1) out vec4 brightColor; // the second colour attachment

void main() {
    outColor = vec4(pc.lightColor, 1.0);
    float brightness = dot(outColor.rgb, vec3(0.2126, 0.7152, 0.0722));
    if (brightness > 1.0)
        brightColor = vec4(outColor.rgb, 1.0);
    else
        brightColor = vec4(0.0, 0.0, 0.0, 1.0);
}
