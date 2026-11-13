import { tugaAssets, type TugaIconName } from '../assets/tugaAssets'

interface TugaIconProps {
  name: TugaIconName
  className?: string
}

export function TugaIcon({ name, className = '' }: TugaIconProps) {
  return (
    <img
      aria-hidden="true"
      className={`tuga-icon ${className}`.trim()}
      src={tugaAssets.icons[name]}
      alt=""
    />
  )
}
