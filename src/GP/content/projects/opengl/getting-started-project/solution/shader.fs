#version 330 core
out vec4 FragColor;

in vec3 ourColor;
in vec2 TexCoord;

// texture samplers
uniform sampler2D texture1;
uniform sampler2D texture2;
uniform float mixValue;
uniform float time; // seconds since the program started

void main()
{
    // linearly interpolate between both textures (the face mirrored horizontally)
    // then tint by the colour of the corners, interpolated across the sign
    vec4 color = mix(texture(texture1, TexCoord), texture(texture2, vec2(1.0 - TexCoord.x, TexCoord.y)), mixValue) * vec4(ourColor, 1.0);
    // the glow: the brightness goes between 0.4 and 1.0 and back, once every pi seconds - a little later
    // the further right we are (TexCoord.x goes from 0 to 4), so the light runs across the sign from left to right
    float glow = 0.7 + 0.3 * sin(time * 2.0 - TexCoord.x);
    FragColor = vec4(color.rgb * glow, 1.0);
}
