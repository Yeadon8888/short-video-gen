import { sql } from "drizzle-orm";
import {
  taskGroups,
  tasks,
  type Task,
  type TaskGroup,
} from "@/lib/db/schema";
import type { TaskParamsSnapshot } from "@/lib/video/types";

type TaskListParams = Pick<
  TaskParamsSnapshot,
  "sourceMode" | "count" | "batchUnitsPerProduct"
>;

export type TaskListTask = Omit<
  Pick<
    Task,
    | "id"
    | "type"
    | "status"
    | "inputText"
    | "creditsCost"
    | "paramsJson"
    | "errorMessage"
    | "scheduledAt"
    | "createdAt"
    | "requestedCount"
  >,
  "paramsJson"
> & {
  paramsJson: TaskListParams | null;
  resultUrlCount: number;
};

export type TaskListGroup = Pick<
  TaskGroup,
  | "id"
  | "status"
  | "title"
  | "batchTheme"
  | "requestedCount"
  | "successCount"
  | "errorMessage"
  | "createdAt"
>;

const integerJsonField = (field: "count" | "batchUnitsPerProduct") => sql`
  case
    when (${tasks.paramsJson}->>${field}) ~ '^-?[0-9]+$'
    then (${tasks.paramsJson}->>${field})::int
    else null
  end
`;

export const taskListTaskColumns = {
  id: tasks.id,
  type: tasks.type,
  status: tasks.status,
  inputText: tasks.inputText,
  creditsCost: tasks.creditsCost,
  paramsJson: sql<TaskListParams | null>`
    jsonb_strip_nulls(jsonb_build_object(
      'sourceMode', ${tasks.paramsJson}->>'sourceMode',
      'count', ${integerJsonField("count")},
      'batchUnitsPerProduct', ${integerJsonField("batchUnitsPerProduct")}
    ))
  `,
  errorMessage: tasks.errorMessage,
  scheduledAt: tasks.scheduledAt,
  createdAt: tasks.createdAt,
  requestedCount: tasks.requestedCount,
  resultUrlCount: sql<number>`
    coalesce(jsonb_array_length(coalesce(${tasks.resultUrls}, '[]'::jsonb)), 0)
  `,
};

export const taskListGroupColumns = {
  id: taskGroups.id,
  status: taskGroups.status,
  title: taskGroups.title,
  batchTheme: taskGroups.batchTheme,
  requestedCount: taskGroups.requestedCount,
  successCount: taskGroups.successCount,
  errorMessage: taskGroups.errorMessage,
  createdAt: taskGroups.createdAt,
};
