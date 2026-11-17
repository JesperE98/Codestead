// Port of Commands/System/SystemCmd.Dirname.cs – the dirname command: strips the file name from a path.

import * as VfsLib from "../../Vfs/VfsLib.js";
import * as UtilCmd from "../Util/UtilCmd.js";
import { simple } from "./SystemCmd.js";

export const dirnameCmd = simple("dirname", "Tar bort filnamnet från en sökväg", (ctx) => {
  if (ctx.args.length === 0) return UtilCmd.badOption(ctx, "missing operand");
  const p = ctx.args[0]!;
  let result: string;
  if (!p.includes("/")) result = ".";
  else if (p.startsWith("/")) result = VfsLib.dirname(p);
  else {
    const d = VfsLib.dirname("/" + p).slice(1);
    result = d !== "" ? d : ".";
  }
  ctx.out(result + "\n");
  return 0;
});
