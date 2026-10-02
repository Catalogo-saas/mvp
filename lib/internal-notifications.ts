import { toast } from "sonner";

export function notifySuccess(message: string) {
  toast.success(message, { duration: 4000 });
}

export function notifyError(message: string) {
  toast.error(message, { duration: 6000 });
}

export function notifyWarning(message: string) {
  toast.warning(message, { duration: 6000 });
}
