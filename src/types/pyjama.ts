export interface BranchItem {
  id: string;
  nom_branche: string;
  ordre: number;
  active: boolean;
  created_at?: Date | null;
}

export interface ServiceItem {
  id: string;
  nom_service: string;
  ordre: number;
  active: boolean;
  created_at?: Date | null;
}

export type PosterFit = 'contain' | 'cover';
export type PosterPosition = 'center' | 'top' | 'bottom';

export interface EventSettings {
  titre: string;
  description: string;
  affiche_present: boolean;
  affiche_fit: PosterFit;
  affiche_position: PosterPosition;
  theme_primary: string;
  theme_accent: string;
  affichage_public_participants: boolean;
  updated_at?: Date | null;
}

export interface EventPoster {
  data_url: string;
  mime_type: 'image/jpeg' | 'image/png' | 'image/webp';
  file_name: string;
  width: number;
  height: number;
  updated_at?: Date | null;
}

export interface ParticipantPublic {
  id: string;
  numero_inscription: string;
  nom: string;
  prenom: string;
  branche_id: string;
  branche_nom: string;
  service_id: string;
  service_nom: string;
  qr_token: string;
  public_visible: boolean;
  statut_entree: boolean;
  date_entree: Date | null;
  created_at: Date;
}

export interface ParticipantAdmin extends ParticipantPublic {
  contact: string;
  phone_hash: string;
}

export interface AdminUserRecord {
  uid: string;
  email: string;
  role: 'super_admin' | 'admin' | 'scanner';
  display_name: string;
  created_at?: Date | null;
}

export const PRIMARY_ADMIN_EMAIL = 'dalougouboris650@gmail.com';

export const DEFAULT_EVENT_SETTINGS: EventSettings = {
  titre: 'INSCRIPTION AU PYJAMA PARTY',
  description:
    'Réservez votre place dès maintenant en remplissant ce formulaire. Vous recevrez immédiatement votre numéro d’inscription et votre QR Code personnel pour l’accès à la soirée.',
  affiche_present: false,
  affiche_fit: 'contain',
  affiche_position: 'center',
  theme_primary: '#1E1B4B',
  theme_accent: '#D97706',
  affichage_public_participants: true,
  updated_at: null,
};

export const DEFAULT_BRANCHES: Omit<BranchItem, 'created_at'>[] = [
  { id: 'katartizo', nom_branche: 'KATARTIZO', ordre: 1, active: true },
  { id: 'anagkazo-azito', nom_branche: 'ANAGKAZO (AZITO)', ordre: 2, active: true },
  { id: 'dunamis-cocody', nom_branche: 'DUNAMIS (COCODY)', ordre: 3, active: true },
  { id: 'loyaute-selmer', nom_branche: 'LOYAUTÉ (SELMER)', ordre: 4, active: true },
  { id: 'france', nom_branche: 'FRANCE', ordre: 5, active: true },
  { id: 'odiene', nom_branche: 'ODIENE', ordre: 6, active: true },
  { id: 'prodige-bassam', nom_branche: 'PRODIGE (BASSAM)', ordre: 7, active: true },
  { id: 'faveur-divine-a-gauche', nom_branche: 'FAVEUR DIVINE (A GAUCHE)', ordre: 8, active: true },
  { id: 'koute', nom_branche: 'KOUTÉ', ordre: 9, active: true },
  { id: 'zoe-gesco', nom_branche: 'ZOE (GESCO)', ordre: 10, active: true },
];
