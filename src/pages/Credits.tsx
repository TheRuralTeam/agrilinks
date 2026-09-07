import React from 'react'
import { Link } from 'react-router-dom'

const Credits = () => {
  return (
    <main className="min-h-screen flex items-center justify-center bg-white p-8">
      <div className="max-w-3xl w-full">
        <h1 className="text-2xl font-bold mb-4">Créditos e Atribuições</h1>
        <p className="mb-4 text-sm text-gray-700">Agradecemos aos projetos e provedores que tornam o AgriLink possível. Esta página reúne as atribuições exigidas pelas fontes de dados de mapas e outras bibliotecas de terceiros utilizadas no site.</p>

        <section className="mb-6">
          <h2 className="text-lg font-semibold mb-2">Mapas e Tiles</h2>
          <p className="text-sm text-gray-700 mb-2">Os dados de mapa são fornecidos por OpenStreetMap e seus colaboradores. Tiles de mapa usados no site são fornecidos por CARTO sob os seus termos.</p>
          <p className="text-sm text-gray-600">Crédito exigido por licença:</p>
          <ul className="list-disc list-inside text-sm text-gray-600 mt-2">
            <li>Map data © <a className="text-accent" href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors</li>
            <li>Tiles © <a className="text-accent" href="https://carto.com/">CARTO</a></li>
          </ul>
        </section>

        <section className="mb-6">
          <h2 className="text-lg font-semibold mb-2">Bibliotecas</h2>
          <ul className="list-disc list-inside text-sm text-gray-600">
            <li>Leaflet — mapas interativos</li>
            <li>React, TailwindCSS, Lucide, Supabase e outras bibliotecas de código aberto listadas nos ficheiros de dependências.</li>
          </ul>
        </section>

        <div className="mt-6">
          <Link to="/" className="text-sm text-accent font-medium">Voltar ao início</Link>
        </div>
      </div>
    </main>
  )
}

export default Credits
