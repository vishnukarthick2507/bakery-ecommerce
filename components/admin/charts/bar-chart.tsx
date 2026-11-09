'use client'

import { useCallback, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

type BarChartPoint = { label: string; value: number }

interface BarChartProps {
  data: BarChartPoint[]
  width?: number
  height?: number
  color?: string
  showLabels?: boolean
  showTooltip?: boolean
  animate?: boolean
  horizontal?: boolean
}

export function BarChart({
  data,
  width = 400,
  height = 200,
  color = '#17243A',
  showLabels = true,
  showTooltip = true,
  animate = true,
  horizontal = false,
}: BarChartProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [tooltip, setTooltip] = useState<{ x: number; y: number; value: number; label: string } | null>(null)

  const [svgWidth, setSvgWidth] = useState(width)
  const [svgHeight, setSvgHeight] = useState(height)

  const maxValue = Math.max(...data.map((d) => d.value), 1)
  const barCount = data.length
  const barWidth = horizontal ? 20 : svgWidth / barCount / 2
  const barGap = horizontal ? 10 : svgWidth / barCount / 2

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      if (!showTooltip || !containerRef.current || data.length === 0) return
      const rect = containerRef.current.getBoundingClientRect()
      const mouseX = e.clientX - rect.left
      const closestIndex = horizontal
        ? Math.min(
            barCount - 1,
            Math.max(0, Math.round(((svgHeight - mouseX) / svgHeight) * (barCount - 1))),
          )
        : Math.min(
            barCount - 1,
            Math.max(0, Math.round((mouseX / svgWidth) * (barCount - 1))),
          )
      const point = data[closestIndex]
      const x = horizontal
        ? svgHeight - (closestIndex / (barCount - 1)) * svgHeight - barWidth / 2
        : (closestIndex / (barCount - 1)) * svgWidth + barWidth / 2
      const y = horizontal
        ? svgWidth / 2
        : svgHeight - (point.value / maxValue) * (svgHeight - 40) - 10
      setTooltip({ x, y, value: point.value, label: point.label })
    },
    [data, svgWidth, svgHeight, maxValue, barCount, barWidth, showTooltip, horizontal],
  )

  const handleMouseLeave = useCallback(() => {
    setTooltip(null)
  }, [])

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
        {data.map((point, i) => {
          const barHeight = (point.value / maxValue) * (svgHeight - 60)
          const x = horizontal
            ? svgHeight - (i / (barCount - 1)) * svgHeight - barWidth
            : i * (barWidth + barGap)
          const y = horizontal
            ? svgWidth / 2 - barWidth / 2
            : svgHeight - 40 - barHeight
          const isHovered =
            tooltip &&
            i ===
              Math.min(
                barCount - 1,
                Math.max(
                  0,
                  horizontal
                    ? Math.round(((svgHeight - tooltip.x) / svgHeight) * (barCount - 1))
                    : Math.round((tooltip.x / svgWidth) * (barCount - 1)),
                ),
              )

          return (
            <g key={i}>
              <rect
                x={x}
                y={y}
                width={horizontal ? barHeight : barWidth}
                height={horizontal ? barWidth : barHeight}
                fill={isHovered ? '#B28C52' : color}
                rx={horizontal ? 4 : 2}
                ry={horizontal ? 2 : 4}
                className={animate ? 'opacity-0 animate-in fade-in duration-300' : ''}
                style={{
                  animationDelay: `${i * 60}ms`,
                  animationFillMode: 'forwards',
                }}
              />
              {showLabels && !horizontal && (
                <text
                  x={x + barWidth / 2}
                  y={svgHeight - 25}
                  fill="#747B86"
                  fontSize={10}
                  textAnchor="middle"
                  fontWeight={500}
                >
                  {point.label}
                </text>
              )}
              {showLabels && horizontal && (
                <text
                  x={svgHeight - (i / (barCount - 1)) * svgHeight - 8}
                  y={svgWidth / 2 + 4}
                  fill="#747B86"
                  fontSize={10}
                  textAnchor="end"
                  dominantBaseline="middle"
                  fontWeight={500}
                >
                  {point.label}
                </text>
              )}
            </g>
          )
        })}
      </svg>
    </div>
  )
}
