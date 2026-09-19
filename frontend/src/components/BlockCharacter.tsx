/**
 * A blocky voxel character, drawn as SVG on a 16x32 grid with one unit per pixel.
 *
 * Our own character rather than Mojang's: the specific player skins are their artwork, so
 * nothing is copied. The genre - a rectangular head, body, arms and legs - is not something
 * anyone owns, and drawing it ourselves means we can colour it with the app's palette and
 * give it a face that reacts.
 *
 * Being grid geometry rather than freehand art, it is predictable at any size, and
 * shapeRendering="crispEdges" keeps the pixel edges sharp when scaled up.
 */

export type Expression = 'neutral' | 'happy' | 'sad'

const COLOURS = {
  skin: '#c98d5c',
  skinShade: '#b57b4d',
  hair: '#3a2a1c',
  shirt: '#4f7a34', // the app's grass green, so the character belongs to Real Maths
  shirtShade: '#3f6329',
  trousers: '#3b4a63',
  shoes: '#2b2823',
  eyeWhite: '#f2f2f2',
  pupil: '#2b2823',
}

function mouth(expression: Expression) {
  switch (expression) {
    case 'happy':
      // A wider mouth, corner pixels raised, reading as a smile.
      return (
    <>
      <rect x={6} y={6} width={4} height={1} fill={COLOURS.pupil} />
      <rect x={5} y={5} width={1} height={1} fill={COLOURS.pupil} />
      <rect x={10} y={5} width={1} height={1} fill={COLOURS.pupil} />
    </>
      )
    case 'sad':
      return (
    <>
      <rect x={7} y={7} width={2} height={1} fill={COLOURS.pupil} />
      <rect x={6} y={5} width={1} height={1} fill={COLOURS.pupil} />
      <rect x={9} y={5} width={1} height={1} fill={COLOURS.pupil} />
    </>
      )
    default:
      return <rect x={7} y={6} width={2} height={1} fill={COLOURS.pupil} />
  }
}

interface BlockCharacterProps {
  /** head crops to just the head, for use as an avatar */
  variant?: 'head' | 'full'
  /** rendered width in pixels; height follows the grid's aspect ratio */
  size?: number
  expression?: Expression
  label?: string
  className?: string
}

export function BlockCharacter({
  variant = 'full',
  size = 64,
  expression = 'neutral',
  label,
  className = '',
}: BlockCharacterProps) {
  const viewBox = variant === 'head' ? '4 0 8 8' : '0 0 16 32'
  const height = variant === 'head' ? size : size * 2

  return (
    <svg
      viewBox={viewBox}
      width={size}
      height={height}
      shapeRendering="crispEdges"
      className={className}
      role={label ? 'img' : 'presentation'}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      {variant === 'full' && (
        <>
          {/* arms: sleeve on top, bare hand below */}
          <rect x={0} y={8} width={4} height={6} fill={COLOURS.shirt} />
          <rect x={0} y={14} width={4} height={6} fill={COLOURS.skin} />
          <rect x={12} y={8} width={4} height={6} fill={COLOURS.shirt} />
          <rect x={12} y={14} width={4} height={6} fill={COLOURS.skin} />
          {/* body, with a collar line for definition */}
          <rect x={4} y={8} width={8} height={12} fill={COLOURS.shirt} />
          <rect x={5} y={8} width={6} height={1} fill={COLOURS.shirtShade} />
          {/* legs, with shoes */}
          <rect x={4} y={20} width={4} height={10} fill={COLOURS.trousers} />
          <rect x={8} y={20} width={4} height={10} fill={COLOURS.trousers} />
          <rect x={4} y={30} width={4} height={2} fill={COLOURS.shoes} />
          <rect x={8} y={30} width={4} height={2} fill={COLOURS.shoes} />
        </>
      )}

      {/* head: skin, hair over the crown and down the sides, then the face */}
      <rect x={4} y={0} width={8} height={8} fill={COLOURS.skin} />
      <rect x={4} y={0} width={8} height={2} fill={COLOURS.hair} />
      <rect x={4} y={2} width={1} height={2} fill={COLOURS.hair} />
      <rect x={11} y={2} width={1} height={2} fill={COLOURS.hair} />
      {/* Shading down one side only. This was originally a full-width overlay, which simply
          darkened the entire face to a single flat tone: it added no dimension, and it meant
          the skin colour chosen above never appeared in the rendered pixels at all. */}
      <rect x={10} y={2} width={2} height={6} fill={COLOURS.skinShade} opacity={0.45} />

      <rect x={5} y={4} width={2} height={1} fill={COLOURS.eyeWhite} />
      <rect x={9} y={4} width={2} height={1} fill={COLOURS.eyeWhite} />
      <rect x={6} y={4} width={1} height={1} fill={COLOURS.pupil} />
      <rect x={10} y={4} width={1} height={1} fill={COLOURS.pupil} />

      {mouth(expression)}
    </svg>
  )
}
