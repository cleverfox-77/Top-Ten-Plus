'use client'

import type { GarmentType } from '@/lib/types'

// Schematic front-view line drawings that visually convey the SELECTED style
// options, so a tailor who doesn't read text can understand the garment at a
// glance. Only selected options are drawn. Shapes carry the meaning; the few
// numbers used (button/pocket counts) are readable regardless of literacy.

const INK = '#111827'
const MUTE = '#9ca3af'
const HL = '#dc2626'

function s(w = 2, stroke = INK) {
  return { fill: 'none', stroke, strokeWidth: w, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
}

function Btn({ x, y }: { x: number; y: number }): JSX.Element {
  return <circle cx={x} cy={y} r={3.2} fill="#fff" stroke={INK} strokeWidth={1.6} />
}

export default function GarmentDiagram({
  type,
  style,
  className = ''
}: {
  type: GarmentType
  style: Record<string, unknown>
  className?: string
}): JSX.Element {
  const svg =
    type === 'coat' ? (
      <Coat style={style} />
    ) : type === 'pant' ? (
      <Pant style={style} />
    ) : type === 'shirt' ? (
      <Shirt style={style} />
    ) : (
      <Panjabi style={style} />
    )
  return (
    <svg viewBox="0 0 200 260" className={className} xmlns="http://www.w3.org/2000/svg">
      {svg}
    </svg>
  )
}

// ---------------- Suit / Coat ----------------
function Coat({ style }: { style: Record<string, unknown> }): JSX.Element {
  const gs = String(style.garment_style ?? '')
  const band = ['mujib_coat', 'sherwani', 'band_collar_coat', 'prince_coat'].includes(gs)
  const doubleB = gs === 'double_breasted'
  const btn = Number(style.button_count) || (style.sb_button_style === '3_button' ? 3 : 2)
  const round = style.sb_bottom_shape === 'lob_round'
  const ventOpen = style.sb_side_vent === 'side_open'
  const hemY = 226

  const rows = Math.max(1, doubleB ? (btn >= 3 ? 3 : 2) : Math.min(btn, 4))
  const yTop = 118
  const yBot = 202
  const ys = Array.from({ length: rows }, (_, i) => (rows === 1 ? 155 : yTop + (i * (yBot - yTop)) / (rows - 1)))

  return (
    <g>
      {/* sleeves */}
      <path {...s()} d="M62,64 L40,74 L47,158 L62,150" />
      <path {...s()} d="M138,64 L160,74 L153,158 L138,150" />
      {/* torso */}
      <path
        {...s()}
        d={`M62,62 L62,${hemY} ${round ? `Q100,${hemY + 12} 138,${hemY}` : `L138,${hemY}`} L138,62`}
      />
      {/* shoulders */}
      <path {...s()} d="M62,62 L88,54 M138,62 L112,54" />

      {band ? (
        <>
          {/* mandarin band collar */}
          <rect x={86} y={50} width={28} height={12} rx={2} {...s(1.8)} />
          {/* closed center placket */}
          <line x1={100} y1={62} x2={100} y2={hemY - 8} {...s(1.4)} />
        </>
      ) : (
        <>
          {/* notch lapels forming a V */}
          <path {...s()} d="M100,60 L74,120 M100,60 L126,120" />
          <path {...s(1.4)} d="M74,120 L86,110 M126,120 L114,110" />
          <line x1={100} y1={120} x2={100} y2={hemY - 8} {...s(1.4)} />
        </>
      )}

      {/* buttons */}
      {doubleB
        ? ys.flatMap((y, i) => [<Btn key={`l${i}`} x={86} y={y} />, <Btn key={`r${i}`} x={114} y={y} />])
        : ys.map((y, i) => <Btn key={i} x={100} y={y} />)}

      {/* side vent slit */}
      {ventOpen && <line x1={132} y1={hemY - 26} x2={132} y2={hemY} stroke={HL} strokeWidth={2} strokeDasharray="4 3" />}
    </g>
  )
}

// ---------------- Pant ----------------
function Pant({ style }: { style: Record<string, unknown> }): JSX.Element {
  const kuchi = Boolean(style.two_kuchi)
  const crossPocket =
    Boolean(style.short_2_kuchi_cross_pocket) || Boolean(style.no_tickin_no_kuchi_cross_pocket)
  const folding = Boolean(style.folding_at_bottom)
  const backPocket = style.back_pocket === '1' ? 1 : style.back_pocket === '2' ? 2 : 0
  const hipPocket = Boolean(style.hip_pocket_at_back)
  const hemY = 236

  return (
    <g>
      {/* waistband */}
      <rect x={54} y={40} width={92} height={16} rx={2} {...s()} />
      {/* legs meeting at crotch */}
      <path {...s()} d={`M54,56 L60,${hemY} L92,${hemY} L100,96 L108,${hemY} L140,${hemY} L146,56`} />

      {/* kuchi (pleats) near waist */}
      {kuchi && (
        <>
          <line x1={82} y1={58} x2={82} y2={84} stroke={HL} strokeWidth={2} />
          <line x1={90} y1={58} x2={90} y2={80} stroke={HL} strokeWidth={2} />
          <line x1={110} y1={58} x2={110} y2={80} stroke={HL} strokeWidth={2} />
          <line x1={118} y1={58} x2={118} y2={84} stroke={HL} strokeWidth={2} />
        </>
      )}
      {/* cross / slant hip pockets */}
      {crossPocket && (
        <>
          <line x1={58} y1={60} x2={78} y2={80} stroke={HL} strokeWidth={2} />
          <line x1={142} y1={60} x2={122} y2={80} stroke={HL} strokeWidth={2} />
        </>
      )}
      {/* folding / cuff at hem */}
      {folding && (
        <>
          <line x1={60} y1={hemY - 12} x2={92} y2={hemY - 12} {...s(1.6)} />
          <line x1={108} y1={hemY - 12} x2={140} y2={hemY - 12} {...s(1.6)} />
        </>
      )}
      {/* back pocket count badge */}
      {backPocket > 0 && (
        <>
          <rect x={70} y={92} width={22} height={16} rx={2} strokeDasharray="3 2" {...s(1.4, MUTE)} />
          <text x={81} y={104} textAnchor="middle" fontSize="10" fontWeight="700" fill={INK}>
            ×{backPocket}
          </text>
        </>
      )}
      {hipPocket && <rect x={112} y={92} width={20} height={14} rx={2} strokeDasharray="3 2" {...s(1.4, MUTE)} />}
    </g>
  )
}

// ---------------- Shirt ----------------
function Shirt({ style }: { style: Record<string, unknown> }): JSX.Element {
  const pocket = style.pocket === 'one_pocket'
  const box = style.plate_style === 'box_plate'
  const chinese = style.collar === 'full_chinese'
  const sideCut = style.side_cut === 'two_inch_side_cut'
  const hemY = 220

  return (
    <g>
      {/* sleeves */}
      <path {...s()} d="M60,60 L38,70 L45,150 L60,144" />
      <path {...s()} d="M140,60 L162,70 L155,150 L140,144" />
      {/* body */}
      <path {...s()} d={`M60,58 L58,${hemY} L142,${hemY} L140,58`} />
      <path {...s()} d="M60,58 L86,52 M140,58 L114,52" />

      {chinese ? (
        <rect x={87} y={48} width={26} height={12} rx={2} {...s(1.8)} />
      ) : (
        <path {...s(1.8)} d="M100,58 L86,50 L92,64 M100,58 L114,50 L108,64" />
      )}

      {/* placket (box plate = wider double line) */}
      <line x1={100} y1={62} x2={100} y2={hemY - 6} {...s(1.4)} />
      {box && <line x1={106} y1={62} x2={106} y2={hemY - 6} {...s(1.2, MUTE)} />}
      {box && <line x1={94} y1={62} x2={94} y2={hemY - 6} {...s(1.2, MUTE)} />}
      {[86, 112, 138, 164].map((y) => (
        <Btn key={y} x={100} y={y} />
      ))}

      {/* chest pocket */}
      {pocket && <rect x={66} y={92} width={24} height={26} rx={1.5} {...s(1.6)} />}

      {/* 2-inch side cut slit */}
      {sideCut && <line x1={142} y1={hemY - 22} x2={142} y2={hemY} stroke={HL} strokeWidth={2} strokeDasharray="4 3" />}
    </g>
  )
}

// ---------------- Panjabi ----------------
function Panjabi({ style }: { style: Record<string, unknown> }): JSX.Element {
  const round = Boolean(style.round_sherwani_band)
  const hemY = 244

  return (
    <g>
      {/* sleeves */}
      <path {...s()} d="M60,60 L40,70 L47,170 L60,162" />
      <path {...s()} d="M140,60 L160,70 L153,170 L140,162" />
      {/* long tunic body */}
      <path {...s()} d={`M60,58 L56,${hemY} L144,${hemY} L140,58`} />
      <path {...s()} d="M60,58 L86,52 M140,58 L114,52" />
      {/* band collar (rounded if sherwani band) */}
      {round ? (
        <path {...s(1.8)} d="M86,58 Q100,46 114,58" />
      ) : (
        <rect x={86} y={48} width={28} height={12} rx={2} {...s(1.8)} />
      )}
      {/* front placket with buttons (sata) */}
      <line x1={100} y1={60} x2={100} y2={150} {...s(1.4)} />
      {[74, 96, 118, 140].map((y) => (
        <Btn key={y} x={100} y={y} />
      ))}
    </g>
  )
}
