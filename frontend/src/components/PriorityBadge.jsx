import React from 'react';

export default function PriorityBadge({ priority }) {
  const p = priority || 'Low';
  const colorClass = 
    p === 'Urgent' ? 'badge-fintech-urgent' :
    p === 'High'   ? 'badge-fintech-high' :
    p === 'Medium' ? 'badge-fintech-medium' :
    'badge-fintech-low';
    
  return (
    <span className={`badge-fintech ${colorClass}`}>
      {p}
    </span>
  );
}
