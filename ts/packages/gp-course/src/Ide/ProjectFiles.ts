/** A HashSet with StringComparer.OrdinalIgnoreCase (upper-cased keys). */
const ignoreCase = (names: string[]): Set<string> => new Set(names.map((n) => n.toUpperCase()));

const buildDirs = ignoreCase([
  "out", ".vs", ".idea", ".vscode", "x64", "x86", "Debug", "Release", "RelWithDebInfo", "MinSizeRel", "bin", "obj", ".git",
  "ARM64", ".cache", "DerivedData",
]);

const skippedDirs = ignoreCase([
  ".git", ".svn", ".hg", ".vs", ".idea", ".vscode", ".cache", "CMakeFiles", "_deps", "node_modules", "vcpkg_installed",
  "vcpkg", "Testing", "__pycache__",
]);

const libraryDirs = ignoreCase([
  "glad", "KHR", "glm", "GLFW", "stb", "imgui", "include", "includes", "external", "extern", "third_party", "thirdparty",
  "3rdparty", "vendor", "deps", "dependencies", "lib", "libs", "assimp", "freetype", "irrKlang",
]);

/**
 * The folders in the learner's project that the reader does not take the course's files from: the build's and the
 * IDEs' own folders, and the libraries kept inside the project.
 */
export const ProjectFiles = {
  /**
   * Folders of the build and the IDEs: no sources are read from them (CMake copies shaders there, Visual Studio
   * keeps its own files).
   */
  isBuildDir(name: string): boolean {
    const upper = name.toUpperCase();
    return upper.startsWith("BUILD") || upper.startsWith("CMAKE-BUILD-") || buildDirs.has(upper);
  },

  /**
   * Folders not looked into at all: version control, the IDEs' own files, CMake's internals (its compiler checks
   * build small test programs there) and dependencies fetched and built with the project.
   */
  isSkippedDir(name: string): boolean {
    return skippedDirs.has(name.toUpperCase());
  },

  /**
   * Folders of libraries the learner may keep inside the project (GLAD, GLM, stb, …): their files are not the
   * learner's code, so they are never taken for the program's main file.
   */
  isLibraryDir(name: string): boolean {
    return libraryDirs.has(name.toUpperCase());
  },
};
