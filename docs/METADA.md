# Tipos de Metadados

Estruturas JSONB por tipo de item.

## Estrutura Geral

Cada `item` tem um campo `metadata` (JSONB) com estrutura variável baseada no `type`.

## Tipos Disponíveis

### 1. Movie (Filmes)

```typescript
type MovieMetadata = {
  // TMDB data
  tmdb_id: number;
  imdb_id?: string;
  year: number;
  release_date: string; // ISO 8601

  // Classificação
  genres: string[]; // ['Action', 'Thriller']
  original_language: string; // 'en', 'pt', etc

  // Detalhes
  director?: string;
  cast?: string[]; // Top 5 atores
  runtime?: number; // minutos

  // Ratings
  tmdb_rating?: number; // 0-10
  tmdb_votes?: number;
  imdb_rating?: number;

  // Visual
  poster_url?: string;
  backdrop_url?: string;

  // Streaming availability (JustWatch via TMDB)
  streaming: Array<{
    provider: string; // 'Netflix', 'Amazon Prime', etc
    provider_id: number;
    logo_path?: string;
    type: "flatrate" | "rent" | "buy"; // assinatura, aluguel, compra
    price?: number;
    currency?: string;
    url?: string;
  }>;

  // Availability flags
  available_streaming: boolean;
  available_download: boolean;
  download_sources?: string[]; // se aplicável
};
```

**Exemplo:**

```json
{
  "tmdb_id": 550,
  "imdb_id": "tt0137523",
  "year": 1999,
  "release_date": "1999-10-15",
  "genres": ["Drama"],
  "original_language": "en",
  "director": "David Fincher",
  "cast": ["Brad Pitt", "Edward Norton", "Helena Bonham Carter"],
  "runtime": 139,
  "tmdb_rating": 8.4,
  "tmdb_votes": 28000,
  "poster_url": "https://image.tmdb.org/t/p/w500/pB8BM7pdSp6B6Ih7QZ4DrQ3PmJK.jpg",
  "streaming": [
    {
      "provider": "Netflix",
      "provider_id": 8,
      "type": "flatrate",
      "logo_path": "/path.jpg"
    }
  ],
  "available_streaming": true,
  "available_download": false
}
```

---

### 2. Series (Séries de TV)

```typescript
type SeriesMetadata = {
  // Similar a Movie mas com campos adicionais
  tmdb_id: number;
  imdb_id?: string;
  year: number; // ano de início
  first_air_date: string;
  last_air_date?: string;
  status: 'Returning Series' | 'Ended' | 'Canceled';

  // Estrutura
  number_of_seasons: number;
  number_of_episodes: number;
  episode_runtime?: number[]; // pode variar

  // Outros campos iguais a Movie
  genres: string[];
  creators?: string[];
  cast?: string[];
  tmdb_rating?: number;
  poster_url?: string;
  streaming: Array<{...}>;
  available_streaming: boolean;
};
```

---

### 3. Video (YouTube)

```typescript
type VideoMetadata = {
  // YouTube data
  video_id: string; // 'dQw4w9WgXcQ'
  url: string; // URL completa

  // Canal
  channel_id: string;
  channel_name: string;
  channel_url?: string;

  // Detalhes
  duration: number; // segundos
  published_at: string; // ISO 8601

  // Stats
  views?: number;
  likes?: number;

  // Visual
  thumbnail_url: string; // maxres ou high

  // Classificação
  category: string; // 'Music', 'Education', 'Gaming', etc
  tags?: string[];

  // Legenda/idioma
  default_audio_language?: string;
  has_captions?: boolean;
};
```

**Exemplo:**

```json
{
  "video_id": "dQw4w9WgXcQ",
  "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  "channel_id": "UCuAXFkgsw1L7xaCfnd5JJOw",
  "channel_name": "Rick Astley",
  "duration": 212,
  "published_at": "2009-10-25T06:57:33Z",
  "views": 1400000000,
  "likes": 15000000,
  "thumbnail_url": "https://i.ytimg.com/vi/dQw4w9WgXcQ/maxresdefault.jpg",
  "category": "Music",
  "default_audio_language": "en"
}
```

---

### 4. Link (URLs genéricos)

