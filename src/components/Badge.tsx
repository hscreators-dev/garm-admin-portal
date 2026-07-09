import { toneFor } from '../data/mockData';

export default function Badge({ status }: { status: string }) {
  return (
    <span className={`badge tone-${toneFor(status)}`}>
      <span className="dot"></span>{status.replace(/_/g, ' ')}
    </span>
  );
}
