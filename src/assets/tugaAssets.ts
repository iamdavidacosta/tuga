const tugaAssetRoot = '/assets/tuga'

export const tugaAssets = {
  appIcon: `${tugaAssetRoot}/app-icon.png`,
  logos: {
    text: `${tugaAssetRoot}/logos/tuga-texto-verde.png`,
  },
  mascots: {
    calendar: `${tugaAssetRoot}/mascotas/tuga-calendario.png`,
    heart: `${tugaAssetRoot}/mascotas/tuga-corazon.png`,
  },
  icons: {
    add: `${tugaAssetRoot}/iconos/agregar.svg`,
    settings: `${tugaAssetRoot}/iconos/ajustes.svg`,
    calendar: `${tugaAssetRoot}/iconos/calendario.svg`,
    history: `${tugaAssetRoot}/iconos/historial.svg`,
    medication: `${tugaAssetRoot}/iconos/medicamento.svg`,
    pending: `${tugaAssetRoot}/iconos/pendiente.svg`,
    postpone: `${tugaAssetRoot}/iconos/posponer.svg`,
    reminder: `${tugaAssetRoot}/iconos/recordatorio.svg`,
    clock: `${tugaAssetRoot}/iconos/reloj.svg`,
    taken: `${tugaAssetRoot}/iconos/tomado.svg`,
  },
} as const

export type TugaIconName = keyof typeof tugaAssets.icons
