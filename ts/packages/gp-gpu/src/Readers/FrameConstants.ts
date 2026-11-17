// GlReader.SpacePressFrame / SpaceReleaseFrame: the frames in which a simulated game's space bar goes down and up (the
// GL reader and GameFrames share them; the GL reader's port should import them from here).

/** The frame (at 60 frames a second) in which the space bar is pressed. */
export const SpacePressFrame = 30;

/** The frame in which the space bar is released. */
export const SpaceReleaseFrame = 33;
