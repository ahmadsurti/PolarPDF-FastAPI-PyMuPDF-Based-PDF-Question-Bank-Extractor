import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  // Merge Tailwind classes intelligently, handling conditional classnames via clsx
  return twMerge(clsx(...inputs))
}
