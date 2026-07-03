import type { OrderStatus } from '@/lib/types'

export const STATUS_TONE: Record<OrderStatus, string> = {
  received: 'gray',
  in_stitching: 'blue',
  ready_for_pickup: 'amber',
  delivered: 'green',
  cancelled: 'red'
}

export const STATUS_FLOW: OrderStatus[] = [
  'received',
  'in_stitching',
  'ready_for_pickup',
  'delivered',
  'cancelled'
]
