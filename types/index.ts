export type Role = 'admin' | 'jurado' | 'jinete'

export interface User {
  id: string
  full_name: string
  role: Role
  avatar_url?: string
  created_at: string
}

export interface Jinete {
  id: string
  full_name: string
  bio?: string
  federation_number?: string
  date_of_birth?: string
  phone?: string
  avatar_url?: string
}

export interface Caballo {
  id: string
  nombre: string
  raza: string
  edad: number
  sexo: 'castrado' | 'yegua' | 'entero'
  color: string
  owner_id: string
  active: boolean
  created_at: string
}

export interface Categoria {
  id: string
  nombre: string
  altura_cm: number
  orden: number
  ranking_por_caballo: boolean
  entra_ranking: boolean
}

export interface Concurso {
  id: string
  nombre: string
  numero: number
  fecha_inicio: string
  fecha_fin: string
  lugar: string
  ciudad: string
  temporada: number
  estado: 'upcoming' | 'active' | 'completed'
  descripcion?: string
  imagen_url?: string
}

export interface ConcursoDia {
  id: string
  concurso_id: string
  fecha: string
  dia_numero: number
}

export interface Prueba {
  id: string
  concurso_dia_id: string
  categoria_id: string
  nombre: string
  articulo?: string
  orden: number
  estado: 'pending' | 'completed'
  categoria?: Categoria
}

export interface Resultado {
  id: string
  prueba_id: string
  jinete_id: string
  caballo_id: string
  posicion?: number
  faltas?: number
  tiempo_seg?: number
  penalizacion_tiempo?: number
  estado_resultado: 'completed' | 'ELM' | 'RET' | 'NSP'
  puntos_asignados: number
  uploaded_by: string
  created_at: string
  jinete?: Jinete
  caballo?: Caballo
}

export interface RankingEntry {
  id: string
  jinete_id: string | null  // null para categorías ranking_por_caballo (CJ S1/S2, Novicios)
  caballo_id: string
  categoria_id: string
  temporada: number
  puntos_total: number
  posicion: number
  cds_count: number
  puntos_por_cds: Record<string, number>
  jinete?: Jinete | null
  caballo?: Caballo
  categoria?: Categoria
}

export interface Noticia {
  id: string
  titulo: string
  contenido: string
  imagen_url?: string
  autor_id: string
  publicado: boolean
  fecha_publicacion: string
  created_at: string
}
