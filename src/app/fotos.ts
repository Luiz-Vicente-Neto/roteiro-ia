/** A Destino's photo, saved in public/destinos, with the credit the license asks for. */
export interface FotoDoDestino {
  /** Path served by Next, from public/. */
  src: string;
  autor: string;
  /** The author's Unsplash profile, linked from the credit. */
  link: string;
  /** The photo's page on Unsplash, kept to trace the file back. */
  origem: string;
}

/**
 * One photo per Destino, never per Hotel: it shows the place, not the
 * lodging. All from Unsplash, free to use under the Unsplash License.
 */
const FOTOS: Record<string, FotoDoDestino> = {
  gramado: {
    src: "/destinos/gramado.jpg",
    autor: "Willian Justen de Vasconcellos",
    link: "https://unsplash.com/@willianjusten",
    origem: "https://unsplash.com/photos/m_SJ_TvNxtU",
  },
  "campos-do-jordao": {
    src: "/destinos/campos-do-jordao.jpg",
    autor: "Caio Arbulu",
    link: "https://unsplash.com/@caioarbulu",
    origem: "https://unsplash.com/photos/im91AP8RN4c",
  },
  bonito: {
    src: "/destinos/bonito.jpg",
    autor: "Dora Dalberto",
    link: "https://unsplash.com/@doradalberto",
    origem: "https://unsplash.com/photos/kYSMhypI6U4",
  },
  "foz-do-iguacu": {
    src: "/destinos/foz-do-iguacu.jpg",
    autor: "Vicente Frances",
    link: "https://unsplash.com/@vicentef",
    origem: "https://unsplash.com/photos/vbaVanM78lU",
  },
  "porto-de-galinhas": {
    src: "/destinos/porto-de-galinhas.jpg",
    autor: "Cleber Nadalutti",
    link: "https://unsplash.com/@cnadalutti",
    origem: "https://unsplash.com/photos/eNWKOxzkBwQ",
  },
  jericoacoara: {
    src: "/destinos/jericoacoara.jpg",
    autor: "Alex Braga",
    link: "https://unsplash.com/@awbraga",
    origem: "https://unsplash.com/photos/1TsJc3wIRGo",
  },
  "lencois-maranhenses": {
    src: "/destinos/lencois-maranhenses.jpg",
    autor: "Lukas Souza",
    link: "https://unsplash.com/@lukassouza",
    origem: "https://unsplash.com/photos/Qu6QYnWyE08",
  },
};

/** The photo of the Destino `slug`, or undefined for a Destino without one. */
export function fotoDoDestino(slug: string): FotoDoDestino | undefined {
  return Object.hasOwn(FOTOS, slug) ? FOTOS[slug] : undefined;
}
