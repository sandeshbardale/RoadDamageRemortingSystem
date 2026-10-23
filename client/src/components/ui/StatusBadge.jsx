import React from 'react'
import { STATUS_LABELS, STATUS_COLORS } from '../../utils/helpers'

export default function StatusBadge({ status }) {
  const cls = STATUS_COLORS[status] || 'badge-closed'
  return <span className={cls}>{STATUS_LABELS[status] || status}</span>
}
