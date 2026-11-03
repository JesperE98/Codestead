using static Codestead.Shell.NetworkLib;

namespace Codestead.Shell.Commands;

// The ip command: show and manipulate network interfaces, addresses and routes.

public static partial class NetCmd
{
    private static readonly string[] IpObjects = { "address", "route", "link", "neighbour", "neighbor", "help" };

    private static int IpAddr(CmdCtx ctx, bool brief, bool only4, string? dev)
    {
        var list = Interfaces(ctx.Sh).Where(i => string.IsNullOrEmpty(dev) || i.Name == dev).ToList();
        if (!string.IsNullOrEmpty(dev) && list.Count == 0)
        {
            ctx.Err($"Device \"{dev}\" does not exist.\n");
            return 1;
        }
        foreach (var i in list)
        {
            if (brief)
            {
                var addrs = i.Inet.Select(a => $"{a.Addr}/{a.Prefix}").ToList();
                if (!only4) addrs.AddRange(i.Inet6.Select(a => $"{a.Addr}/{a.Prefix}"));
                ctx.Out($"{i.Name.PadRight(16)} {i.State.PadRight(14)} {string.Join(" ", addrs)} \n");
                continue;
            }
            ctx.Out($"{i.Index}: {i.Name}: <{i.Flags}> mtu {i.Mtu} qdisc {i.Qdisc} state {i.State} group default qlen 1000\n");
            if (!only4) ctx.Out($"    link/{i.LinkType} {i.Mac} brd {i.Brd}\n");
            foreach (var a in i.Inet)
            {
                ctx.Out($"    inet {a.Addr}/{a.Prefix}{(!string.IsNullOrEmpty(a.Brd) ? $" brd {a.Brd}" : "")} scope {a.Scope}{(a.Extra != "" ? " " + a.Extra : "")} {i.Name}\n");
                ctx.Out($"       valid_lft {a.Lft} preferred_lft {a.Lft}\n");
            }
            if (only4) continue;
            foreach (var a in i.Inet6)
            {
                ctx.Out($"    inet6 {a.Addr}/{a.Prefix} scope {a.Scope} {a.Extra} \n");
                ctx.Out("       valid_lft forever preferred_lft forever\n");
            }
        }
        return 0;
    }

    private static int IpLink(CmdCtx ctx, bool brief, List<string> args)
    {
        var sh = ctx.Sh;
        var cmd = args.Count > 0 ? args[0] : "show";
        var words = args.Skip(1).Where(w => w != "dev").ToList();
        if (cmd == "set")
        {
            var setDev = words.At(0);
            var state = words.At(1);
            if (string.IsNullOrEmpty(setDev) || !Interfaces(sh).Any(i => i.Name == setDev))
            {
                ctx.Err(!string.IsNullOrEmpty(setDev) ? $"Cannot find device \"{setDev}\"\n" : "Not enough information: \"dev\" argument is required.\n");
                return 1;
            }
            if (state != "up" && state != "down")
            {
                ctx.Err($"Error: either \"dev\" is duplicate, or \"{state ?? ""}\" is a garbage.\n");
                return 255;
            }
            if (!IsRoot(ctx))
            {
                ctx.Err("RTNETLINK answers: Operation not permitted\n");
                return 2;
            }
            if (setDev == NetworkLib.Iface) SetLinkUp(sh, state == "up");
            return 0;
        }
        if (cmd != "show" && cmd != "list" && cmd != "ls")
        {
            ctx.Err($"Command \"{cmd}\" is unknown, try \"ip link help\".\n");
            return 255;
        }
        var dev = words.At(0);
        var list = Interfaces(sh).Where(i => string.IsNullOrEmpty(dev) || i.Name == dev).ToList();
        if (!string.IsNullOrEmpty(dev) && list.Count == 0)
        {
            ctx.Err($"Device \"{dev}\" does not exist.\n");
            return 1;
        }
        foreach (var i in list)
        {
            if (brief)
            {
                ctx.Out($"{i.Name.PadRight(16)} {i.State.PadRight(14)} {i.Mac} <{i.Flags}> \n");
                continue;
            }
            ctx.Out($"{i.Index}: {i.Name}: <{i.Flags}> mtu {i.Mtu} qdisc {i.Qdisc} state {i.State} mode DEFAULT group default qlen 1000\n");
            ctx.Out($"    link/{i.LinkType} {i.Mac} brd {i.Brd}\n");
        }
        return 0;
    }

    private static int IpRoute(CmdCtx ctx, List<string> args)
    {
        var sh = ctx.Sh;
        var cmd = args.Count > 0 ? args[0] : "show";
        var target = args.At(1);
        if (cmd == "show" || cmd == "list" || cmd == "ls")
        {
            foreach (var r in Routes(sh)) ctx.Out(r + " \n");
            return 0;
        }
        if (cmd == "get")
        {
            if (string.IsNullOrEmpty(target) || !IsIPv4(target))
            {
                ctx.Err($"Error: inet prefix is expected rather than \"{target ?? ""}\".\n");
                return 1;
            }
            var uid = sh.CurrentUser().Uid;
            if (target.StartsWith("127.", StringComparison.Ordinal) || target == MyIp(sh))
            {
                ctx.Out($"local {target} dev lo src {(target.StartsWith("127.", StringComparison.Ordinal) ? "127.0.0.1" : target)} uid {uid} \n    cache <local> \n");
                return 0;
            }
            if (!LinkUp(sh))
            {
                ctx.Err("RTNETLINK answers: Network is unreachable\n");
                return 2;
            }
            var via = target.StartsWith("192.168.1.", StringComparison.Ordinal) ? "" : $"via {Gateway} ";
            ctx.Out($"{target} {via}dev {NetworkLib.Iface} src {MyIp(sh)} uid {uid} \n    cache \n");
            return 0;
        }
        if (new[] { "add", "del", "delete", "change", "replace", "flush" }.Contains(cmd))
        {
            if (!IsRoot(ctx))
            {
                ctx.Err("RTNETLINK answers: Operation not permitted\n");
                return 2;
            }
            Note(ctx, "net.routeChangeUnsupported");
            return 1;
        }
        ctx.Err($"Command \"{cmd}\" is unknown, try \"ip route help\".\n");
        return 255;
    }

