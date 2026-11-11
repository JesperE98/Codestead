#version 450

// TODO: the tessellation evaluation shader: the patches' layout (quads, fractional_odd_spacing, ccw); place each
// new vertex in its patch (bilinear interpolation of the corners) and move it up by the height from the texture
layout(quads) in;

void main() {
    gl_Position = vec4(0.0);
}
