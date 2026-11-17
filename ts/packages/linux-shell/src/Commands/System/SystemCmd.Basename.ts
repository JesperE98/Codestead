// Port of Commands/System/SystemCmd.Basename.cs – the basename command: strips the directory part from a path.

import * as VfsLib from "../../Vfs/VfsLib.js";
import * as UtilCmd from "../Util/UtilCmd.js";
import { simple } from "./SystemCmd.js";

export const basenameCmd = simple("basename", "Tar bort katalogdelen från en sökväg", (ctx) => {
  if (ctx.args.length === 0) return UtilCmd.badOption(ctx, "missing operand");
  let b = VfsLib.basename(ctx.args[0]!);
  const suffix = ctx.args.length > 1 ? ctx.args[1]! : "";
  if (suffix !== "" && b.endsWith(suffix) && b !== suffix) b = b.slice(0, b.length - suffix.length);
  ctx.out(b + "\n");
  return 0;
});
