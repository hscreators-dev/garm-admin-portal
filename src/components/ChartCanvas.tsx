import { useEffect, useRef } from 'react';
import { Chart, type ChartConfiguration, type ChartType } from 'chart.js/auto';

Chart.defaults.font.family = "'DM Sans',system-ui,sans-serif";
Chart.defaults.font.size = 11.5;
Chart.defaults.color = '#888580';

export default function ChartCanvas<TType extends ChartType = ChartType>({ config, height }: { config: ChartConfiguration<TType>; height?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart<TType> | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    chartRef.current = new Chart(canvasRef.current, config);
    return () => chartRef.current?.destroy();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(config)]);

  // A FIXED-HEIGHT wrapper is essential: charts use maintainAspectRatio:false +
  // responsive:true, so Chart.js sizes the canvas to its parent. Without a bounded
  // parent it re-measures and grows on every resize ("the graph goes on forever").
  return (
    <div style={{ position: 'relative', height: height || 90, width: '100%' }}>
      <canvas ref={canvasRef}></canvas>
    </div>
  );
}