    private static readonly CommandDef Ip = new()
    {
        Name = "ip",
        Summary = "Visar och ändrar nätverksgränssnitt, adresser och rutter",
        SummaryEn = "Show and manipulate network interfaces, addresses and routes",
        Man = """
            NAMN
                   ip - visa och ändra nätverksinställningar

            SYNOPSIS
                   ip [-br] [-4] OBJEKT [KOMMANDO]

            BESKRIVNING
                   ip kommer från paketet iproute2 (iproute i Fedora) och har ersatt
                   de gamla kommandona ifconfig och route. Objektet kan förkortas.

            OBJEKT
                   address (a)    IP-adresser på gränssnitten
                   link (l)       gränssnitten själva (nätverkskorten)
                   route (r)      routingtabellen – bl.a. standard-gatewayen
                   neigh (n)      grannar i det lokala nätet (ARP-tabellen)

            FLAGGOR
                   -br      kort format, en rad per gränssnitt
                   -4       bara IPv4

            EXEMPEL
                   ip a                        visa alla adresser
                   ip -br a                    kort översikt
                   ip route                    visa rutter och gateway
                   ip route get 1.1.1.1        vilken väg tar paketen dit?
                   sudo ip link set enp0s3 down   stäng av nätverkskortet
                   sudo ip link set enp0s3 up     sätt på det igen
            """,
        ManEn = """
            NAME
                   ip - show and manipulate network settings

            SYNOPSIS
                   ip [-br] [-4] OBJECT [COMMAND]

            DESCRIPTION
                   ip comes from the iproute2 package (iproute on Fedora) and replaces
                   the old ifconfig and route commands. Objects may be abbreviated.

            OBJECTS
                   address (a)    IP addresses on the interfaces
                   link (l)       the interfaces themselves (network cards)
                   route (r)      the routing table – including the default gateway
                   neigh (n)      neighbours on the local network (ARP table)

            OPTIONS
                   -br      brief output, one line per interface
                   -4       IPv4 only

            EXAMPLES
                   ip a                        show all addresses
                   ip -br a                    short overview
                   ip route                    show routes and the gateway
                   ip route get 1.1.1.1        which way do packets go?
                   sudo ip link set enp0s3 down   turn the network card off
                   sudo ip link set enp0s3 up     turn it on again
            """,
        Run = ctx =>
        {
            var args = new List<string>(ctx.Args);
            bool brief = false;
            bool only4 = false;
            while (args.Count > 0 && args[0].StartsWith('-'))
            {
                var f = args[0];
                args.RemoveAt(0);
                if (f == "-br" || f == "-brief" || f == "--brief") brief = true;
                else if (f == "-4") only4 = true;
                else if (new[] { "-6", "-c", "-color", "--color", "-s", "-d", "-details" }.Contains(f) || f.StartsWith("-color=", StringComparison.Ordinal) || f.StartsWith("--color=", StringComparison.Ordinal)) continue;
                else if (f == "-V" || f == "-Version")
                {
                    ctx.Out("ip utility, iproute2-6.14.0, libbpf 1.5.0\n");
                    return 0;
                }
                else
                {
                    ctx.Err($"Option \"{f}\" is unknown, try \"ip -help\".\n");
                    return 255;
                }
            }
            string? objWord = null;
            if (args.Count > 0)
            {
                objWord = args[0];
                args.RemoveAt(0);
            }
            if (string.IsNullOrEmpty(objWord))
            {
                ctx.Err("Usage: ip [ OPTIONS ] OBJECT { COMMAND | help }\nwhere  OBJECT := { address | link | neighbour | route | ... }\n       OPTIONS := { -4 | -6 | -br[ief] | -c[olor] | -s[tatistics] | ... }\n");
                return 255;
            }
            var obj = IpObjects.FirstOrDefault(o => o.StartsWith(objWord, StringComparison.Ordinal));
            switch (obj)
            {
                case "address":
                {
                    var cmd = args.Count > 0 ? args[0] : "show";
                    var rest = args.Skip(1).ToList();
                    if (cmd == "show" || cmd == "list" || cmd == "ls") return IpAddr(ctx, brief, only4, rest.Where(w => w != "dev").ToList().At(0));
                    if (new[] { "add", "del", "delete", "flush", "change", "replace" }.Contains(cmd))
                    {
                        if (!IsRoot(ctx))
                        {
                            ctx.Err("RTNETLINK answers: Operation not permitted\n");
                            return 2;
                        }
                        Note(ctx, "net.addressChangeUnsupported");
                        return 1;
                    }
                    ctx.Err($"Command \"{cmd}\" is unknown, try \"ip address help\".\n");
                    return 255;
                }
                case "link":
                    return IpLink(ctx, brief, args);
                case "route":
                    return IpRoute(ctx, args);
                case "neighbour":
                case "neighbor":
                    foreach (var n in Neighbours(ctx.Sh)) ctx.Out(n + " \n");
                    return 0;
                case "help":
                    ctx.Out("Usage: ip [ OPTIONS ] OBJECT { COMMAND | help }\nwhere  OBJECT := { address | link | neighbour | route | ... }\n");
                    return 0;
                default:
                    ctx.Err($"Object \"{objWord}\" is unknown, try \"ip help\".\n");
                    return 1;
            }
        },
    };
}
