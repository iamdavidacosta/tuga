import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'

import { BottomNavigation } from './BottomNavigation'

describe('navegación inferior compartida', () => {
  it('mantiene cuatro iconos en contenedores fijos y etiquetas completas', () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/medicamentos']}>
        <BottomNavigation />
      </MemoryRouter>,
    )

    expect(screen.getByRole('navigation', { name: 'Navegación principal' })).toBeVisible()
    expect(screen.getAllByRole('link')).toHaveLength(4)
    expect(container.querySelectorAll('.bottom-navigation__icon .tuga-icon')).toHaveLength(4)
    expect(screen.getByText('Medicamentos')).toBeVisible()
    expect(screen.getByText('Calendario')).toBeVisible()
    expect(screen.getByText('Más')).toBeVisible()
  })
})
