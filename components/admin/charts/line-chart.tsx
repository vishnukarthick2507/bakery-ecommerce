'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { cn } from '@/lib/utils'

export type LineChartPoint = { date: string; value: number; label?: string }

interface LineChartProps {
  data: LineChartPoint[]
  width?: number
  height?: number
  color?: string
  showPoints?: boolean
  showArea?: boolean
  showGrid?: boolean
  showTooltip?: boolean
  animate?: boolean
}

export function LineChart({
  data,
  width = 400,
  height = 200,
  color = '#17243A',
  showPoints = true,
  showArea = true,
  showGrid = true,
  showTooltip = true,
  animate = true,
}: LineChartProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [tooltip, setTooltip] = useState<{ x: number; y: number; value: number; label: string } | null>(null)

  const [svgWidth, setSvgWidth] = useState(width)
  const [svgHeight, setSvgHeight] = useState(height)

  const getPoint = useCallback((point: LineChartPoint, index: number, total: number) => {
    const x = total === 1 ? svgWidth / 2 : (index / (total - 1)) * svgWidth
    const maxValue = Math.max(...data.map((d) => d.value), 1)
    const y = svgHeight - (point.value / maxValue) * (svgHeight - 40)
    return { x, y }
  }, [data, svgWidth, svgHeight])

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      if (!showTooltip || !containerRef.current || data.length === 0) return
      const rect = containerRef.current.getBoundingClientRect()
      const mouseX = e.clientX - rect.left
      const total = data.length
      const closestIndex = Math.min(
        total - 1,
        Math.max(0, Math.round((mouseX / svgWidth) * (total - 1))),
      )
      const point = data[closestIndex]
      const { x, y } = getPoint(point, closestIndex, total)
      setTooltip({ x, y: y - 10, value: point.value, label: point.label || point.date })
    },
    [data, svgWidth, showTooltip, getPoint],
  )

  const handleMouseLeave = useCallback(() => {
    setTooltip(null)
  }, [])

  const maxValue = Math.max(...data.map((d) => d.value), 1)

  return (
    <div
      ref={containerRef}
      className={cn('w-full h-full', animate && 'animate-in fade-in duration-300')}
      style={{ width, height }}
    >
      <svg
        width={svgWidth}
        height={svgHeight}
        className="w-full h-full"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        style={{ overflow: 'visible' }}
      >
        {showGrid && (
          <g className="text-muted-foreground/30">
            {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
              const y = svgHeight - 40 - ratio * (svgHeight - 80)
              const value = Math.round(maxValue * ratio)
              return (
                <g key={ratio}>
                  <line
                    x1="0"
                    y1={y}
                    x2={svgWidth}
                    y2={y}
                    stroke="#E8E2D8"
                    strokeWidth={1}
                  />
                  <text
                    x={6}
                    y={y + 4}
                    fill="#747B86"
                    fontSize={11}
                    fontWeight={500}
                  >
                    {value}
                  </text>
                </g>
              )
            })}
          </g>
        )}

        {showArea && (
          <path
            d={data.length > 0
              ? [
                  `M 0 ${svgHeight - 40}`,
                  ...data.map((_, i) => {
                    const { x, y } = getPoint(data[i], i, data.length)
                    return `L ${x} ${y}`
                  }),
                  `L ${svgWidth} ${svgHeight - 40}`,
                  `Z`,
                ].join(' ')
              : ''}
            fill={`${color}20`}
            stroke="none"
          />
        )}

        <path
          d={data.length > 1
            ? data
                .map((_, i) => {
                  const { x, y } = getPoint(data[i], i, data.length)
                  return `${i === 0 ? 'M' : 'L'} ${x} ${y}`
                })
                .join(' ')
            : ''}
          fill="none"
          stroke={color}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          className={animate ? 'stroke-dasharray-[300] stroke-dashoffset-[300] animate-[draw_1.5s_ease-out_forwards]' : ''}
        />

        {showPoints && data.length > 0 && (
          <g>
            {data.map((point, i) => {
              const { x, y } = getPoint(point, i, data.length)
              const isHovered =
                tooltip &&
                i ===
                  Math.min(
                    data.length - 1,
                    Math.max(0, Math.round((tooltip.x / svgWidth) * (data.length - 1))),
                  )
              return (
                <circle
                  key={i}
                  cx={x}
                  cy={y}
                  r={isHovered ? 5 : 3}
                  fill={color}
                  stroke="#ffffff"
                  strokeWidth={2}
                  className={animate ? 'opacity-0 animate-in fade-in duration-300' : ''}
                  style={{
                    animationDelay: `${i * 50}ms`,
                    animationFillMode: 'forwards',
                  }}
                />
              )
            })}
          </g>
        )}

        <g>
          {data.map((point, i) => (
            <text
              key={i}
              x={getPoint(point, i, data.length).x}
              y={svgHeight - 8}
              fill="#747B86"
              fontSize={10}
              textAnchor="middle"
              fontWeight={500}
            >
              {point.date}
            </text>
          ))}
        </g>

        {tooltip && (
          <foreignObject
            x={tooltip.x - 60}
            y={tooltip.y}
            width={120}
            height={40}
            className="pointer-events-none"
          >
            <div
              className={cn(
                'flex items-center gap-2 rounded-lg border border-gold-border bg-white px-3 py-2 text-xs font-medium text-primary shadow-lg',
                animate && 'animate-in fade-in duration-200',
              )}
            >
              <span className={`w-2 h-2 rounded-full bg-${color}`} />
              <span>{tooltip.label}</span>
              <span className="ml-auto">{tooltip.value}</span>
            </div>
          </foreignObject>
        )}
      </svg>
    </div>
  )
}
