
// Re-export the toast hooks directly from the Radix UI toast package
import {
  useToast as useToastPrimitive,
  toast as toastPrimitive,
} from "@/components/ui/toast"

// Re-export as our own hooks
export const useToast = useToastPrimitive
export const toast = toastPrimitive
