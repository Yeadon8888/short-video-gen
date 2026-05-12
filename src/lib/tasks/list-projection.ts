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
    | "modelId"
  >,
  "paramsJson"
> & {
  paramsJson: TaskListParams | null;
  resultUrlCount: number;
  /**
   * 当任务处于 ASAP 队列（status='scheduled' AND scheduledAt IS NULL）时，
   * 同模型同队列中比本任务更早创建的排队数。非排队任务始终为 0。
   * 仅用于 UI 展示"前面还有 N 个"。
   */
  queueAhead: number;
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
  modelId: tasks.modelId,
  resultUrlCount: sql<number>`
    coalesce(jsonb_array_length(coalesce(${tasks.resultUrls}, '[]'::jsonb)), 0)
  `,
  /**
   * 仅对 ASAP 队列任务（status='scheduled' AND scheduled_at IS NULL）有意义。
   * 同模型下 createdAt 更早的排队任务数。其余情况返回 0。
   */
  queueAhead: sql<number>`
    case when ${tasks.status} = 'scheduled' and ${tasks.scheduledAt} is null
      then (
        select count(*)::int from ${tasks} t2
        where t2.status = 'scheduled' and t2.scheduled_at is null
          and t2.model_id = ${tasks.modelId}
          and t2.created_at < ${tasks.createdAt}
      )
      else 0
    end
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
