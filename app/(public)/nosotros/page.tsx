import { Shield, Trophy, Users, Target } from 'lucide-react'

export default function NosotrosPage() {
  return (
    <div className="min-h-screen bg-white">
      <div className="page-header">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Nosotros</h1>
          <p className="text-gray-500 text-sm">Asociación de Deportes Ecuestres de Santa Cruz</p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* About */}
        <div className="mb-12">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Quiénes somos</h2>
          <p className="text-gray-600 leading-relaxed mb-4">
            ADESCRUZ es la Asociación de Deportes Ecuestres de Santa Cruz, Bolivia.
            Somos el organismo rector del salto ecuestre en el departamento de Santa Cruz,
            responsables de organizar, regular y promover el Campeonato Departamental de Salto (CDS).
          </p>
          <p className="text-gray-600 leading-relaxed">
            Nuestra misión es fomentar el deporte ecuestre en todas sus categorías, desde los
            futuros campeones hasta la primera categoría, garantizando competencias justas,
            transparentes y de alto nivel.
          </p>
        </div>

        {/* Values grid */}
        <div className="grid sm:grid-cols-2 gap-6 mb-12">
          {[
            {
              icon: <Shield size={20} className="text-green-600" />,
              title: 'Transparencia',
              desc: 'Resultados publicados en tiempo real. Ranking calculado automáticamente según reglamento oficial.',
            },
            {
              icon: <Trophy size={20} className="text-green-600" />,
              title: 'Excelencia',
              desc: '17 categorías competitivas desde los 60cm hasta el 1.35m para todos los niveles.',
            },
            {
              icon: <Users size={20} className="text-green-600" />,
              title: 'Comunidad',
              desc: 'Jinetes, caballos, entrenadores y familias unidos por la pasión ecuestre cruceña.',
            },
            {
              icon: <Target size={20} className="text-green-600" />,
              title: 'Desarrollo',
              desc: 'Promovemos el crecimiento técnico de los jinetes desde las categorías formativas.',
            },
          ].map((item, i) => (
            <div key={i} className="card p-6">
              <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center mb-4">
                {item.icon}
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">{item.title}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>

        {/* Categories */}
        <div className="card p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Categorías de competencia</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm">
            {[
              ['Futuros Campeones', '0.60m'],
              ['Pre-Infantil B', '0.65m'],
              ['Pre-Infantil A', '0.70m'],
              ['Infantil B', '0.75m'],
              ['Infantil A', '0.80m'],
              ['Pre-Juvenil B', '0.85m'],
              ['Pre-Juvenil A', '0.90m'],
              ['Juvenil B', '0.95m'],
              ['Juvenil A', '1.00m'],
              ['Pre-Amateur B', '1.05m'],
              ['Pre-Amateur A', '1.10m'],
              ['Amateur B', '1.15m'],
              ['Amateur A', '1.20m'],
              ['Pre-Profesional B', '1.25m'],
              ['Pre-Profesional A', '1.30m'],
              ['2da Categoría', '1.30m'],
              ['1ra Categoría', '1.35m'],
            ].map(([nombre, altura]) => (
              <div key={nombre} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-gray-50">
                <span className="text-gray-700">{nombre}</span>
                <span className="text-gray-400 text-xs font-medium">{altura}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
