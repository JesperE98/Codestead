namespace Codestead.Shell.Commands;

// English summaries and man pages for the package manager commands (pkg.ts), one part of the ManEn table.

public static partial class ManEnCmd
{
    private const string AptCommon = """
               update          download new package lists from the repositories
               upgrade         upgrade all installed packages
               install PACKAGE install packages
               remove PACKAGE  remove packages (configuration files are kept)
               purge PACKAGE   remove packages and their configuration files
               autoremove      remove dependencies that are no longer needed
        """;

    private const string AptTail = """
        OPTIONS
               -y, --yes       answer yes to all questions

        DESCRIPTION
               Most commands require root, so they are run with sudo:
                   sudo apt update && sudo apt upgrade
        """;

    private const string DnfMan = """
        NAME
               dnf - package manager for Fedora, RHEL, Rocky Linux and similar

        SYNOPSIS
               dnf [-y] COMMAND [PACKAGE]...

        COMMANDS
               install PACKAGE   install packages
               remove PACKAGE    remove packages
               upgrade           upgrade all packages
               check-update      show which packages can be upgraded
               makecache         download fresh metadata from the repositories
               search WORD       search for packages
               info PACKAGE      show information about a package
               list --installed  list installed packages
               repolist          show enabled repositories

        OPTIONS
               -y, --assumeyes   answer yes to all questions

        DESCRIPTION
               dnf refreshes the metadata automatically when it is old, so there
               is no separate "update" step as in apt. Note that the question
               "Is this ok [y/N]" defaults to No – press y and Enter.
        """;

    private static OrderedDictionary<string, (string Summary, string? Man)> PkgPages => new()
    {
        // ---------- Pakethantering (pkg.ts) ----------
        ["apt"] = ("The package manager in Debian and Ubuntu", $$"""
            NAME
                   apt - package manager for Debian, Ubuntu and similar

            SYNOPSIS
                   apt [-y] COMMAND [PACKAGE]...

            COMMANDS
            {{AptCommon}}
                   search WORD     search for packages
                   show PACKAGE    show information about a package
                   list --installed   list installed packages
                   list --upgradable  list packages that can be upgraded

            {{AptTail}}
            """),
        ["apt-get"] = ("Older, script-friendly variant of apt", $$"""
            NAME
                   apt-get - package manager for Debian, Ubuntu and similar

            SYNOPSIS
                   apt-get [-y] COMMAND [PACKAGE]...

            COMMANDS
            {{AptCommon}}

            {{AptTail}}
            """),
        ["pacman"] = ("The package manager in Arch Linux", """
            NAME
                   pacman - package manager for Arch Linux and similar

            SYNOPSIS
                   pacman OPERATION [OPTIONS] [PACKAGE]...

            OPERATIONS (capital letter)
                   -S    sync: install packages from the repositories
                   -R    remove packages
                   -Q    query the database of installed packages

            COMMON COMBINATIONS
                   pacman -Syu          refresh the package database and upgrade everything
                   pacman -S PACKAGE    install a package
                   pacman -Ss WORD      search for packages
                   pacman -Si PACKAGE   show information about a package
                   pacman -R PACKAGE    remove a package
                   pacman -Rs PACKAGE   remove a package and dependencies no longer needed
                   pacman -Q            list installed packages
                   pacman -Qi PACKAGE   information about an installed package

            OPTIONS
                   --noconfirm   don't ask for confirmation
                   --needed      don't reinstall packages that are already up to date

            DESCRIPTION
                   Arch is a "rolling release": packages are updated all the time.
                   Always run -Syu instead of just -Sy, otherwise you risk a
                   half-upgraded (partial upgrade) and broken installation.
            """),
        ["dnf"] = ("The package manager in Fedora and Red Hat", DnfMan),
        ["dnf5"] = ("The package manager in Fedora and Red Hat", DnfMan),
    };
}
