import {
  useOptionalLessonController,
  type LessonController,
} from "@/components/learn/lesson-controller";

/** The lesson controller of the provider a test renders, which it needs. */
export function useLessonController(): LessonController {
  const controller = useOptionalLessonController();
  if (controller === null)
    throw new Error("The test renders no LessonControllerProvider");
  return controller;
}
