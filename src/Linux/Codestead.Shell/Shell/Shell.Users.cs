namespace Codestead.Shell;

// Shell: the current user, sudo (RunAs), home, path resolving and the simulator's own messages.

public partial class Shell
{
    // ---------- Users ----------

    /// <summary>The user according to /etc/passwd and /etc/group (see Users/UsersLib.cs).</summary>
    public User GetUser(string name) => UsersLib.LookupUser(this, name);

    public User RootUser() => GetUser("root");

    public User CurrentUser() => GetUser(overrides.Count > 0 ? overrides[^1] : UserStack.Count > 0 ? UserStack[^1] : World.User);

    /// <summary>Runs fn as another user (used by sudo).</summary>
    public T RunAs<T>(string user, Func<T> fn)
    {
        overrides.Add(user);
        try
        {
            return fn();
        }
        finally
        {
            overrides.RemoveAt(overrides.Count - 1);
        }
    }

    public string Home => Env.TryGetValue("HOME", out var h) ? h : World.Home;

    public string Resolve(string path) => VfsLib.ResolvePath(Cwd, path);

    /// <summary>The simulator's own message <paramref name="key"/> in the shell's language (see <see cref="ShellI18n"/>).</summary>
    public string Msg(string key, params (string Name, object? Value)[] args) => ShellI18n.Msg(Lang, key, args);

    /// <summary>A whole number formatted for the shell's language (10 000, 10,000, 10.000 ...).</summary>
    public string FormatNumber(long n) => n.ToString("N0", ShellI18n.Culture(Lang));

    public void RequestClear() => clearRequested = true;
}
