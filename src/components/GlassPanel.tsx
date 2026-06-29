/**
 * GlassPanel — frosted-glass card primitive (S11).
 *
 * Renders a div with:
 *  • backdrop-blur + semi-transparent surface  (via .glass-panel CSS class)
 *  • elevation shadow from the glass design tokens in tailwind.config.js
 *
 * Fallbacks (set in index.css / CSS variables):
 *  • prefers-reduced-transparency → solid opaque background, no blur
 *
 * This component is PURELY visual — it passes all children through unchanged
 * and never adds props that alter behavior.
 */

import type { CSSProperties, ReactNode } from 'react'

export type GlassElevation = 'base' | 'raised' | 'elevated' | 'floating'

/** Elevation → box-shadow mapping (mirrors tailwind.config.js glass-* shadows). */
const SHADOW: Record<GlassElevation, string> = {
  base:     '0 2px 12px rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,0.50)',
  raised:   '0 4px 24px rgba(0,0,0,0.10), inset 0 1px 0 rgba(255,255,255,0.60)',
  elevated: '0 8px 40px rgba(0,0,0,0.16), inset 0 1px 0 rgba(255,255,255,0.70)',
  floating: '0 16px 60px rgba(0,0,0,0.22), inset 0 1px 0 rgba(255,255,255,0.80)',
}

interface GlassPanelProps {
  children: ReactNode
  /** Extra Tailwind / custom classes (rounded-*, p-*, etc.) */
  className?: string
  elevation?: GlassElevation
  /** Merged into the root element's style — use for domain-color glows, etc. */
  style?: CSSProperties
}

export function GlassPanel({
  children,
  className = '',
  elevation = 'base',
  style,
}: GlassPanelProps) {
  return (
    <div
      className={`glass-panel ${className}`}
      style={{ boxShadow: SHADOW[elevation], ...style }}
    >
      {children}
    </div>
  )
}
