namespace Codestead.Shell.Commands;

// Port of src/shell/commands/index.ts – every command the simulator knows, looked up by name.
// Builtins always run; the others must exist as a file in $PATH, which means they are
// installed and removed with the package manager.

public static partial class IndexCmd
{
    private static Dictionary<string, CommandDef>? commands;

    public static Dictionary<string, CommandDef> Commands => commands ??= Build();

    private static Dictionary<string, CommandDef> Build()
    {
        var all = new Dictionary<string, CommandDef>(StringComparer.Ordinal);
        void Add(IEnumerable<CommandDef> defs)
        {
            foreach (var def in defs) all[def.Name] = def;
        }

        Add(FsCmd.All);
        Add(TextCmd.All);
        Add(SystemCmd.All);
        Add(PkgCmd.All);
        Add(ExtrasCmd.All);
        Add(ScriptCmd.All);
        Add(ProcsCmd.All);
        Add(TextprocCmd.All);

        // Archives and compression (tar, gzip, zip ...) and du.
        Add(ArchiveCmd.All);
        // Version control with git.
        Add(GitCmd.All);

        // Services and logs (systemctl, journalctl, hostnamectl, systemd-analyze, reboot).
        Add(SystemdCmd.All);
        // Other shells: zsh, fish, chsh and fish/zsh builtins.
        Add(ShellsCmd.All);
        // Users and groups (useradd, passwd, adduser ...) plus who, w, last and getent.
        Add(UsersCmd.All);
        // Networking (ip, ping, ss, dig, curl, wget, ssh ...).
        Add(NetCmd.All);
        Add(SshCmd.All);

        // getent exists in both the users and the networking chapter: host names are looked up by the
        // networking version (which also knows DNS), everything else by the users version.
        var users = UsersCmd.All.FirstOrDefault(d => d.Name == "getent");
        var net = NetCmd.All.FirstOrDefault(d => d.Name == "getent");
        if (users is not null && net is not null)
        {
            const string extra = "getent group sudo\n       getent hosts example.com";
            all["getent"] = users.With(
                man: users.Man?.Replace("getent group sudo", extra),
                manEn: users.ManEn?.Replace("getent group sudo", extra),
                run: ctx => ctx.Args.Count > 0 && (ctx.Args[0] == "hosts" || ctx.Args[0] == "ahosts") ? net.Run(ctx) : users.Run(ctx));
        }

        // Disks and file systems: df, lsblk, blkid, mount, umount, findmnt, fdisk, mkfs ...
        Add(DisksCmd.All);
        // Extra repositories (PPA, AUR, COPR) and universal package formats (Flatpak, Snap, AppImage).
        Add(ReposCmd.All);
        Add(UniversalCmd.All);
        return all;
    }
}
