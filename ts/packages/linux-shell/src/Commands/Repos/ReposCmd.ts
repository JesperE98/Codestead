// Port of Commands/Repos/ReposCmd.cs – STUB from wave 1.
// C#: Port of src/shell/commands/repos.ts Repositories outside the distribution's own:   - PPA (Ubuntu, and at your own risk Debian): add-apt-repository + apt   - AUR (Arch): git clone + makepkg, and the AUR helper yay   - COPR (Fedora): dnf copr enable/disable/list Plus the made-up programs installed from there (moonphase, snowfall). The functions that apt and dnf (PkgCmd) call are in ReposCmd.Ppa.cs and ReposCmd.Copr.cs.
//
// Wave 2 ports this group: the root file (the C# ReposCmd.cs: shared helpers and the command list) replaces this
// stub, and each command file ReposCmd.<Name>.cs becomes ReposCmd.<Name>.ts. See PORTING.md.

import type { CommandDef } from "../../Types/CommandDef.js";

/**
 * The group's commands, in the C# order:
 * AddAptRepository, Makepkg, Yay, Moonphase, Snowfall, Go
 */
export function all(): CommandDef[] {
  return [];
}
