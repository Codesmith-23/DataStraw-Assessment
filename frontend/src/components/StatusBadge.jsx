/**
 * components/StatusBadge.jsx
 * Renders a coloured pill badge for a ticket status.
 */
import { statusClass, statusLabel } from '../utils';

export default function StatusBadge({ status }) {
  const cls = statusClass(status);
  return (
    <span className={`badge badge-${cls}`}>
      <span className="badge-dot" />
      {statusLabel(status)}
    </span>
  );
}
