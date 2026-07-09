import { useEffect, useRef } from 'react';
import { Chart, type ChartConfiguration, type ChartType } from 'chart.js/auto';

Chart.defaults.font.family = "'Inter',system-ui,sans-serif";
Chart.defaults.font.size = 11.5;
Chart.defaults.color = '#64748b';

export default function ChartCanvas<TType extends ChartType = ChartType>({ config, height }: { config: ChartConfiguration<TType>; height?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart<TType> | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    chartRef.current = new Chart(canvasRef.current, config);
    return () => chartRef.current?.destroy();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(config)]);

  return <canvas ref={canvasRef} height={height || 90}></canvas>;
}
