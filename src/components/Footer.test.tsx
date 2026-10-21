import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import Footer from './Footer'

describe('Footer navigation', () => {
  it('does not expose placeholder anchors as working links', () => {
    render(<Footer />)

    expect(document.querySelectorAll('a[href="#"]')).toHaveLength(0)
    expect(screen.getByRole('link', { name: 'Como Funciona' })).toHaveAttribute('href', '/site#tecnologia')
    expect(screen.getByRole('link', { name: 'Catálogo' })).toHaveAttribute('href', '/app')
    expect(screen.getByRole('link', { name: 'Sobre Nós' })).toHaveAttribute('href', '/site#equipa')
    expect(screen.getByRole('link', { name: 'Contacto' })).toHaveAttribute('href', '/site#contacto')
  })

  it('uses real routes for terms and support instead of unimplemented pages', () => {
    render(<Footer />)

    expect(screen.getByRole('link', { name: 'Termos de Publicação' })).toHaveAttribute('href', '/termos-publicidade')
    expect(screen.getByRole('link', { name: /Privacidade e cookies/ })).toHaveAttribute('href', '/suporte')
    expect(screen.getByRole('link', { name: /Abrir área de suporte/ })).toHaveAttribute('href', '/suporte')
  })

  it('makes contact information actionable', () => {
    render(<Footer />)

    expect(screen.getByRole('link', { name: /922 717 574/ })).toHaveAttribute('href', 'tel:+244922717574')
    expect(screen.getByRole('link', { name: /935 358 417/ })).toHaveAttribute('href', 'tel:+244935358417')
    expect(screen.getByRole('link', { name: /contacto@agrilink.ao/ })).toHaveAttribute('href', 'mailto:contacto@agrilink.ao')
  })
})
