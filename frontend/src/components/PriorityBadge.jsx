import React from 'react';

export default function PriorityBadge({ priority }) {
  const p = priority || 'Low';
  const colorClass = 
    p === 'Urgent' ? 'badge-urgent' :
    p === 'High'   ? 'badge-high' :
    p === 'Medium' ? 'badge-medium' :
    'badge-low';
    
  return (
    <span className={`badge ${colorClass}`}>
      {p}
    </span>
  );
}
