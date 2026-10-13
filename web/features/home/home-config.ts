export type HomeHeroSlide = {
  eyebrow: string
  title: string
  accent: string
  description: string
  image_url: string
  primary_label: string
  primary_href: string
  secondary_label: string
  secondary_href: string
  side_title: string
  side_text: string
}

export type HomeCategory = {
  title: string
  subtitle: string
  image_url: string
  href: string
}

export type HomePromo = {
  eyebrow: string
  title: string
  description: string
  image_url: string
  cta_label: string
  href: string
  theme: 'dark' | 'light'
}

export type HomeConfig = {
  hero_slides: HomeHeroSlide[]
  categories: HomeCategory[]
  promos: HomePromo[]
  newsletter_title: string
  newsletter_text: string
}

export const DEFAULT_HOME_CONFIG: HomeConfig = {
  hero_slides: [
    {
      eyebrow: 'CAMPEONATOS EM DESTAQUE',
      title: 'JOGUE.',
      accent: 'COMPITA. VENÇA.',
      description: 'Encontre campeonatos de Free Fire com vagas abertas, datas confirmadas e premiação publicada.',
      image_url: '',
      primary_label: 'VER CAMPEONATOS',
      primary_href: '/campeonatos',
      secondary_label: 'VAGAS ABERTAS',
      secondary_href: '/campeonatos?vagas=1',
      side_title: 'DROPZONE',
      side_text: 'Competições, equipes, jogadores e resultados em um só lugar.',
    },
    {
      eyebrow: 'ENCONTRE SUA PRÓXIMA COMPETIÇÃO',
      title: 'VAGAS',
      accent: 'ABERTAS AGORA.',
      description: 'Compare inscrições, premiações e datas antes de escolher onde sua equipe vai jogar.',
      image_url: '',
      primary_label: 'VER VAGAS',
      primary_href: '/campeonatos?vagas=1',
      secondary_label: 'VER TODOS',
      secondary_href: '/campeonatos',
      side_title: 'SEM COMPLICAÇÃO',
      side_text: 'Entre no campeonato certo sem procurar links espalhados.',
    },
    {
      eyebrow: 'RANKING DROPZONE',
      title: 'JOGUE.',
      accent: 'SUBA NO RANK.',
      description: 'Acompanhe equipes e jogadores pelos resultados oficiais e encontre os destaques do competitivo.',
      image_url: '',
      primary_label: 'VER RANKING',
      primary_href: '/rank',
      secondary_label: 'VER EQUIPES',
      secondary_href: '/equipes',
      side_title: 'RESULTADOS OFICIAIS',
      side_text: 'Classificação, MVP e histórico competitivo no mesmo perfil.',
    },
  ],
  categories: [
    { title: 'COPAS', subtitle: 'VER AGORA', image_url: '', href: '/campeonatos?tipo=copa' },
    { title: 'LIGAS', subtitle: 'VER AGORA', image_url: '', href: '/campeonatos?tipo=liga' },
    { title: 'SALAS', subtitle: 'VER AGORA', image_url: '', href: '/campeonatos?tipo=diario' },
    { title: 'X1', subtitle: 'VER AGORA', image_url: '', href: '/campeonatos?tipo=confronto' },
    { title: 'GRÁTIS', subtitle: 'VER AGORA', image_url: '', href: '/campeonatos?gratis=1' },
    { title: 'VAGAS ABERTAS', subtitle: 'VER AGORA', image_url: '', href: '/campeonatos?vagas=1' },
  ],
  promos: [
    {
      eyebrow: 'EM ALTA',
      title: 'AS MELHORES COMPETIÇÕES EM UM SÓ LUGAR.',
      description: 'Veja campeonatos com inscrições abertas e escolha sua próxima disputa.',
      image_url: '',
      cta_label: 'VER DESTAQUES',
      href: '/campeonatos?vagas=1',
      theme: 'dark',
    },
    {
      eyebrow: 'DROPZONE',
      title: 'ORGANIZE. COMPITA. ACOMPANHE.',
      description: 'A plataforma para produtoras, equipes e jogadores de Free Fire.',
      image_url: '',
      cta_label: 'ENTRAR NO SISTEMA',
      href: '/login?returnTo=%2F',
      theme: 'light',
    },
  ],
  newsletter_title: 'FIQUE POR DENTRO',
  newsletter_text: 'Novos campeonatos, vagas abertas e destaques da comunidade.',
}

function text(value: unknown, fallback: string) {
  return typeof value === 'string' ? value : fallback
}

export function normalizeHomeConfig(raw: unknown): HomeConfig {
  const input = raw && typeof raw === 'object' ? raw as Partial<HomeConfig> : {}
  const heroInput = Array.isArray(input.hero_slides) ? input.hero_slides : []
  const categoryInput = Array.isArray(input.categories) ? input.categories : []
  const promoInput = Array.isArray(input.promos) ? input.promos : []

  return {
    hero_slides: DEFAULT_HOME_CONFIG.hero_slides.map((fallback, index) => {
      const current = heroInput[index] || {} as Partial<HomeHeroSlide>
      return {
        eyebrow: text(current.eyebrow, fallback.eyebrow),
        title: text(current.title, fallback.title),
        accent: text(current.accent, fallback.accent),
        description: text(current.description, fallback.description),
        image_url: text(current.image_url, fallback.image_url),
        primary_label: text(current.primary_label, fallback.primary_label),
        primary_href: text(current.primary_href, fallback.primary_href),
        secondary_label: text(current.secondary_label, fallback.secondary_label),
        secondary_href: text(current.secondary_href, fallback.secondary_href),
        side_title: text(current.side_title, fallback.side_title),
        side_text: text(current.side_text, fallback.side_text),
      }
    }),
    categories: DEFAULT_HOME_CONFIG.categories.map((fallback, index) => {
      const current = categoryInput[index] || {} as Partial<HomeCategory>
      return {
        title: text(current.title, fallback.title),
        subtitle: text(current.subtitle, fallback.subtitle),
        image_url: text(current.image_url, fallback.image_url),
        href: text(current.href, fallback.href),
      }
    }),
    promos: DEFAULT_HOME_CONFIG.promos.map((fallback, index) => {
      const current = promoInput[index] || {} as Partial<HomePromo>
      return {
        eyebrow: text(current.eyebrow, fallback.eyebrow),
        title: text(current.title, fallback.title),
        description: text(current.description, fallback.description),
        image_url: text(current.image_url, fallback.image_url),
        cta_label: text(current.cta_label, fallback.cta_label),
        href: text(current.href, fallback.href),
        theme: current.theme === 'light' || current.theme === 'dark' ? current.theme : fallback.theme,
      }
    }),
    newsletter_title: text(input.newsletter_title, DEFAULT_HOME_CONFIG.newsletter_title),
    newsletter_text: text(input.newsletter_text, DEFAULT_HOME_CONFIG.newsletter_text),
  }
}