```typescript
type LinkMetadata = {
  // URL original
  url: string;
  domain: string; // 'react.dev'

  // OpenGraph data
  og_title?: string;
  og_description?: string;
  og_image?: string;
  og_type?: string; // 'website', 'article', etc
  og_site_name?: string;

  // Metadata HTML
  meta_description?: string;
  meta_keywords?: string[];

  // Classificação automática
  category?: "documentation" | "article" | "tool" | "blog" | "other";

  // Technical
  favicon?: string;
  language?: string;

  // Preview
  preview_html?: string; // primeiro parágrafo ou excerpt
};
```

**Exemplo:**

```json
{
  "url": "https://react.dev",
  "domain": "react.dev",
  "og_title": "React",
  "og_description": "The library for web and native user interfaces",
  "og_image": "https://react.dev/images/og-home.png",
  "og_type": "website",
  "og_site_name": "React",
  "category": "documentation",
  "favicon": "https://react.dev/favicon.ico",
  "language": "en"
}
```

---

### 5. Note (Notas de texto)

```typescript
type NoteMetadata = {
  // Classificação inferida pelo Claude
  category?: "study" | "personal" | "work" | "idea" | "other";

  // Contexto adicional
  related_topics?: string[];

  // Se for código
  is_code?: boolean;
  language?: string; // 'javascript', 'python', etc

  // Prioridade (se for TODO/reminder)
  priority?: "low" | "medium" | "high";
};
```

**Exemplo:**

```json
{
  "category": "study",
  "related_topics": ["React", "Hooks"],
  "priority": "medium"
}
```

---

### 6. Music (Música/Álbum)

```typescript
type MusicMetadata = {
  // Artista
  artist: string;
  artist_id?: string; // Spotify/Apple Music ID

  // Álbum (se aplicável)
  album?: string;
  album_id?: string;

  // Track
  track_name?: string;
  track_id?: string;

  // Detalhes
  year?: number;
  duration?: number; // segundos
  genre?: string[];

  // Streaming
  spotify_url?: string;
  apple_music_url?: string;
  youtube_music_url?: string;

  // Visual
  cover_art_url?: string;

  // Stats
  popularity?: number; // 0-100
};
```

---

### 7. Game (Jogos)

```typescript
type GameMetadata = {
  // Dados básicos
  platform: string[]; // ['PC', 'PS5', 'Xbox']
  genre: string[];
  developer?: string;
  publisher?: string;

  // Release
  release_date?: string;
  year?: number;

  // Ratings
  metacritic_score?: number;
  user_score?: number;

  // Availability
  steam_id?: string;
  steam_url?: string;
  price?: number;
  currency?: string;
  on_sale?: boolean;
  sale_price?: number;

  // Visual
  cover_url?: string;

  // Gameplay
  multiplayer?: boolean;
  singleplayer?: boolean;
  coop?: boolean;
};
```

---

### 8. Library (Bibliotecas/Pacotes)

```typescript
type LibraryMetadata = {
  // Package info
  language: string; // 'javascript', 'python', etc
  package_name: string; // 'react', 'pandas'
  package_manager?: string; // 'npm', 'pip', 'cargo'

  // Versão
  version?: string;
  latest_version?: string;

  // Links
  npm_url?: string;
  github_url?: string;
  docs_url?: string;

  // Stats
  github_stars?: number;
  weekly_downloads?: number;

  // Info
  description?: string;
  license?: string;

  // Uso
  use_case?: string[]; // ['state-management', 'routing']
};
```

---

### 9. Reminder (Lembretes)

```typescript
type ReminderMetadata = {
  // Timing
  due_date?: string; // ISO 8601
  reminder_time?: string; // HH:MM

  // Recorrência
  recurring?: boolean;
  recurrence_pattern?: "daily" | "weekly" | "monthly";

  // Prioridade
  priority: "low" | "medium" | "high" | "urgent";

  // Contexto
  location?: string;
  related_to?: string[]; // IDs de outros items
};
```

---

## Type Guards

```typescript
// src/types/metadata.ts

export type ItemType =
  | "movie"
  | "series"
  | "video"
  | "link"
  | "note"
  | "music"
  | "game"
  | "library"
  | "reminder";

export type ItemMetadata =
  | MovieMetadata
  | SeriesMetadata
  | VideoMetadata
  | LinkMetadata
  | NoteMetadata
  | MusicMetadata
  | GameMetadata
  | LibraryMetadata
  | ReminderMetadata;

export function isMovieMetadata(
  type: ItemType,
  metadata: any
): metadata is MovieMetadata {
  return type === "movie";
}

export function isVideoMetadata(
  type: ItemType,
  metadata: any
): metadata is VideoMetadata {
  return type === "video";
}

// etc...
```
