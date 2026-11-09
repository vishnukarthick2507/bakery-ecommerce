'use client'

import { useCallback, useState } from 'react'
import { cn } from '@/lib/utils'

type DonutChartPoint = { label: string; value: number; color?: string }

interface DonutChartProps {
  data: DonutChartPoint[]
  width?: number
  height?: number
  showLabels?: boolean
  showLegend?: boolean
  animate?: boolean
}

const defaultColors = ['#17243A', '#C6A46A', '#536B60', '#B28C52', '#E8E2D8']

export function DonutChart({
  data,
  width = 200,
  height = 200,
  showLabels = true,
  showLegend = true,
  animate = true,
}: DonutChartProps) {
  const [tooltip, setTooltip] = useState<{ label: string; value: number; percentage: number } | null>(null)

  const total = data.reduce((sum, d) => sum + d.value, 0)
  const centerX = width / 2
  const centerY = height / 2
  const radius = Math.min(width, height) / 2 - 20
  const innerRadius = radius * 0.6

  const getSlicePath = useCallback(
    (startAngle: number, endAngle: number, r: number) => {
      const startX = centerX + r * Math.cos(startAngle)
      const startY = centerY + r * Math.sin(startAngle)
      const endX = centerX + r * Math.cos(endAngle)
      const endY = centerY + r * Math.sin(endAngle)
      const largeArcFlag = endAngle - startAngle <= Math.PI ? 0 : 1
      return `M ${startX} ${startY} A ${r} ${r} 0 ${largeArcFlag} 1 ${endX} ${endY} L ${centerX} ${centerY} Z`
    },
    [centerX, centerY],
  )

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      const rect = e.currentTarget.getBoundingClientRect()
      const mouseX = e.clientX - rect.left - centerX
      const mouseY = e.clientY - rect.top - centerY
      const angle = Math.atan2(mouseY, mouseX)
      const adjustedAngle = angle < 0 ? angle + 2 * Math.PI : angle

      let currentAngle = -Math.PI / 2
      for (const point of data) {
        const sliceAngle = (point.value / total) * 2 * Math.PI
        if (adjustedAngle >= currentAngle && adjustedAngle <= currentAngle + sliceAngle) {
          const percentage = ((point.value / total) * 100).toFixed(1)
          setTooltip({ label: point.label, value: point.value, percentage: parseFloat(percentage) })
          return
        }
        currentAngle += sliceAngle
      }
      setTooltip(null)
    },
    [data, total, centerX, centerY],
  )

  const handleMouseLeave = useCallback(() => {
    setTooltip(null)
  }, [])

  return (
    <div className={cn('flex flex-col items-center justify-center', animate && 'animate-in fade-in duration-300')}>
      <div className="relative" style={{ width, height }}>
        <svg
          width={width}
          height={height}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          style={{ overflow: 'visible' }}
        >
          <g>
            {data.map((point, i) => {
              const startAngle = -Math.PI / 2 + (data.slice(0, i).reduce((sum, d) => sum + d.value, 0) / total) * 2 * Math.PI
              const endAngle = startAngle + (point.value / total) * 2 * Math.PI
              const sliceColor = point.color || defaultColors[i % defaultColors.length]

              return (
                <path
                  key={i}
                  d={getSlicePath(startAngle, endAngle, radius)}
                  fill={sliceColor}
                  className={animate ? 'opacity-0 animate-in fade-in duration-300' : ''}
                  style={{
                    animationDelay: `${i * 80}ms`,
                    animationFillMode: 'forwards',
                  }}
                />
              )
            })}
          </g>

          {/* Inner circle for donut effect */}
          <circle
            cx={centerX}
            cy={centerY}
            r={innerRadius}
            fill="#ffffff"
          />

          {/* Center text */}
          <text
            x={centerX}
            y={centerY - 4}
            fill="#17243A"
            fontSize={14}
            fontWeight={700}
            textAnchor="middle"
            fontFamily="var(--font-playfair), ui-serif, Georgia, serif"
          >
            {total}
          </text>
          <text
            x={centerX}
            y={centerY + 16}
            fill="#747B86"
            fontSize={11}
            textAnchor="middle"
          >
            {showLabels && data.length === 1 ? data[0].label : 'Total'}
          </text>
        </svg>
      </div>

      {showLegend && data.length > 1 && (
        <div className="mt-6 flex flex-wrap justify-center gap-6">
          {data.map((point, i) => {
            const sliceColor = point.color || defaultColors[i % defaultColors.length]
            const percentage = ((point.value / total) * 100).toFixed(1)
            return (
              <div
                key={i}
                className="flex items-center gap-2 text-sm"
                onMouseEnter={() => setTooltip({ label: point.label, value: point.value, percentage: parseFloat(percentage) })}
                onMouseLeave={() => setTooltip(null)}
              >
                <span className={`w-3 h-3 rounded-full`} style={{ backgroundColor: sliceColor }} />
                <span className="text-secondary-text">{point.label}</span>
                <span className="text-muted-foreground font-medium">{percentage}%</span>
              </div>
            )
          })}
        </div>
      )}

      {tooltip && (
        <div className="mt-4 flex items-center gap-2 rounded-lg border border-gold-border bg-white px-3 py-2 text-xs font-medium text-primary shadow-lg">
          <span className={`w-2 h-2 rounded-full bg-${defaultColors[0]}`} />
          <span>{tooltip.label}</span>
          <span className="ml-auto">{tooltip.value} ({tooltip.percentage}%)</span>
        </div>
      )}
    </div>
  )
}
