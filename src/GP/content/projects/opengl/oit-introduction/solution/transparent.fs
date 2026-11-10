#version 420 core

// shader outputs
layout (location = 0) out vec4 frag;

// material color (alpha = opacity)
uniform vec4 color;

void main()
{
    // ordinary alpha blending: the colour with its alpha, blended over what is already there
    frag = color;
}
