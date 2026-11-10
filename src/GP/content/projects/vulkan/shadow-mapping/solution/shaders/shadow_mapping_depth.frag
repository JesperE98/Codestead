#version 450

// The depth pass writes no colour: the depth test writes the depth by itself.
void main() {
    // gl_FragDepth = gl_FragCoord.z;
}
