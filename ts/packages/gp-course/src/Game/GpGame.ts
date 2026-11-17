import { GameRules } from "@codestead/learning";
import { GpCourse } from "../GpCourse.js";
import { GpAchievements } from "./GpAchievements.js";

let rules: GameRules | null = null;

/** The learning engine set up for the Codestead GP course. */
export const GpGame = {
  get rules(): GameRules {
    return (rules ??= new GameRules(GpCourse.outline, GpAchievements.all));
  },
};
