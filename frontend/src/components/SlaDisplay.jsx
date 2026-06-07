import { useEffect, useState } from 'react';

export default function SlaDisplay({ deadline }) {
  const [timeLeft, setTimeLeft] = useState('');
  const [breached, setBreached] = useState(false);

  useEffect(() => {
    if (!deadline) return;
    
    function update() {
      const target = new Date(deadline).getTime();
      const now = Date.now();
      const diff = target - now;
      
      if (diff <= 0) {
        setBreached(true);
        setTimeLeft('SLA Breached');
      } else {
        setBreached(false);
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        if (hours > 0) {
          setTimeLeft(`${hours}h ${mins}m left`);
        } else {
          setTimeLeft(`${mins}m left`);
        }
      }
    }
    
    update();
    const interval = setInterval(update, 60000); // update every minute
    return () => clearInterval(interval);
  }, [deadline]);

  if (!deadline) return <span className="sla-ok">—</span>;

  return (
    <span className={breached ? 'sla-breached' : 'sla-ok'}>
      {breached && <span style={{fontSize: '1.1em'}}>⚠</span>}
      {!breached && <span style={{fontSize: '1.1em', opacity: 0.7}}>⏱</span>}
      {timeLeft}
    </span>
  );
}
