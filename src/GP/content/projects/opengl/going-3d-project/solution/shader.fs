#version 330 core
out vec4 FragColor;

in vec2 TexCoord;

// texture samplers
uniform sampler2D texture1;
uniform sampler2D texture2;
// the colour of the body being drawn
uniform vec3 bodyColor;

void main()
{
    // linearly interpolate between both textures (80% container, 20% awesomeface)
    vec4 texColor = mix(texture(texture1, TexCoord), texture(texture2, TexCoord), 0.2);
    // then paint it: 60% the body's colour, 40% the texture (so the wood still shows through)
    FragColor = mix(texColor, vec4(bodyColor, 1.0), 0.6);
}
