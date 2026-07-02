'use client'

import React from 'react'

const AVATAR_COLORS = [
  '#534AB7', // purple
  '#059669', // green
  '#D97706', // amber
  '#E53E3E', // red
  '#2563EB', // blue
  '#7C3AED', // violet
  '#0891B2', // cyan
  '#DB2777', // pink
]

function getColorForString(str: string): string {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash)
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

interface ToAvatarProps {
  initials: string
  color?: string
  size?: number
  photoUrl?: string | null
  className?: string
}

export function ToAvatar({ initials, color, size = 32, photoUrl, className = '' }: ToAvatarProps) {
  const bgColor = color || getColorForString(initials)
  const fontSize = Math.round(size * 0.34)

  return (
    <div
      className={`flex items-center justify-center flex-shrink-0 rounded-full overflow-hidden font-bold ${className}`}
      style={{
        width: size,
        height: size,
        backgroundColor: photoUrl ? 'transparent' : bgColor + '22',
        color: bgColor,
        fontSize,
        border: photoUrl ? 'none' : `2px solid white`,
      }}
    >
      {photoUrl ? (
        <img src={photoUrl} alt={initials} className="w-full h-full object-cover" />
      ) : (
        initials
      )}
    </div>
  )
}
