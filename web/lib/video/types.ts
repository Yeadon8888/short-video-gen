export interface VideoParams {
  prompt: string;
  imageUrls?: string[];
  orientation: "portrait" | "landscape";
  duration: 10 | 15;
  count: number;
}

export interface TaskResult {
  taskId: string;
  success: boolean;
  status: string;
  url?: string;
  failReason?: string;
}
